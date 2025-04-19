const sql = require('mssql');

const config = {
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=DRANUSORN_PHA;Database=Production_Analytics;Trusted_Connection=yes;`,
    pool: {
        min: 0,
        max: 5,
        idleTimeoutMillis: 30000
    }
};

const departmentPools = {
    cgm: {
        dashboard: null,
        chart: null,
        table: null
    },
    profile: {
        dashboard: null,
        chart: null,
        table: null
    },
    bar1: {
        dashboard: null,
        chart: null,
        table: null
    }
};

async function getDepartmentPool(department, module) {
    try {
        if (!departmentPools[department][module]) {
            console.log(`Initializing ${department}/${module} pool...`);
            departmentPools[department][module] = await new sql.ConnectionPool(config).connect();
            console.log(`${department}/${module} pool initialized successfully`);
        }
        return departmentPools[department][module];
    } catch (err) {
        console.error(`Error getting ${department}/${module} pool:`, err);
        throw err;
    }
}

module.exports = {
    getDepartmentPool
};