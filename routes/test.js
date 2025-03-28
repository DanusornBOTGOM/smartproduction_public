// const express = require('express');
// const sql = require('mssql/msnodesqlv8');
// const moment = require('moment-timezone');
// const NodeCache = require('node-cache');
// const { title } = require('process');
// const myCache = new NodeCache({ stdTTL: 300 });
// const router = express.Router();
// const cron = require('node-cron');
// const { connectDestSql } = require('../config/sqldb_dbconfig');
// const postgres = require('../config/postgresdb_dbconfig');

// moment.tz.setDefault("Asia/Bangkok");

// // โหลด Causes และ Waste 
// async function loadCausesAndWaste(sqlPool) {
//     try {
//         // โหลด Causes จาก PostgreSQL
//         const causesQuery = `
//             SELECT id, causecode, description, active, lastupdate
//             FROM public.bdcause
//             WHERE active = true 
//             ORDER BY lastupdate
//         `;

//         // โหลด Waste 
//         const wasteQuery = `
//             SELECT id, wastecode, description, active, lastupdate
//             FROM public.bdwaste
//             WHERE active = true 
//             ORDER BY lastupdate
//         `;

//         const [mswCauses, mswWaste] = await Promise.all([
//             postgres.queryMsw(causesQuery),
//             postgres.queryMsw(wasteQuery)
//         ]);

//         // บันทึก Causes ลงใน SQL Server
//         for (const cause of mswCauses.rows) {
//             await sqlPool.request()
//                 .input('CauseId', sql.Int, cause.id)
//                 .input('CauseCode', sql.NVarChar(10), cause.causecode)
//                 .input('Description', sql.NVarChar(300), cause.description)
//                 .input('lastupdate', sql.DateTime, new Date(cause.lastupdate))
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[BreakdownCauses] AS target
//                     USING (VALUES (@CauseId)) AS source(CauseId)
//                     ON target.CauseCode = @CauseCode
//                     WHEN MATCHED THEN
//                         UPDATE SET 
//                             Description = @Description,
//                             lastupdate = @lastupdate
//                     WHEN NOT MATCHED THEN
//                         INSERT (CauseCode, Description, lastupdate)
//                         VALUES (@CauseCode, @Description, @lastupdate);
//                 `);
//         }

//         // บันทึก Waste Codes - แก้ไขให้ใช้ wastecode
//         for (const waste of mswWaste.rows) {
//             await sqlPool.request()
//                 .input('WasteId', sql.Int, waste.id)
//                 .input('WasteCode', sql.NVarChar(10), waste.wastecode)  // เปลี่ยนจาก causecode เป็น wastecode
//                 .input('Description', sql.NVarChar(300), waste.description)
//                 .input('lastupdate', sql.DateTime, new Date(waste.lastupdate))
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[BreakdownWaste] AS target
//                     USING (VALUES (@WasteId)) AS source(WasteId)
//                     ON target.WasteCode = @WasteCode
//                     WHEN MATCHED THEN
//                         UPDATE SET
//                             Description = @Description,
//                             lastupdate = @lastupdate
//                     WHEN NOT MATCHED THEN
//                         INSERT (WasteCode, Description, lastupdate)
//                         VALUES (@WasteCode, @Description, @lastupdate);
//                 `);
//         }

//         console.log(`Loaded ${mswCauses.rows.length} causes and ${mswWaste.rows.length} waste codes`);
//     } catch (error) {
//         console.error('Error loading causes and waste:', error);
//         throw error;
//     }
// }

// // ดึงตาราง breakdown
// async function processDatabase(sqlPool, dbType, lastProcessedId) {  // เปลี่ยนพารามิเตอร์จาก lastProcessedTime เป็น lastProcessedId
//     let rowsAddedInThisProcess = 0;
//     const query = `
//         SELECT b.id, b.workmachine_id, b.workdate, b.bdst, b.bden, b.cause, b.notes, b.lastupdate, 
//                c.causecode, c.description as cause_description, d.machinenumber
//         FROM public.breakdown b
//         LEFT JOIN public.bdcause c ON b.cause = c.id
//         LEFT JOIN public.workmachine d ON b.workmachine_id = d.id
//         WHERE b.done = true AND b.id > $1  
//         ORDER BY b.id  
//     `;

//     const result = await (dbType === 'msw' ? postgres.queryMsw(query, [lastProcessedId]) : postgres.queryMswplus(query, [lastProcessedId]));
//     console.log(`Number of new records for ${dbType}:`, result.rows.length);

//     for (const row of result.rows) {
//         const downtime = row.bden && row.bdst ?
//             (new Date(row.bden) - new Date(row.bdst)) / (1000 * 60) : null;

//         // ปรับเวลาเพิ่ม 7 ชั่วโมง
//         const adjustTime = (time) => {
//             if (!time) return null;
//             const adjusted = new Date(time);
//             adjusted.setHours(adjusted.getHours() + 7);
//             return adjusted;
//         };

//         const mergeResult = await sqlPool.request()
//             .input('breakdownId', sql.Int, row.id)
//             .input('MachineCode', sql.NVarChar(50), row.machinenumber)
//             .input('Date', sql.Date, row.workdate)
//             .input('bdst', sql.DateTime, adjustTime(row.bdst))
//             .input('bden', sql.DateTime, adjustTime(row.bden))
//             .input('CauseCode', sql.NVarChar(10), row.causecode)
//             .input('Cause', sql.NVarChar(500), row.cause_description)
//             .input('notes', sql.NVarChar(500), row.notes)
//             .input('Downtime', sql.Float, downtime)
//             .input('lastupdate', sql.DateTime, adjustTime(row.lastupdate))
//             .input('SourceDB', sql.NVarChar(10), dbType)
//             .query(`
//                 MERGE INTO [Production_Analytics].[dbo].[BreakdownMaster] AS target
//                 USING (VALUES (@breakdownId, @SourceDB)) AS source(breakdownId, SourceDB)
//                 ON (target.breakdownId = source.breakdownId AND target.SourceDB = source.SourceDB)
//                 WHEN NOT MATCHED THEN
//                     INSERT (breakdownId, MachineCode, Date, bdst, bden, CauseCode,
//                     Cause, notes, Downtime, lastupdate, SourceDB)
//                     VALUES (@breakdownId, @MachineCode, DATEADD(DAY, 1, @Date), @bdst, @bden, @CauseCode,
//                     @Cause, @notes, @Downtime, @lastupdate, @SourceDB);

