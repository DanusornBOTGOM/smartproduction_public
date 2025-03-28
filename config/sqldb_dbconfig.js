const sql = require('mssql/msnodesqlv8');

const poolConfig = {
    min: parseInt(process.env.DB_POOL_MIN || '1'),
    max: parseInt(process.env.DB_POOL_MAX || '2'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
    acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
    createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '30000'),
    destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT || '5000'),
    reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
    createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL || '200')
};

// ฟังก์ชันสำหรับเรียกใช้ connection string แบบ Docker หรือแบบเดิม
function getConnectionString(dbType) {
    // ถ้ามีการตั้งค่า DOCKER_ENV เป็น true จะใช้รูปแบบการเชื่อมต่อแบบ Docker
    if (process.env.DOCKER_ENV === 'true') {
        const server = process.env.SQLSERVER_HOST || 'sqlserver';
        const port = process.env.SQLSERVER_PORT || '1433';
        const user = process.env.SQLSERVER_USER || 'sa';
        const password = process.env.SQLSERVER_PASSWORD || 'YourStrongPassword123';
        
        let database;
        if (dbType === 'PROD_ANALYTICS') {
            database = process.env.SQLSERVER_PROD_DB || 'Production_Analytics';
        } else if (dbType === 'SALE') {
            database = process.env.SQLSERVER_SALE_DB || 'Sale';
        }
        
        // ใช้รูปแบบการเชื่อมต่อแบบธรรมดาสำหรับ Docker ที่ไม่ได้ใช้ ODBC
        return {
            server: `${server},${port}`,
            database: database,
            user: user,
            password: password,
            useODBC: false  // ไม่ใช้ ODBC ใน Docker
        };
    } else {
        // ใช้รูปแบบเดิมสำหรับการรันโดยตรงบนเครื่อง
        if (dbType === 'PROD_ANALYTICS') {
            return {
                connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=MSW-PLAN-ACTUAL\\SQLEXPRESS;Database=Production_Analytics;UID=prodtusr;PWD=Pro1767*;`,
                useODBC: true
            };
        } else if (dbType === 'SALE') {
            return {
                connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=MSW-PLAN-ACTUAL\\SQLEXPRESS;Database=Sale;UID=prodtusr;PWD=Pro1767*;`,
                useODBC: true
            };
        }
    }
}

const configs = {
    PROD_ANALYTICS: {
        ...getConnectionString('PROD_ANALYTICS'),
        pool: poolConfig,
        options: {
            enableArithAbort: true,
            trustServerCertificate: true,
            connectTimeout: 30000,
            requestTimeout: 30000,
            encrypt: false
        }
    },
    SALE: {
        ...getConnectionString('SALE'),
        pool: poolConfig,
        options: {
            enableArithAbort: true,
            trustServerCertificate: true,
            connectTimeout: 30000,
            requestTimeout: 30000,
            encrypt: false
        }
    }
};

// เพิ่ม tracking สถานะของ pools
const pools = {};
const poolStatus = {};

