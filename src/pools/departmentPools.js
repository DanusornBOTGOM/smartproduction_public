// const sql = require('mssql');
// const moment = require('moment-timezone')

// const config = {
//     connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=DRANUSORN_PHA;Database=Production_Analytics;Trusted_Connection=yes;`,
//     pool: {
//         min: 0,
//         max: 5,
//         idleTimeoutMillis: 30000
//     }
// };

// const departmentPools = {
//     cgm: null,       // pool สำหรับแผนก CGM
//     profile: null,   // pool สำหรับแผนก Profile
//     bar1: null,      // pool สำหรับแผนก Bar1
//     annealing: null  // pool สำหรับแผนก Annealing
// };

// async function getDepartmentPool(department) {
//     try {
//         // ถ้ายังไม่มี pool สำหรับแผนกนั้น
//         if (!departmentPools[department]) {
//             console.log(`Initializing ${department} pool...`);
//             // สร้าง pool ใหม่
//             departmentPools[department] = await new sql.ConnectionPool(config).connect();
//             console.log(`${department} pool initialized successfully`);
//         }
//         // ส่งคืน pool (ทั้งที่มีอยู่แล้วหรือสร้างใหม่)
//         return departmentPools[department];
//     } catch (err) {
//         console.error(`Error getting ${department} pool:`, err);
//         throw err;
//     }
// }

// module.exports = {
//     getDepartmentPool
// };