//                 SELECT @@ROWCOUNT AS AffectedRows;
//             `);

//         if (mergeResult.recordset[0].AffectedRows > 0) {
//             rowsAddedInThisProcess++;
//             console.log(`Row added/updated for ${dbType}:`, row.id);
//         }
//     }

//     if (result.rows.length > 0) {
//         // เปลี่ยนจาก lastupdate เป็น id
//         await updateLastProcessedId(sqlPool, result.rows[result.rows.length - 1].id, dbType);
//     }

//     return rowsAddedInThisProcess;
// }

// // ดึงข้อมูลที่เปลี่ยนเป็น doce = true ย้อนหลัง
// async function fetchRecentChangedBreakdowns(sqlPool, dbType, daysBack = 3) {
//     try {
//         console.log(`Fetching recently changed breakdowns (done = true) for ${dbType} in the last ${daysBack} days...`);
        
//         // คำนวณวันที่ย้อนหลังตามที่กำหนด
//         const pastDate = new Date();
//         pastDate.setDate(pastDate.getDate() - daysBack);
//         const formattedDate = pastDate.toISOString().split('T')[0]; // รูปแบบ YYYY-MM-DD

//         // ดึงข้อมูล ID เฉพาะ 3 วันล่าสุดที่มีอยู่ในฐานข้อมูลปลายทาง SQL Server
//         const existingIdsQuery = await sqlPool.request()
//             .input('SourceDB', sql.NVarChar(10), dbType)
//             .input('PastDate', sql.Date, formattedDate)
//             .query(`
//                 SELECT breakdownId
//                 FROM [Production_Analytics].[dbo].[BreakdownMaster]
//                 WHERE SourceDB = @SourceDB
//                 AND [Date] >= @PastDate
//             `);
        
//         // สร้าง Set ของ ID ที่มีอยู่แล้วเพื่อการค้นหาที่รวดเร็ว
//         const existingIds = new Set();
//         existingIdsQuery.recordset.forEach(record => {
//             existingIds.add(record.breakdownId);
//         });
        
//         console.log(`Found ${existingIds.size} existing records for ${dbType} in SQL Server`);
        
//         // คิวรี่ข้อมูลจาก PostgreSQL ที่มีสถานะ done = true และอัปเดตในช่วงวันที่กำหนด
//             const query = `
//             SELECT b.id, b.workmachine_id, b.workdate, b.bdst, b.bden, b.cause, b.notes, b.lastupdate, 
//                 c.causecode, c.description as cause_description, d.machinenumber
//             FROM public.breakdown b
//             LEFT JOIN public.bdcause c ON b.cause = c.id
//             LEFT JOIN public.workmachine d ON b.workmachine_id = d.id
//             WHERE b.done = true 
//             AND b.workdate >= $1
//             ORDER BY b.id
//         `;
        
//         const result = await (dbType === 'msw' ? 
//             postgres.queryMsw(query, [formattedDate]) : 
//             postgres.queryMswplus(query, [formattedDate]));
               
//         // กรองเฉพาะข้อมูลที่ยังไม่มีใน SQL Server
//         const newRecords = result.rows.filter(row => !existingIds.has(row.id));

//         let rowsAddedInThisProcess = 0;
        
//         // ดำเนินการกับข้อมูลใหม่
//         for (const row of newRecords) {
//             const downtime = row.bden && row.bdst ?
//                 (new Date(row.bden) - new Date(row.bdst)) / (1000 * 60) : null;
            
//             // ปรับเวลาเพิ่ม 7 ชั่วโมง
//             const adjustTime = (time) => {
//                 if (!time) return null;
//                 const adjusted = new Date(time);
//                 adjusted.setHours(adjusted.getHours() + 7);
//                 return adjusted;
//             };
            
//             const mergeResult = await sqlPool.request()
//                 .input('breakdownId', sql.Int, row.id)
//                 .input('MachineCode', sql.NVarChar(50), row.machinenumber)
//                 .input('Date', sql.Date, row.workdate)
//                 .input('bdst', sql.DateTime, adjustTime(row.bdst))
//                 .input('bden', sql.DateTime, adjustTime(row.bden))
//                 .input('CauseCode', sql.NVarChar(10), row.causecode)
//                 .input('Cause', sql.NVarChar(500), row.cause_description)
//                 .input('notes', sql.NVarChar(500), row.notes)
//                 .input('Downtime', sql.Float, downtime)
//                 .input('lastupdate', sql.DateTime, adjustTime(row.lastupdate))
//                 .input('SourceDB', sql.NVarChar(10), dbType)
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[BreakdownMaster] AS target
//                     USING (VALUES (@breakdownId, @SourceDB)) AS source(breakdownId, SourceDB)
//                     ON (target.breakdownId = source.breakdownId AND target.SourceDB = source.SourceDB)
//                     WHEN NOT MATCHED THEN
//                         INSERT (breakdownId, MachineCode, Date, bdst, bden, CauseCode,
//                         Cause, notes, Downtime, lastupdate, SourceDB)
//                         VALUES (@breakdownId, @MachineCode, DATEADD(DAY, 1, @Date), @bdst, @bden, @CauseCode,
//                         @Cause, @notes, @Downtime, @lastupdate, @SourceDB);

//                     SELECT @@ROWCOUNT AS AffectedRows;
//                 `);
            