// เพิ่ม keepalive mechanism
function setupKeepAlive(pool, dbName) {
    console.log(`[DEBUG] Setting up keepalive for ${dbName}`);
    
    // ล้าง interval เก่า (ถ้ามี)
    if (poolStatus[dbName]?.keepAliveInterval) {
        console.log(`[DEBUG] Clearing existing keepalive for ${dbName}`);
        clearInterval(poolStatus[dbName].keepAliveInterval);
    }

    poolStatus[dbName] = {
        lastUsed: Date.now(),
        keepAliveInterval: setInterval(async () => {
            try {
                // เช็คว่า pool ยังมีอยู่และเชื่อมต่ออยู่หรือไม่
                if (!pools[dbName] || !pools[dbName].connected) {
                    console.log(`[DEBUG] Connection lost for ${dbName}, attempting to reconnect...`);
                    try {
                        // พยายามสร้าง connection ใหม่
                        await getPool(dbName);
                        console.log(`[DEBUG] Successfully reconnected to ${dbName}`);
                        return;
                    } catch (reconnectError) {
                        console.error(`Failed to reconnect to ${dbName}:`, reconnectError);
                        return;
                    }
                }

                // ทำ keepalive เฉพาะเมื่อไม่มีการใช้งานเกิน 10 นาที
                if (Date.now() - poolStatus[dbName].lastUsed > 600000) {
                    console.log(`[DEBUG] Running keepalive check for ${dbName}`);
                    await pool.request().query('SELECT 1');
                    console.log(`[DEBUG] Keepalive successful for ${dbName}`);
                    poolStatus[dbName].lastUsed = Date.now();
                }
            } catch (err) {
                console.error(`Keepalive failed for ${dbName}:`, err);
                
                // ถ้าเป็น connection closed error ให้พยายามเชื่อมต่อใหม่
                if (err.code === 'ECONNCLOSED') {
                    console.log(`[DEBUG] Connection closed for ${dbName}, cleaning up resources...`);
                    
                    // ล้าง resources เก่า
                    if (pools[dbName]) {
                        try {
                            await pools[dbName].close();
                        } catch (closeErr) {
                            console.warn(`Error closing old pool for ${dbName}:`, closeErr);
                        }
                    }
                    delete pools[dbName];
                    
                    try {
                        // พยายามสร้าง connection ใหม่
                        await getPool(dbName);
                        console.log(`[DEBUG] Successfully recreated pool for ${dbName}`);
                    } catch (reconnectErr) {
                        console.error(`Failed to recreate pool for ${dbName}:`, reconnectErr);
                    }
                }
            }
        }, 300000) // check ทุก 5 นาที
    };
}

// ปรับปรุงฟังก์ชัน getPool ให้มี retry logic
async function getPool(dbName, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (pools[dbName]?.connected) {
                poolStatus[dbName].lastUsed = Date.now();
                return pools[dbName];
            }

            console.log(`Creating new pool for ${dbName} (attempt ${attempt})...`);
            
            if (pools[dbName]) {
                try {
                    await pools[dbName].close();
                } catch (err) {
                    console.warn(`Error closing old pool for ${dbName}:`, err);
                }
            }

            let poolSettings;
            
            // แยกแยะระหว่างการใช้ ODBC และไม่ใช้ ODBC
            if (configs[dbName].useODBC) {
                poolSettings = {
                    connectionString: configs[dbName].connectionString,
                    pool: poolConfig,
                    options: configs[dbName].options
                };
            } else {
                poolSettings = {
                    server: configs[dbName].server,
                    database: configs[dbName].database,
                    user: configs[dbName].user,
                    password: configs[dbName].password,
                    pool: poolConfig,
                    options: configs[dbName].options
                };
            }

            const pool = new sql.ConnectionPool(poolSettings);

            pool.on('error', async err => {
                console.error(`Pool ${dbName} error:`, err);
                
                // ในกรณีที่เกิด error พยายามปิด connection และล้าง resources
                try {
                    await pool.close();
                } catch (closeErr) {
                    console.warn(`Error closing pool on error for ${dbName}:`, closeErr);
                }
                delete pools[dbName];
                
                if (poolStatus[dbName]?.keepAliveInterval) {
                    clearInterval(poolStatus[dbName].keepAliveInterval);
                }
                delete poolStatus[dbName];
            });

            pools[dbName] = await pool.connect();
            setupKeepAlive(pools[dbName], dbName);
            
            return pools[dbName];

        } catch (err) {
            console.error(`Error getting pool for ${dbName} (attempt ${attempt}):`, err);
            if (attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// เพิ่มฟังก์ชันสำหรับปิด pools ทั้งหมด
async function closeAllPools() {
    for (const dbName in pools) {
        try {
            if (pools[dbName]?.connected) {
                await pools[dbName].close();
            }
            if (poolStatus[dbName]?.keepAliveInterval) {
                clearInterval(poolStatus[dbName].keepAliveInterval);
            }
        } catch (err) {
            console.error(`Error closing pool for ${dbName}:`, err);
        }
        delete pools[dbName];
        delete poolStatus[dbName];
    }
}

// Wrapper functions
const connectDestSql = async () => {
    return getPool('PROD_ANALYTICS');
};

const connectSaleSql = async () => {
    return getPool('SALE');
};

// Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('Closing all database pools...');
    await closeAllPools();
    process.exit(0);
});

module.exports = { 
    connectDestSql, 
    connectSaleSql,
    closeAllPools  // export เพื่อให้ใช้ในการ cleanup ได้จากภายนอก
};