const sql = require("mssql");

// ปรับ pool config ให้เหมาะสมกับการใช้งานมากขึ้น
const poolConfig = {
  min: 1, // เพิ่มค่า minimum connections
  max: 4, // เพิ่มค่า maximum connections
  idleTimeoutMillis: 300000, // เพิ่มเวลา idle timeout เป็น 5 นาที
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
};

// คงค่า configs เดิม แต่เพิ่ม options เพื่อความเสถียร
const configs = {
  PROD_ANALYTICS: {
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=host.docker.internal\\SQLEXPRESS;Database=Production_Analytics;Trusted_Connection=no;UID=gom;PWD=123456789aA!;`,
    pool: poolConfig,
    options: {
      enableArithAbort: true,
      trustServerCertificate: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
      encrypt: false,
    },
  },
  SALE: {
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=host.docker.internal\\SQLEXPRESS;Database=Sale;Trusted_Connection=no;UID=gom;PWD=123456789aA!;`,
    pool: poolConfig,
    options: {
      enableArithAbort: true,
      trustServerCertificate: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
      encrypt: false,
    },
  },
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
          console.log(
            `[DEBUG] Connection lost for ${dbName}, attempting to reconnect...`
          );
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
          await pool.request().query("SELECT 1");
          console.log(`[DEBUG] Keepalive successful for ${dbName}`);
          poolStatus[dbName].lastUsed = Date.now();
        }
      } catch (err) {
        console.error(`Keepalive failed for ${dbName}:`, err);

        // ถ้าเป็น connection closed error ให้พยายามเชื่อมต่อใหม่
        if (err.code === "ECONNCLOSED") {
          console.log(
            `[DEBUG] Connection closed for ${dbName}, cleaning up resources...`
          );

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
            console.error(
              `Failed to recreate pool for ${dbName}:`,
              reconnectErr
            );
          }
        }
      }
    }, 300000), // check ทุก 5 นาที
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

      const pool = new sql.ConnectionPool({
        ...configs[dbName],
        pool: poolConfig,
        options: {
          ...configs[dbName].options,
          connectTimeout: 30000,
          requestTimeout: 30000,
        },
      });

      pool.on("error", async (err) => {
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
      console.error(
        `Error getting pool for ${dbName} (attempt ${attempt}):`,
        err
      );
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
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
  return getPool("PROD_ANALYTICS");
};

const connectSaleSql = async () => {
  return getPool("SALE");
};

// Cleanup on process exit
process.on("SIGINT", async () => {
  console.log("Closing all database pools...");
  await closeAllPools();
  process.exit(0);
});

module.exports = {
  connectDestSql,
  connectSaleSql,
  closeAllPools, // export เพื่อให้ใช้ในการ cleanup ได้จากภายนอก
};