//             if (mergeResult.recordset[0].AffectedRows > 0) {
//                 rowsAddedInThisProcess++;
//                 console.log(`New changed record added for ${dbType}:`, row.id);
//             }
//         }
        
//         console.log(`Total new changed records added for ${dbType}: ${rowsAddedInThisProcess}`);
//         return rowsAddedInThisProcess;
        
//     } catch (error) {
//         console.error(`Error fetching recent changed breakdowns for ${dbType}:`, error);
//         throw error;
//     }
// }

// // ฟังก์ชันหลักสำหรับตรวจสอบและดึงข้อมูลที่เปลี่ยนสถานะ
// async function checkRecentlyChangedBreakdowns(daysBack = 3) {
//     let sqlPool, rowsAdded = 0;
    
//     try {
//         console.log(`Starting process to check for breakdowns changed to done=true in the last ${daysBack} days...`);
        
//         sqlPool = await connectDestSql();
//         if (!sqlPool) {
//             throw new Error('Failed to connect to SQL Server database');
//         }
        
//         // โหลด Causes และ Waste ก่อน (ถ้าจำเป็น)
//         await loadCausesAndWaste(sqlPool);
        
//         // ดึงข้อมูลจาก msw
//         const mswChangedRowsAdded = await fetchRecentChangedBreakdowns(sqlPool, 'msw', daysBack);
//         console.log('Changed rows added from MSW:', mswChangedRowsAdded);
        
//         // ดึงข้อมูลจาก mswplus
//         const mswPlusChangedRowsAdded = await fetchRecentChangedBreakdowns(sqlPool, 'mswplus', daysBack);
//         console.log('Changed rows added from MSW PLUS:', mswPlusChangedRowsAdded);
        
//         rowsAdded = mswChangedRowsAdded + mswPlusChangedRowsAdded;
        
//         console.log(`Check for changed breakdowns completed. Total rows added: ${rowsAdded}`);
//         return { rowsAdded };
        
//     } catch (err) {
//         console.error('Error during check for changed breakdowns:', err);
//         throw err;
//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// }

// // สร้าง endpoint สำหรับรันแบบ manual - breakdown ตกหล่น
// router.get('/runCheckChangedBreakdowns', async (req, res) => {
//     try {
//         // ดึงค่า daysBack จาก query parameter หรือใช้ค่าเริ่มต้น 3 วัน
//         const daysBack = req.query.days ? parseInt(req.query.days) : 3;
        
//         console.log(`Starting manual check for changed breakdowns in the last ${daysBack} days...`);
//         const result = await checkRecentlyChangedBreakdowns(daysBack);
//         console.log('Changed breakdowns check completed. Result:', result);
        
//         res.json({
//             message: `Changed breakdowns check completed for the last ${daysBack} days`,
//             rowsAdded: result.rowsAdded,
//             timestamp: new Date().toISOString()
//         });
//         res.end();
//     } catch (error) {
//         console.error('Error during changed breakdowns check:', error);
//         res.status(500).json({ 
//             error: 'An error occurred during changed breakdowns check', 
//             details: error.message,
//             timestamp: new Date().toISOString()
//         });
//         res.end();
//     }
// });

// let isBreakdownProcessing = false;

// // ตั้งเวลาให้ทำงานอัตโนมัติ 2 ครั้งต่อวัน (เวลา 07:50 น. และ 19:50 น.)
// cron.schedule('50 07,19 * * *', async () => {
//     if (isBreakdownProcessing) {
//         console.log('Previous process still running, skipping this scheduled check');
//         return;
//     }
    
//     isBreakdownProcessing = true;
//     console.log('Running scheduled check for recently changed breakdowns...');
//     try {
//         // ตรวจสอบข้อมูลที่เปลี่ยนสถานะย้อนหลัง 3 วัน
//         const result = await checkRecentlyChangedBreakdowns(3);
//         console.log('Scheduled check for changed breakdowns completed. Result:', result);
//     } catch (error) {
//         console.error('Error during scheduled check for changed breakdowns:', error);
//     } finally {
//         isBreakdownProcessing = false;
//     }
// });

// // ดึงข้อมูล workshift
// async function incrementalLoadFromPostgres() {
//     let sqlPool, rowsAdded = 0;

//     try {
//         console.log('Starting Incremental Load process from PostgreSQL...');

//         sqlPool = await connectDestSql();
//         if (!sqlPool) {
//             throw new Error('Failed to connect to SQL Server database');
//         }
//         console.log('Successfully connected to SQL Server');

//         // ทดสอบการเชื่อมต่อ
//         try {
//             await sqlPool.request().query('SELECT 1');
//             console.log('SQL Server connection test successful');
//         } catch (testError) {
//             console.error('SQL Server connection test failed:', testError);
//             throw new Error('SQL Server connection test failed');
//         }

//         // โหลด Causes และ Waste ก่อน
//         await loadCausesAndWaste(sqlPool);

//         // ดึง ID ล่าสุดจาก SQL Server แยกตาม SourceDB สำหรับ breakdown
//         const lastMswIdResult = await sqlPool.request()
//             .input('SourceDB', sql.NVarChar(10), 'msw')
//             .query(`
//                 SELECT ISNULL(MAX(breakdownId), 0) AS LastProcessedId
//                 FROM [Production_Analytics].[dbo].[BreakdownMaster]
//                 WHERE SourceDB = @SourceDB
//             `);
        
//         const lastMswPlusIdResult = await sqlPool.request()
//             .input('SourceDB', sql.NVarChar(10), 'mswplus')
//             .query(`
//                 SELECT ISNULL(MAX(breakdownId), 0) AS LastProcessedId
//                 FROM [Production_Analytics].[dbo].[BreakdownMaster]
//                 WHERE SourceDB = @SourceDB
//             `);

//         const lastMswId = lastMswIdResult.recordset[0]?.LastProcessedId || 0;
//         const lastMswPlusId = lastMswPlusIdResult.recordset[0]?.LastProcessedId || 0;

//         console.log('Last MSW breakdown ID:', lastMswId);
//         console.log('Last MSWPLUS breakdown ID:', lastMswPlusId);

//         // Process MSW data - ใช้ ID ล่าสุดเฉพาะของ msw
//         const mswRowsAdded = await processDatabase(sqlPool, 'msw', lastMswId);
//         console.log('Rows added/updated from MSW:', mswRowsAdded);
//         rowsAdded += mswRowsAdded;

//         // Process MSW PLUS data - ใช้ ID ล่าสุดเฉพาะของ mswplus
//         const mswPlusRowsAdded = await processDatabase(sqlPool, 'mswplus', lastMswPlusId);
//         console.log('Rows added/updated from MSW PLUS:', mswPlusRowsAdded);
//         rowsAdded += mswPlusRowsAdded;

//         // แยกดึง ID ล่าสุดตาม SourceDB สำหรับ workshift
//         const lastMswWorkshiftId = await sqlPool.request().query(`
//             SELECT MAX(workshift_id) AS LastId
//             FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
//             WHERE SourceDB = 'msw'
//         `);

//         const lastMswplusWorkshiftId = await sqlPool.request().query(`
//             SELECT MAX(workshift_id) AS LastId
//             FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
//             WHERE SourceDB = 'mswplus'  
//         `);

//         const mswLastId = lastMswWorkshiftId.recordset[0]?.LastId || 0;
//         const mswplusLastId = lastMswplusWorkshiftId.recordset[0]?.LastId || 0;

//         console.log('Last MSW Workshift ID:', mswLastId);
//         console.log('Last MSWPLUS Workshift ID:', mswplusLastId);

//         // ดึง workshift แยกตาม source
//         const mswWorkshiftRowsAdded = await processWorkShift(sqlPool, 'msw', mswLastId);
//         const mswPlusWorkshiftRowsAdded = await processWorkShift(sqlPool, 'mswplus', mswplusLastId);
        
//         // รวมจำนวนแถวที่เพิ่ม/อัปเดตทั้งหมด
//         rowsAdded = mswRowsAdded + mswPlusRowsAdded + mswWorkshiftRowsAdded + mswPlusWorkshiftRowsAdded;

//         console.log(`Incremental Load completed. Total rows added/updated: ${rowsAdded}`);
//         return { rowsAdded };
//     } catch (err) {
//         console.error('Error during incremental load process:', err);
//         throw err;
//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//                 console.log('SQL Server connection closed successfully');
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// }

// async function getLastProcessedId(pool, tableName) {
//     try {
//         // ตรวจสอบว่าตารางมีอยู่จริง
//         const tableNames = ['BreakdownMaster', 'DailyWorkShiftMswAll'];
//         if (!tableNames.includes(tableName)) {
//             throw new Error(`Invalid table name: ${tableName}`);
//         }

//         let result = await pool.request().query(`
//             SELECT MAX(breakdownId) AS LastProcessedId
//             FROM [Production_Analytics].[dbo].[${tableName}]
//         `);

//         let lastId = result.recordset[0]?.LastProcessedId || 0;
        
//         return lastId;
//     } catch (err) {
//         console.error('Error getting last processed ID:', err);
//         return 0;  // กรณีไม่มีข้อมูลให้เริ่มจาก ID 0
//     }
// }

// async function updateLastProcessedTime(pool, newTime, dbType) {
//     try {
//         // ปรับเวลาเพิ่ม 7 ชั่วโมงก่อนบันทึก
//         const adjustedTime = new Date(newTime);
//         adjustedTime.setHours(adjustedTime.getHours() + 7);

//         await pool.request()
//             .input('newTime', sql.DateTime, adjustedTime)
//             .input('status', sql.NVarChar(50), 'Complete')
//             .input('message', sql.NVarChar(50), `Incremental load completed for ${dbType}`)
//             .input('dbType', sql.NVarChar(10), dbType)
//             .query(`
//                 INSERT INTO ProcessingLogPostgres
//                 (LastProcessedTime, Status, Message, SourceDB)
//                 VALUES
//                 (@newTime, @status, @message, @dbType)
//             `);

//         console.log(`ProcessingLog updated for ${dbType}`, adjustedTime)
//     } catch (err) {
//         console.error('Error updating last processed time:', err);
//     }
// }

// // เพิ่มฟังก์ชันใหม่สำหรับ workshift
// async function getLastProcessedWorkshiftId(pool, tableName) {
//     try {
//         // ตรวจสอบว่าเป็นตาราง workshift
//         if (tableName !== 'DailyWorkShiftMswAll') {
//             throw new Error(`Invalid table name for workshift: ${tableName}`);
//         }

//         let result = await pool.request().query(`
//             SELECT MAX(workshift_id) AS LastProcessedId
//             FROM [Production_Analytics].[dbo].[${tableName}]
//         `);
        
//         return result.recordset[0]?.LastProcessedId || 0;
//     } catch (err) {
//         console.error('Error getting last processed workshift id:', err);
//         return 0;
//     }
// }

// async function updateLastProcessedId(pool, newId, dbType) {
//     try {
//         await pool.request()
//             .input('newId', sql.Int, newId)
//             .input('newTime', sql.DateTime, new Date())  // ยังคงเก็บเวลาปัจจุบันไว้
//             .input('status', sql.NVarChar(50), 'Complete')
//             .input('message', sql.NVarChar(50), `Incremental load completed for ${dbType}`)
//             .input('dbType', sql.NVarChar(10), dbType)
//             .query(`
//                 INSERT INTO ProcessingLogPostgres
//                 (LastProcessedId, LastProcessedTime, Status, Message, SourceDB)
//                 VALUES
//                 (@newId, @newTime, @status, @message, @dbType)
//             `);

//         console.log(`ProcessingLog updated for ${dbType}, Last ID:`, newId)
//     } catch (err) {
//         console.error('Error updating last processed ID:', err);
//     }
// }

// // ดึง workshift (เวลาการทำงาน) ไปใช้กับฟังก์ชั่นหลัก
// async function processWorkShift(sqlPool, dbType, lastProcessedId) {
//     let rowsAddedInThisProcess = 0;

//     console.log(`Starting processWorkShift for ${dbType} with lastProcessedId: ${lastProcessedId}`);

//     const query = `
//         SELECT 
//             w.id, 
//             w.workmachine_id, 
//             w.workdate, 
//             w.shst, 
//             w.shen, 
//             w.lastupdate, 
//             m.machinenumber,
//             ROUND(EXTRACT(EPOCH FROM (w.shen - w.shst)) / 3600) AS working_hours,
//             ROUND(EXTRACT(EPOCH FROM (w.shen - w.shst)) / 60) AS working_minutes
//         FROM public.workshift w
//         LEFT JOIN public.workmachine m ON w.workmachine_id = m.id
//         WHERE w.id > $1
//         ORDER BY w.id
//     `;

//     try {
//         console.log(`Executing query for ${dbType}...`);
//         const result = await (dbType === 'msw' ? 
//             postgres.queryMsw(query, [lastProcessedId]) : 
//             postgres.queryMswplus(query, [lastProcessedId]));
        
//         console.log(`Query completed for ${dbType}. Found ${result.rows.length} records`);

//         if (result.rows.length === 0) {
//             console.log(`No new records found for ${dbType}`);
//             return 0;
//         }

//         console.log(`First record ID for ${dbType}:`, result.rows[0]?.id);
//         console.log(`Last record ID for ${dbType}:`, result.rows[result.rows.length - 1]?.id);

//         let processedIds = new Set();

//         for (const row of result.rows) {
//             if (processedIds.has(row.id)) {
//                 continue;
//             }

//             const adjustTime = (time) => {
//                 if (!time) return null;
//                 const adjusted = new Date(time);
//                 adjusted.setHours(adjusted.getHours() + 7);
//                 return adjusted;
//             };

//             const mergeResult = await sqlPool.request()
//                 .input('workshift_id', sql.Int, row.id)
//                 .input('MachineCode', sql.NVarChar(50), row.machinenumber)
//                 .input('workdate', sql.Date, row.workdate)
//                 .input('shst', sql.DateTime, adjustTime(row.shst))
//                 .input('shen', sql.DateTime, adjustTime(row.shen))
//                 .input('working_hours', sql.Int, row.working_hours)
//                 .input('working_minutes', sql.Int, row.working_minutes)  // เพิ่มนาที
//                 .input('lastupdate', sql.DateTime, adjustTime(row.lastupdate))
//                 .input('SourceDB', sql.NVarChar(10), dbType)
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[DailyWorkShiftMswAll] AS target
//                     USING (VALUES (@workshift_id, @SourceDB)) AS source(workshift_id, SourceDB)
//                     ON (target.workshift_id = source.workshift_id AND target.SourceDB = source.SourceDB)
//                     WHEN MATCHED THEN
//                         UPDATE SET
//                         MachineCode = @MachineCode,
//                         workdate = DATEADD(DAY, 1, @workdate),
//                         shst = @shst,
//                         shen = @shen,
//                         working_hours = @working_hours,
//                         working_minutes = @working_minutes,  
//                         lastupdate = @lastupdate
//                     WHEN NOT MATCHED THEN
//                         INSERT (workshift_id, MachineCode, workdate, shst, shen, working_hours, working_minutes, lastupdate, SourceDB)
//                         VALUES (@workshift_id, @MachineCode, DATEADD(DAY, 1,@workdate), @shst, @shen, @working_hours, @working_minutes, @lastupdate, @SourceDB);

//                     SELECT @@ROWCOUNT AS AffectedRows;
//                 `);

//             if (mergeResult.recordset[0].AffectedRows > 0) {
//                 rowsAddedInThisProcess++;
//                 processedIds.add(row.id);
//                 console.log(`Workshift row added/updated for ${dbType}:`, row.id);
//             }
//         }

//         if (result.rows.length > 0) {
//             await updateLastProcessedWorkshiftId(sqlPool, result.rows[result.rows.length - 1].id, `${dbType}_workshift`);
//         }

//         console.log(`Completed processing ${rowsAddedInThisProcess} records for ${dbType}`);
//         return rowsAddedInThisProcess;

//     } catch (error) {
//         console.error(`Error processing workshift for ${dbType}:`, error);
//         throw error;
//     }
// }

// router.get('/runIncrementalLoadFromPostgres', async (req, res) => {
//     try {
//         console.log('Starting incremental load process...');
//         const result = await incrementalLoadFromPostgres();
//         console.log('Incremental load process completed. Result:', result);
//         res.json({
//             message: 'Incremental load process from PostgreSQL Complete',
//             rowsAdded: result.rowsAdded,
//             timestamp: new Date().toISOString()
//         });
//         // เพิ่ม response end เพื่อจบการทำงาน
//         res.end();
//     } catch (error) {
//         console.error('Error during incremental load from PostgreSQL:', error);
//         res.status(500).json({ 
//             error: 'An error occurred during incremental load', 
//             details: error.message,
//             timestamp: new Date().toISOString()
//         });
//         res.end();
//     }
// });

// let isProcessing = false;
// // ตั้งเวลาให้ทำงานทุกๆ 1 ชั่วโมง
// cron.schedule('0 * * * *', async () => {
//     if (isProcessing) {
//         console.log('Previous process still running, skipping this run');
//         return;
//     }
    
//     isProcessing = true;
//     console.log('Running scheduled incremental load...');
//     try {
//         const result = await incrementalLoadFromPostgres();
//         console.log('Scheduled incremental load completed. Result:', result);

//         // // ดึง workcentertest ของ CGM
//         // sqlPool = await connectDestSql();
//         // console.log('Starting workcentertest data...');
//         // const workcenterResult = await syncWorkcenterTestData(sqlPool);
//         // console.log('Workcentertest sync completed:', workcenterResult);

//         // // ดึง workordertest ของ CGM
//         // console.log('Starting workordertest data...');
//         // const workorderResult = await syncWorkorderTestData(sqlPool);
//         // console.log('Workordertest sync completed:', workorderResult);

//     } catch (error) {
//         console.error('Error during scheduled incremental load:', error);
//     } finally {
//         isProcessing = false;
//     }
// });

// // ตั้งเวลาให้ทำงานทุกวันเวลา 18:30 น. (6 โมงเย็น)
// // cron.schedule('40 18 * * *', async () => {
// //     console.log('Cron job triggered at:', new Date().toLocaleString());
    
// //     if (isProcessing) {
// //         console.log('Previous process still running, skipping this run');
// //         return;
// //     }
    
// //     isProcessing = true;
// //     console.log('Running scheduled incremental load...');
// //     try {
// //         const result = await incrementalLoadFromPostgres();
// //         console.log('Scheduled incremental load completed. Result:', result);
        
// //     } catch (error) {
// //         console.error('Error during scheduled incremental load:', error);
// //     } finally {
// //         isProcessing = false;
// //     }
// // });

// console.log('Incremental load scheduler started. Will run every hour.');

// router.get('/runWorkshiftManual', async (req, res) => {
//     let sqlPool;
//     try {
//         console.log('Starting manual workshift load process...');
//         sqlPool = await connectDestSql();
        
//         if (!sqlPool) {
//             throw new Error('Failed to connect to SQL Server database');
//         }

//         // แยกดึง ID ล่าสุดตาม SourceDB
//         const lastMswId = await sqlPool.request().query(`
//             SELECT MAX(workshift_id) AS LastId 
//             FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
//             WHERE SourceDB = 'msw'
//         `);

//         const lastMswplusId = await sqlPool.request().query(`
//             SELECT MAX(workshift_id) AS LastId 
//             FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
//             WHERE SourceDB = 'mswplus'
//         `);

//         const mswLastId = lastMswId.recordset[0]?.LastId || 0;
//         const mswplusLastId = lastMswplusId.recordset[0]?.LastId || 0;

//         console.log('Last MSW ID:', mswLastId);
//         console.log('Last MSWPLUS ID:', mswplusLastId);

//         console.log('Processing MSW...');
//         const mswWorkshiftRowsAdded = await processWorkShift(sqlPool, 'msw', mswLastId);
//         console.log('MSW completed. Rows added:', mswWorkshiftRowsAdded);

//         console.log('Processing MSWPLUS...');
//         const mswPlusWorkshiftRowsAdded = await processWorkShift(sqlPool, 'mswplus', mswplusLastId);
//         console.log('MSWPLUS completed. Rows added:', mswPlusWorkshiftRowsAdded);

//         const totalRowsAdded = mswWorkshiftRowsAdded + mswPlusWorkshiftRowsAdded;

//         res.json({
//             message: 'Manual workshift load completed',
//             totalRowsAdded,
//             mswWorkshiftRowsAdded,
//             mswPlusWorkshiftRowsAdded,
//             timestamp: new Date().toISOString()
//         });

//     } catch (error) {
//         console.error('Error during manual workshift load:', error);
//         res.status(500).json({ 
//             error: 'An error occurred during manual workshift load', 
//             details: error.message,
//             timestamp: new Date().toISOString()
//         });
//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//                 console.log('SQL Server connection closed');
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// });

// async function processWorkcenterTestData(sqlPool, dbType) {
//     let rowsAddedInThisProcess = 0;
//     // const query = `
//     //     SELECT b.id, b.workmachine_id, b.workdate, b.bdst, b.bden, b.cause, b.notes, b.lastupdate, 
//     //            c.causecode, c.description as cause_description, d.machinenumber
//     //     FROM public.breakdown b
//     //     LEFT JOIN public.bdcause c ON b.cause = c.id
//     //     LEFT JOIN public.workmachine d ON b.workmachine_id = d.id
//     //     WHERE b.done = true AND b.lastupdate > $1
//     //     ORDER BY b.lastupdate
//     // `;

//     // ดึง ID ล่าสุดจาก SQL Server ตามแต่ละ SourceDB
//     const lastIdResult = await sqlPool.request()
//         .input('SourceDB', sql.Bit, dbType === 'msw' ? 0 : 1)
//         .query(`
//             SELECT ISNULL(MAX(workcentertestID), 0) as lastId
//             FROM [Production_Analytics].[dbo].[getWorkcenterTestData]
//             WHERE SourceDB = @SourceDB
//         `);

//     const lastProcessedId = lastIdResult.recordset[0].lastId;

//     const query = `
//         SELECT wct.id, wct.workorder_id, wct.workseq, wct.workmachine_id, wct.approved, wct.approvedate,
//             wct.lastupdate, wct.docnumber, wct.transdate, wct.inspector_id, wct.inspectedtime, wct.qctime,
//             wct.coltest, wct.datatest
//         FROM public.workcentertest wct
//         LEFT JOIN public.workmachine d ON wct.workmachine_id = d.id
//         WHERE d.workcenter_id = 94
//         AND d.id NOT IN (261895, 12, 11, 10, 9, 8)
//         AND wct.id > $1
//         ORDER BY wct.id
//     `;

//     // เลือกใช้ database ตาม dbType
//     const result = await (dbType === 'msw' ? 
//         postgres.queryMsw(query, [lastProcessedId]) : 
//         postgres.queryMswplus(query, [lastProcessedId]));
//     console.log(`Number of new records for ${dbType}:`, result.rows.length);

//     for (const row of result.rows) {
//         // ปรับเวลาเพิ่ม 7 ชั่วโมง
//         const adjustTime = (time) => {
//             if (!time) return null;
//             const adjusted = new Date(time);
//             adjusted.setHours(adjusted.getHours() + 7);
//             return adjusted;
//         };

//         const mergeResult = await sqlPool.request()
//             .input('workcentertestID', sql.Int, row.id)
//             .input('workorder_id', sql.Int, row.workorder_id)
//             .input('workseq', sql.Int, row.workseq)
//             .input('workmachine_id', sql.Int, row.workmachine_id)
//             .input('approved', sql.NVarChar(10), row.approved)
//             .input('approvedate', sql.DateTime, adjustTime(row.approvedate))
//             .input('lastupdate', sql.DateTime, adjustTime(row.lastupdate))
//             .input('docnumber', sql.NVarChar(50), row.docnumber)
//             .input('transdate', sql.Date, row.transdate)
//             .input('inspector_id', sql.Int, row.inspector_id)
//             .input('inspectedtime', sql.DateTime, adjustTime(row.inspectedtime))
//             .input('qctime', sql.DateTime, adjustTime(row.qctime))
//             .input('coltest', sql.NVarChar(500), row.coltest)
//             .input('datatest', sql.NVarChar(500), row.datatest)
//             .input('SourceDB', sql.Bit, dbType === 'msw' ? 0 : 1)
//             .query(`
//                 MERGE INTO [Production_Analytics].[dbo].[getWorkcenterTestData] AS target
//                 USING (VALUES (@workcentertestID, @SourceDB)) AS source(workcentertestID, SourceDB)
//                 ON (target.workcentertestID = source.workcentertestID AND target.SourceDB = source.SourceDB)
//                 WHEN NOT MATCHED THEN
//                     INSERT (workcentertestID, workorder_id, workseq, workmachine_id, approved, approvedate, lastupdate,
//                         docnumber, transdate, inspector_id, inspectedtime, qctime, coltest, datatest, SourceDB)
//                     VALUES (@workcentertestID, @workorder_id, @workseq, @workmachine_id, @approved, @approvedate, @lastupdate,
//                         @docnumber, DATEADD(DAY, 1, @transdate), @inspector_id, @inspectedtime, @qctime, @coltest, 
//                         @datatest, @SourceDB);

//                 SELECT @@ROWCOUNT AS AffectedRows;
//             `);

//         if (mergeResult.recordset[0].AffectedRows > 0) {
//             rowsAddedInThisProcess++;
//             console.log(`Row added/updated for ${dbType}:`, row.id);
//         }
//     }

//     // if (result.rows.length > 0) {
//     //     await updateLastProcessedId(sqlPool, result.rows[result.rows.length -1].id, dbType);
//     // }
//     return rowsAddedInThisProcess;
// }

// // Manual breakdown
// router.get('/runBreakdownManual', async (req, res) => {
//     let sqlPool;
//     try {
//         console.log('Starting manual breakdown load process...');
//         sqlPool = await connectDestSql();
        
//         if (!sqlPool) {
//             throw new Error('Failed to connect to SQL Server database');
//         }

//         // โหลด Causes และ Waste ก่อน
//         await loadCausesAndWaste(sqlPool);

//         // ดึง ID ล่าสุดจาก SQL Server แยกตาม SourceDB
//         const lastMswIdResult = await sqlPool.request()
//             .input('SourceDB', sql.NVarChar(10), 'msw')
//             .query(`
//                 SELECT ISNULL(MAX(breakdownId), 0) AS LastProcessedId
//                 FROM [Production_Analytics].[dbo].[BreakdownMaster]
//                 WHERE SourceDB = @SourceDB
//             `);
        
//         const lastMswPlusIdResult = await sqlPool.request()
//             .input('SourceDB', sql.NVarChar(10), 'mswplus')
//             .query(`
//                 SELECT ISNULL(MAX(breakdownId), 0) AS LastProcessedId
//                 FROM [Production_Analytics].[dbo].[BreakdownMaster]
//                 WHERE SourceDB = @SourceDB
//             `);

//         const lastMswId = lastMswIdResult.recordset[0]?.LastProcessedId || 0;
//         const lastMswPlusId = lastMswPlusIdResult.recordset[0]?.LastProcessedId || 0;

//         console.log('Last MSW breakdown ID:', lastMswId);
//         console.log('Last MSWPLUS breakdown ID:', lastMswPlusId);

//         // Process MSW data
//         const mswRowsAdded = await processDatabase(sqlPool, 'msw', lastMswId);
//         console.log('Rows added/updated from MSW:', mswRowsAdded);

//         // Process MSW PLUS data
//         const mswPlusRowsAdded = await processDatabase(sqlPool, 'mswplus', lastMswPlusId);
//         console.log('Rows added/updated from MSW PLUS:', mswPlusRowsAdded);

//         const totalRowsAdded = mswRowsAdded + mswPlusRowsAdded;

//         res.json({
//             message: 'Manual breakdown load completed',
//             totalRowsAdded,
//             mswRowsAdded,
//             mswPlusRowsAdded,
//             timestamp: new Date().toISOString()
//         });
//         res.end();

//     } catch (error) {
//         console.error('Error during manual breakdown load:', error);
//         res.status(500).json({ 
//             error: 'An error occurred during manual breakdown load', 
//             details: error.message,
//             timestamp: new Date().toISOString()
//         });
//         res.end();
//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//                 console.log('SQL Server connection closed');
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// });

// // เรียกใช้งาน processWorkcenterTestData
// async function syncWorkcenterTestData(sqlPool) {
//     try {
//         // ดึงข้อมูลจาก msw
//         const mswRows = await processWorkcenterTestData(sqlPool, 'msw');
//         console.log('MSW rows Processed:', mswRows);

//         // ดึงข้อมูลจาก mswplus
//         const mswplusRows = await processWorkcenterTestData(sqlPool, 'mswplus');
//         console.log('MSWPlus rows processed:', mswplusRows);

//         return { mswRows, mswplusRows };
//     } catch (error) {
//         console.error('Error syncing workcenter test data:', error);
//         throw error;
//     }
// }

// // syncWorkcenterTestData แบบ manual
// router.get('/runWorkcenterTestManual', async (req, res) => {
//     let sqlPool;

//     try {
//         console.log('Starting manual workcenter test sync...');
//         sqlPool = await connectDestSql();

//         const result = await syncWorkcenterTestData(sqlPool);

//         res.json({
//             message: 'Manual workcenter test sync completed',
//             result,
//             timestamp: new Date().toISOString()
//         });

//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//                 console.log('SQL Server connection closed');
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// });

// async function processWorkOrderTestData(sqlPool, dbType) {
//     let rowsAddedInThisProcess = 0;
//     try {

//         // ดึงข้อมูล
//         const lastIdResult = await sqlPool.request()
//             .input('SourceDB', sql.Bit, dbType === 'msw' ? 0 : 1)
//             .query(`
//                 SELECT ISNULL(MAX(workordertestID), 0) as lastId
//                 FROM [Production_Analytics].[dbo].[getWorkorderTestData]
//                 WHERE SourceDB = @SourceDB
//             `);

//         // ดึง ID ล่าสุดจาก SQL Server ตามแต่ละ SourceDB
//         const lastProcessedId = lastIdResult.recordset[0].lastId;
        
//         const query = `
//             SELECT wot.id, wot.workorder_id, wot.workcenter_id, wot.workseq, wot.workmachine_id, wot.inspectedtime, wot.docnumber,
//                 wot.transdate, wot.approved, wot.ntime
//             FROM public.workordertest wot
//             LEFT JOIN public.workmachine d ON wot.workmachine_id = d.id
//             WHERE d.workcenter_id = 94
//             AND d.id NOT IN (261895, 12, 11, 10, 9, 8)
//             AND wot.id > $1
//             ORDER BY wot.id
//         `;

//         // เลือกใช้ database ตาม dbType
//         const result = await (dbType === 'msw' ? 
//             postgres.queryMsw(query, [lastProcessedId]) :
//             postgres.queryMswplus(query, [lastProcessedId]));
//         console.log(`Number of new records for ${dbType}:`, result.rows.length);

//         for (const row of result.rows) {
//             // ปรับเวลาเพิ่ม 7 ชั่วโมง
//             const adjustTime = (time) => {
//                 if (!time) return null;
//                 const adjusted = new Date(time);
//                 adjusted.setHours(adjusted.getHours() + 7);
//                 return adjusted;
//             };

//             const mergeResult = await sqlPool.request()
//                 .input('workordertestID', sql.Int, row.id)
//                 .input('workorder_id', sql.Int, row.workorder_id)
//                 .input('workcenter_id', sql.Int, row.workcenter_id)
//                 .input('workseq', sql.Int, row.workseq)
//                 .input('workmachine_id', sql.Int, row.workmachine_id)
//                 .input('inspectedtime', sql.Int, adjustTime(row.inspectedtime))
//                 .input('docnumber', sql.NVarChar(50), row.docnumber)
//                 .input('transdate', sql.Date, row.transdate)
//                 .input('approved', sql.NVarChar(10), row.approved)
//                 .input('ntime', sql.Int, row.ntime)
//                 .input('SourceDB', sql.Bit, dbType === 'msw' ? 0 : 1)
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[getWorkorderTestData] AS target
//                     USING (VALUES (@workordertestID, @SourceDB)) AS source(workordertestID, SourceDB)
//                     ON (target.workordertestID = source.workordertestID AND target.SourceDB = source.SourceDB)
//                     WHEN NOT MATCHED THEN
//                         INSERT (workordertestID, workorder_id, workcenter_id, workseq, workmachine_id,
//                             inspectedtime, docnumber, transdate, approved, ntime, SourceDB)
//                         VALUES (@workordertestID, @workorder_id, @workcenter_id, @workseq, @workmachine_id,
//                             @inspectedtime, @docnumber, @transdate, @approved, @ntime, @SourceDB);

//                     SELECT @@ROWCOUNT AS AffectedRows;
//                 `);
//             if (mergeResult.recordset[0].AffectedRows > 0) {
//                 rowsAddedInThisProcess++;
//                 console.log(`Row added/updated for ${dbType}:`, row.id);
//             }

//         }
//         return rowsAddedInThisProcess;
//     } catch (error) {
//         console.error(`Error processing workorder test data for ${dbType}:`, error);
//         throw error;
//     }
// }

// async function syncWorkorderTestData(sqlPool) {
//     try {
//         // ดึงข้อมูลจาก msw
//         const mswRows = await processWorkOrderTestData(sqlPool, 'msw');
//         console.log('MSW rows Processed:', mswRows);

//         // ดึงข้อมูลจาก mswplus
//         const mswplusRows = await processWorkOrderTestData(sqlPool, 'mswplus');
//         console.log('MSWPlus rows processed:', mswplusRows);

//         return { mswRows, mswplusRows };
//     } catch (error) {
//         console.error('Error syncing workordertestdata', error);
//         throw error;
//     }
// }

// // syncWorkorderTestData แบบ manual
// router.get('/runWorkorderTestManual', async(req, res) => {
//     let sqlPool;
    
//     try {
//         console.log('Starting manual workordertest sync...');
//         sqlPool = await connectDestSql();
        
//         if (!sqlPool) {
//             throw new Error('Failed to connect to SQL Server database');
//         }

//         const result = await syncWorkorderTestData(sqlPool);

//         res.json({
//             status: 'success',
//             message: 'Manual workordertest sync complete',
//             result,
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error('Error in workordertest sync:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'An error occurred during workordertest sync',
//             error: error.message,
//             timestamp: new Date().toISOString()
//         });
//     } finally {
//         if (sqlPool) {
//             try {
//                 await sqlPool.close();
//                 console.log('SQL Server connection closed');
//             } catch (closeError) {
//                 console.error('Error closing SQL Server connection:', closeError);
//             }
//         }
//     }
// });

// module.exports = router;