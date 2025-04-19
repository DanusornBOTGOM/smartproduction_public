// Import Express
const express = require('express')
const sql = require('mssql');

// Import Moment เพื่อไว้จัดรูปแบบวันที่
const moment = require('moment-timezone');
// แทนที่จะโหลดข้อมูล timezone จากไฟล์ ใช้วิธีนี้แทน
moment.tz.setDefault("Asia/Bangkok")

const { Mutex } = require('async-mutex');

const incrementalLoadMutex = new Mutex();

//import node-cache
// const NodeCache = require('node-cache');
const { title } = require('process');
// const myCache = new NodeCache({ stdTTL: 300 }); // แคช 5 นาที

const router = express.Router()
const cron = require('node-cron')

// Import SQL Menam WMSOneWIP และ SQL Test
const { connectSourceSql, connectDestSql } = require('../config/sqldb_dbconfig');
const { route } = require('./api');
let dbSQL;

async function initializeDatabase() {
    try {
        // ถ้าไม่มี connection หรือ connection ถูกตัด
        if (!dbSQL || !dbSQL.connected) {
            dbSQL = await connectDestSql();
            if (dbSQL) {
                console.log('Connected to MSSQL and MSW-Barcode API');
            } else {
                console.error('Failed to connect MSSQL and MSW-Barcode API');
            }
        }
    } catch (err) {
        console.error('Error initializing database connection:', err);
        dbSQL = null; // รีเซ็ตเมื่อมี error
    }
}

// เริ่มต้น connection
initializeDatabase();

// ตรวจสอบ connection ทุก 40 นาที
setInterval(initializeDatabase, 2400000);

// สำหรับกราฟ Bar-chart-ฺBAR2 ทำแยกเพราะลองรวมทุกอย่างใน api เดียวแล้วซับซ้อนไป
router.get('/chartProductionData', async (req, res) => {
    const { startDate, endDate, machineCodePrefix, additionalMachineCodes } = req.query;
    
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        let machineCodeFilter = '';
        if (machineCodePrefix === 'CUT') {
            machineCodeFilter = `AND (MachineCode LIKE 'CUT%'`;
            if (additionalMachineCodes) {
                machineCodeFilter += ` OR MachineCode IN ('${additionalMachineCodes.split(',').join("','")}')`;
            }
            machineCodeFilter += ')';
        } 

        const query = `
            WITH DailyPlan AS (
                SELECT 
                    MachineCode,
                    SUM(ProductionQuantity) AS TotalPlan
                FROM 
                    [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE 
                    ProductionDate BETWEEN @startDate AND @endDate
                    ${machineCodeFilter}
                GROUP BY
                    MachineCode
            ),
            DailyActual AS (
                SELECT 
                    MachineCode,
                    SUM(CASE 
                        WHEN MachineCode IN ('CO2001', 'CO2002', 'CO2003') AND ItemType = 'FG' THEN printWeight
                        WHEN MachineCode NOT IN ('CO2001', 'CO2002', 'CO2003') AND ItemType = 'WIP' THEN printWeight
                        ELSE 0 
                    END) AS TotalActual,
                    SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS TotalNG
                FROM 
                    [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE 
                    PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
                    ${machineCodeFilter}
                    AND Isdelete = 0
                    AND ItemType != 'RM'
                GROUP BY 
                    MachineCode
            )
            SELECT 
                COALESCE(p.MachineCode, a.MachineCode) AS MachineCode,
                ISNULL(p.TotalPlan, 0) AS PlanQuantity,
                ISNULL(a.TotalActual, 0) AS ActualQuantity,
                ISNULL(a.TotalNG, 0) AS NgQuantity
            FROM 
                DailyPlan p
            FULL OUTER JOIN 
                DailyActual a ON p.MachineCode = a.MachineCode
            ORDER BY
                COALESCE(p.MachineCode, a.MachineCode)
        `;

        const result = await dbSQL.request()
            .input('startDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// สำหรับกราฟ Bar-chart-Profile ทำแยกเพราะลองรวมทุกอย่างใน api เดียวแล้วซับซ้อนไป
router.get('/chartProductionDataPRO', async (req, res) => {
    const { startDate, endDate } = req.query;
    
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const query = `
            WITH DailyPlan AS (
                SELECT 
                    MachineCode,
                    SUM(ProductionQuantity) AS TotalPlan
                FROM 
                    [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE 
                    ProductionDate BETWEEN @startDate AND @endDate
                    AND MachineCode LIKE 'PRO%'
                GROUP BY
                    MachineCode
            ),
            DailyActual AS (
                SELECT 
                    MachineCode,
                    SUM(CASE WHEN ItemType = 'WIP' THEN printWeight ELSE 0 END) AS TotalActual,
                    SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS TotalNG
                FROM 
                    [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE 
                    PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
                    AND MachineCode LIKE 'PRO%'
                    AND Isdelete = 0
                GROUP BY 
                    MachineCode
            )
            SELECT 
                COALESCE(p.MachineCode, a.MachineCode) AS MachineCode,
                ISNULL(p.TotalPlan, 0) AS PlanQuantity,
                ISNULL(a.TotalActual, 0) AS ActualQuantity,
                ISNULL(a.TotalNG, 0) AS NgQuantity
            FROM 
                DailyPlan p
            FULL OUTER JOIN 
                DailyActual a ON p.MachineCode = a.MachineCode
            ORDER BY
                COALESCE(p.MachineCode, a.MachineCode)
        `;

        const result = await dbSQL.request()
            .input('startDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error for PRO machines:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data for PRO machines', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.get('/chartProductionDataCGM', async (req, res) => {
    const { startDate, endDate } = req.query;
    
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const result = await dbSQL.request()
            .input('startDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .input('machineCodePrefix', sql.NVarChar(50), 'CGM')
            .execute('GetAggregatedProductionDataForDateRange4');

        console.log('Query executed successfully. Rows returned:', result.recordset.length);

        const formattedResult = result.recordset.map(row => ({
            MachineCode: row.MachineCode,
            PlanQuantity: Number(row.PlanQuantity) || 0,
            ActualQuantity: Number(row.ActualQuantity) || 0,
            AdjustedActualQuantity: Number(row.AdjustedActualQuantity) || 0,
            Percentage: Number(row.Percentage) || 0,
            LastPrintTime: row.LastPrintTime,
            Remark: row.Remark,
            CustName: row.CustName,
            OrderWeight: row.OrderWeight,
            SizeIn: row.SizeIn,
            SizeOut: row.SizeOut,
            PartName: row.PartName,
            CurrentStep: row.CurrentStep,
            PlanStep: row.PlanStep
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Error in /api/chartProductionDataCGM:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.get('/weeklyProductionDataCGM', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const query = `
        WITH PlanData AS 
        (
            SELECT
                MachineCode,
                DocNo,
                SUM(ProductionQuantity) AS [Plan],
                ProductionDate
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate BETWEEN @startDate AND @endDate
                AND MachineCode LIKE 'CGM%'
            GROUP BY
                MachineCode, DocNo, ProductionDate  
        ),
        ProductionData AS 
        (
            SELECT 
                MachineCode,
                DocNo,
                SUM(printWeight) AS TotalWIPWeight,
                CAST(DATEADD(HOUR, -8, PrintTime) AS DATE) AS ProductionDate
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@startDate AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                AND ItemType != 'NG' AND Isdelete = 0
                AND MachineCode LIKE 'CGM%'
            GROUP BY
                MachineCode, DocNo, CAST(DATEADD(HOUR, -8, PrintTime) AS DATE)
        ),
        TotalActualByDocNoAndDate AS (
            SELECT 
                DocNo,
                ProductionDate,
                SUM(TotalWIPWeight) AS TotalActualWeight
            FROM 
                ProductionData
            GROUP BY 
                DocNo,
                ProductionDate
        ),
        DocNoToSplitByDate AS (
            SELECT 
                COALESCE(p.DocNo, pd.DocNo) AS DocNo,
                COALESCE(p.ProductionDate, pd.ProductionDate) AS ProductionDate,
                COUNT(DISTINCT COALESCE(p.MachineCode, pd.MachineCode)) AS PlannedMachineCount,
                COALESCE(ta.TotalActualWeight, 0) AS TotalActualWeight
            FROM 
                PlanData p
            FULL OUTER JOIN
                ProductionData pd ON p.DocNo = pd.DocNo AND p.ProductionDate = pd.ProductionDate
            LEFT JOIN
                TotalActualByDocNoAndDate ta ON COALESCE(p.DocNo, pd.DocNo) = ta.DocNo 
                                           AND COALESCE(p.ProductionDate, pd.ProductionDate) = ta.ProductionDate
            GROUP BY
                COALESCE(p.DocNo, pd.DocNo),
                COALESCE(p.ProductionDate, pd.ProductionDate),
                ta.TotalActualWeight
        ),
        DetailedData AS (
            SELECT 
                COALESCE(p.MachineCode, pd.MachineCode) AS MachineCode,
                p.[Plan],
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM PlanData p2 
                        WHERE p2.DocNo = COALESCE(p.DocNo, pd.DocNo)
                        AND p2.MachineCode != COALESCE(p.MachineCode, pd.MachineCode)
                        AND dts.PlannedMachineCount > 1
                    ) 
                    AND p.MachineCode IS NULL THEN 0
                    WHEN dts.PlannedMachineCount > 1 
                    THEN CAST(dts.TotalActualWeight AS FLOAT) / CAST(dts.PlannedMachineCount AS FLOAT)
                    ELSE COALESCE(pd.TotalWIPWeight, 0)
                END AS AdjustedActual
            FROM 
                PlanData p
            FULL OUTER JOIN
                ProductionData pd ON p.MachineCode = pd.MachineCode 
                                AND p.DocNo = pd.DocNo 
                                AND p.ProductionDate = pd.ProductionDate
            LEFT JOIN
                DocNoToSplitByDate dts ON COALESCE(p.DocNo, pd.DocNo) = dts.DocNo
                                    AND COALESCE(p.ProductionDate, pd.ProductionDate) = dts.ProductionDate
        )
        SELECT 
            MachineCode,
            SUM(COALESCE([Plan], 0)) AS PlanQuantity,
            SUM(COALESCE(AdjustedActual, 0)) AS ActualQuantity,
            SUM(COALESCE(AdjustedActual, 0)) AS AdjustedActualQuantity,
            CASE 
                WHEN SUM(COALESCE([Plan], 0)) > 0 
                THEN (SUM(COALESCE(AdjustedActual, 0)) / SUM(COALESCE([Plan], 0))) * 100
                ELSE 0 
            END AS Percentage
        FROM 
            DetailedData
        GROUP BY 
            MachineCode
        ORDER BY 
            MachineCode;
        `;

        const result = await dbSQL.request()
            .input('startDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .query(query);

        console.log(`Query executed successfully. Rows returned: ${result.recordset.length}`);

        const formattedResult = result.recordset.map(row => ({
            MachineCode: row.MachineCode,
            PlanQuantity: Number(row.PlanQuantity) || 0,
            ActualQuantity: Number(row.ActualQuantity) || 0,
            AdjustedActualQuantity: Number(row.AdjustedActualQuantity) || 0,
            Percentage: Number(row.Percentage) || 0
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Error in /api/weeklyProductionDataCGM:', err);
        res.status(500).json({
            error: 'An error occurred while fetching data',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.get('/chartProductionDataBAR1', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        if(!dbSQL) {
            throw new Error('Database connection is not established')
        }

    const query = `
            WITH DailyPlan AS (
            SELECT 
                MachineCode,
                SUM(ProductionQuantity) AS TotalPlan
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate BETWEEN @startDate AND @endDate
                AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
            GROUP BY
                MachineCode
            ),
            DailyActual AS (
                SELECT
                    MachineCode,
                    SUM(CASE WHEN ItemType IN ('WIP', 'FG') THEN printWeight ELSE 0 END) AS TotalActual,
                    SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS TotalNG
                FROM
                    [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE
                    PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
                    AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022' OR MachineCode = 'TWR001' OR MachineCode = 'ANB001' OR MachineCode = 'STN004')
                    AND Isdelete = '0'
                GROUP BY
                    MachineCode
            )
            SELECT
                COALESCE(p.MachineCode, a.MachineCode) AS MachineCode,
                ISNULL(p.TotalPlan, 0) AS PlanQuantity,
                ISNULL(a.TotalActual, 0) AS ActualQuantity,
                ISNULL(a.TotalNG, 0) AS NgQuantity
            FROM
               DailyPlan p
            FULL OUTER JOIN
                DailyActual a ON p.MachineCode = a.MachineCode
            ORDER BY
                COALESCE(p.MachineCode, a.MachineCode)
        `;

        const result = await dbSQL.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .query(query);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error for Combine machine:', err);
        res.status(500).json({
            error: 'An error occurred while executing Combine machine',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.get('/wasteChartData', async (req, res) => {
    const { startDate, endDate, machineCodePrefix } = req.query;
    
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด' });
        }

        if (!dbSQL) {
            throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
        }

        // สร้างเงื่อนไขการกรองเครื่องจักร
        const machineFilter = machineCodePrefix ? 
            `AND MachineCode LIKE '${machineCodePrefix}%'` : '';

        const query = `
            SELECT 
                MachineCode,
                PrintTime,
                ItemCode,
                PartName,
                printWeight AS WasteQuantity
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) 
                AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
                AND ItemType = 'NG' 
                AND ItemCode NOT LIKE 'NW%'
                ${machineFilter}
                AND Isdelete = 0 
            ORDER BY MachineCode`;

        const result = await dbSQL.request()
            .input('startDate', sql.Date, new Date(startDate))
            .input('endDate', sql.Date, new Date(endDate))
            .query(query);

        // รวมข้อมูลตามรหัสเครื่องจักร
        const summaryData = result.recordset.reduce((acc, curr) => {
            const machineCode = curr.MachineCode.split('-')[0];
            const found = acc.find(item => item.MachineCode === machineCode);
            
            if (found) {
                found.WasteQuantity += parseFloat(curr.WasteQuantity) || 0;
            } else {
                acc.push({
                    MachineCode: machineCode,
                    WasteQuantity: parseFloat(curr.WasteQuantity) || 0
                });
            }
            return acc;
        }, []);

        res.json({ 
            summary: summaryData,
            details: result.recordset
        });

    } catch (err) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// router.get('/productionData', async (req, res) => {
//     const { month, year, machineCodePrefix } = req.query;
    
//     try {
//         if (!dbSQL) {
//             throw new Error('Database connection not established');
//         }

//         let machineCodeFilter = '';
//         if (machineCodePrefix === 'CU') {
//             machineCodeFilter = `AND (MachineCode LIKE 'CUT%')`;
//         } else if (machineCodePrefix === 'D22') {
//             machineCodeFilter = `AND (MachineCode = 'DRA022')`;
//         } else if (machineCodePrefix === 'PRO') {
//             machineCodeFilter = `AND (MachineCode LIKE 'PRO%')`;
//         } else if (machineCodePrefix === 'COM') {
//             machineCodeFilter = `AND (MachineCode LIKE 'COM%')`;
//         } else if (machineCodePrefix === 'TWR') {
//             machineCodeFilter = `AND (MachineCode LIKE 'TWR%')`;
//         }

//         const query = `
//             WITH DailyPlan AS (
//                 SELECT 
//                     MachineCode,
//                     ProductionDate,
//                     SUM(ProductionQuantity) AS ProductionQuantity
//                 FROM 
//                     [Production_Analytics].[dbo].[Planing_SectionAny]
//                 WHERE 
//                     YEAR(ProductionDate) = @year AND MONTH(ProductionDate) = @month
//                     ${machineCodeFilter}
//                 GROUP BY
//                     MachineCode, ProductionDate
//             ),
//             DailyActual AS (
//                 SELECT 
//                     MachineCode,
//                     CASE 
//                         WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
//                         THEN CAST(PrintTime AS DATE) 
//                         ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
//                     END AS ProductionDate,
//                         SUM(CASE WHEN ItemType IN ('WIP', 'FG') THEN printWeight ELSE 0 END) AS Actual,
//                         SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS NgWeight
//                     FROM 
//                     [Production_Analytics].[dbo].[ProductionTrackingMaster]
//                 WHERE 
//                     YEAR(PrintTime) = @year AND MONTH(PrintTime) = @month
//                     ${machineCodeFilter}
//                     AND Isdelete = 0
//                     AND ItemType != 'RM'
//                 GROUP BY 
//                     MachineCode,
//                     CASE 
//                         WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
//                         THEN CAST(PrintTime AS DATE) 
//                         ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
//                     END
//             )
//             SELECT 
//                 COALESCE(p.MachineCode, w.MachineCode) AS MachineCode,
//                 COALESCE(p.ProductionDate, w.ProductionDate) AS ProductionDate,
//                 ISNULL(p.ProductionQuantity, 0) AS ProductionQuantity,
//                 ISNULL(w.Actual, 0) AS Actual,
//                 ISNULL(w.NgWeight, 0) AS NgWeight
//             FROM 
//                 DailyPlan p
//             FULL OUTER JOIN 
//                 DailyActual w ON p.MachineCode = w.MachineCode AND p.ProductionDate = w.ProductionDate
//             ORDER BY
//                 COALESCE(p.MachineCode, w.MachineCode), 
//                 COALESCE(p.ProductionDate, w.ProductionDate)
//         `;

//         const result = await dbSQL.request()
//             .input('year', sql.Int, parseInt(year))
//             .input('month', sql.Int, parseInt(month))
//             .query(query);

//         res.json(result.recordset);
//     } catch (err) {
//         console.error('Database query error:', err);
//         res.status(500).json({ error: 'An error occurred while fetching data', details: err.message });
//     }
// });

router.get('/cutDashboard', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(ItemLen) AS ItemLen,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG' 
                AND ItemType != 'RM'
                AND MachineCode LIKE 'CUT%'
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
        PlanData AS (
            SELECT
                MachineCode,
                DocNo,
                ProductionQuantity AS [Plan]
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate = @date
                AND MachineCode LIKE 'CUT%'
        )
        SELECT 
            COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
            COALESCE(w.DocNo, p.DocNo) AS DocNo,
            w.TotalWIPWeight AS Actual,
            p.[Plan],
            w.LastPrintTime AS PrintTime,
            w.Remark,
            w.CustName, 
            w.OrderWeight,
            w.ItemLen,
            w.SizeIn,
            w.SizeOut,     
            w.PartName
        FROM 
            DailyWIP w
        FULL OUTER JOIN
            PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo
        `;

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});

router.get('/bar1TableDaily', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(ItemLen) AS ItemLen,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG' 
                AND ItemType != 'RM'
                AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022' OR MachineCode = 'TWR001' OR MachineCode = 'STN004' OR MachineCode = 'ANB001')
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
        PlanData AS (
            SELECT
                MachineCode,
                DocNo,
                ProductionQuantity AS [Plan]
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate = @date
                AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
        )
        SELECT 
            COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
            COALESCE(w.DocNo, p.DocNo) AS DocNo,
            w.TotalWIPWeight AS Actual,
            p.[Plan],
            w.LastPrintTime AS PrintTime,
            w.Remark,
            w.CustName, 
            w.OrderWeight,
            w.ItemLen,
            w.SizeIn,
            w.SizeOut,     
            w.PartName
        FROM 
            DailyWIP w
        FULL OUTER JOIN
            PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo
        `;

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        res.json(result.recordset);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});

router.get('/cgmCombinedDashboard', async (req, res) => {
    const { date, machineCodePrefix } = req.query;
    console.log('Received request with date:', date, 'machineCodePrefix:', machineCodePrefix);

    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');
        console.log('Parsed date:', parsedDate);

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('machineCodePrefix', sql.NVarChar(50), machineCodePrefix)
            .execute('GetAggregatedProductionData4');

        console.log('Query result:', result.recordset);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: item.LastPrintTime ? moment.tz(item.LastPrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            Step: `${item.CurrentStep || ''}/${item.PlanStep || ''}`
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while processing the request', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

router.get('/profileCombinedDashboard', async (req, res) => {
    const { date, machineCodePrefix, additionalMachineCodes } = req.query;
    console.log('Received request with date:', date, 'machineCodePrefix:', machineCodePrefix, 'additionalMachineCodes:', additionalMachineCodes);

    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');

        let machineCodeFilter = '';
        if (machineCodePrefix) {
            machineCodeFilter = `AND (MachineCode LIKE '${machineCodePrefix}%'`;
            if (additionalMachineCodes) {
                machineCodeFilter += ` OR MachineCode IN ('${additionalMachineCodes.split(',').join("','")}')`;
            }
            machineCodeFilter += ')';
        }

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName,
                MAX(CurrentStep) AS CurrentStep
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG'
                ${machineCodeFilter}
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
PlanData AS (
    SELECT
        MachineCode,
        DocNo,
        SUM(ProductionQuantity) AS [Plan],
        MAX(Step) AS PlanStep
    FROM
        [Production_Analytics].[dbo].[Planing_SectionAny]
    WHERE
        ProductionDate = @date
        ${machineCodeFilter}
    GROUP BY
        MachineCode, DocNo
),
CombinedData AS (
    SELECT 
        COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
        COALESCE(w.DocNo, p.DocNo) AS DocNo,
        w.TotalWIPWeight AS Actual,
        p.[Plan],
        w.LastPrintTime AS PrintTime,
        w.Remark,
        w.CustName, 
        w.OrderWeight,
        w.SizeIn,
        w.SizeOut,     
        w.PartName,
        w.CurrentStep,
        p.PlanStep,
        CASE 
            WHEN w.DocNo IS NULL THEN 1 
            WHEN w.TotalWIPWeight = 0 AND p.[Plan] > 0 THEN 1
            ELSE 0 
        END AS IsOnlyPlan,
        p.MachineCode AS PlanMachineCode
    FROM 
        PlanData p
    FULL OUTER JOIN
        DailyWIP w ON p.DocNo = w.DocNo AND p.MachineCode = w.MachineCode
)
SELECT 
    c.MachineCode,
    c.DocNo,
    c.Actual,
    c.[Plan],
    c.PrintTime,
    c.Remark,
    c.CustName,  
    MAX(dpc.Cause) AS Cause,
    MAX(dpc.Downtime) AS Downtime,
    c.OrderWeight,
    c.SizeIn,
    c.SizeOut,
    c.PartName,
    c.CurrentStep,
    c.PlanStep,
    c.IsOnlyPlan,
    c.PlanMachineCode
FROM 
    CombinedData c
LEFT JOIN
    [Production_Analytics].[dbo].[DailyProductionCauses] dpc
    ON c.MachineCode = dpc.MachineCode
    AND c.DocNo = dpc.DocNo
    AND CAST(@date AS DATE) = dpc.Date
WHERE 
    c.Actual > 0 OR c.[Plan] > 0  -- เพิ่มเงื่อนไขนี้เพื่อกรองข้อมูลที่มี Actual หรือ Plan
GROUP BY
    c.MachineCode,
    c.DocNo,
    c.Actual,
    c.[Plan],
    c.PrintTime,
    c.Remark,
    c.CustName,
    c.OrderWeight,
    c.SizeIn,
    c.SizeOut,
    c.PartName,   
    c.IsOnlyPlan,
    c.CurrentStep,
    c.PlanStep,
    c.PlanMachineCode
ORDER BY 
    c.DocNo,
    c.MachineCode
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - date:', parsedDate, 'next date:', nextDate);

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        console.log('Query result:', result.recordset);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            Actual: parseFloat(item.Actual) || 0,
            Plan: parseFloat(item.Plan) || 0,
            PrintTime: item.PrintTime ? moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            Step: `${item.CurrentStep || ''}/${item.PlanStep || ''}`
        }));

        console.log('Formatted result:', formattedResult);

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});


router.get('/combinedDashboard', async (req, res) => {
    const { date, machineCodePrefix, additionalMachineCodes } = req.query;
    console.log('Received request with date:', date, 'machineCodePrefix:', machineCodePrefix, 'additionalMachineCodes:', additionalMachineCodes);

    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');
        console.log('Parsed date:', parsedDate);
        console.log('Next date:', nextDate);

        let machineCodeFilter = '';
        if (machineCodePrefix) {
            machineCodeFilter = `AND (MachineCode LIKE '${machineCodePrefix}%'`;
            if (additionalMachineCodes) {
                machineCodeFilter += ` OR MachineCode IN ('${additionalMachineCodes.split(',').join("','")}')`;
            }
            machineCodeFilter += ')';
        }

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName,
                MAX(CurrentStep) AS CurrentStep
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG'
                AND ItemType != 'RM'
                ${machineCodeFilter}
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
        PlanData AS (
            SELECT
                MachineCode,
                DocNo,
                ProductionQuantity AS [Plan],
                MAX(Step) AS PlanStep
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate = @date
                ${machineCodeFilter}
            GROUP BY
                MachineCode, DocNo, ProductionQuantity
        ),
        CombinedData AS (
            SELECT 
                COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
                COALESCE(w.DocNo, p.DocNo) AS DocNo,
                w.TotalWIPWeight AS Actual,
                p.[Plan],
                w.LastPrintTime AS PrintTime,
                w.Remark,
                w.CustName, 
                w.OrderWeight,
                w.SizeIn,
                w.SizeOut,     
                w.PartName,
                w.CurrentStep,
                p.PlanStep,
                0 AS IsOnlyPlan
            FROM 
                DailyWIP w
            FULL OUTER JOIN
                PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo
        
            UNION ALL
        
            SELECT 
                p.MachineCode,
                p.DocNo,
                NULL AS Actual,
                p.[Plan],
                NULL AS PrintTime,
                'Plan Only' AS Remark,
                NULL AS CustName,  
                NULL AS OrderWeight,
                NULL AS SizeIn,
                NULL AS SizeOut,
                NULL AS PartName,
                NULL AS CurrentStep,
                p.PlanStep,
                1 AS IsOnlyPlan
            FROM 
                PlanData p
            LEFT JOIN
                DailyWIP w ON p.MachineCode = w.MachineCode AND p.DocNo = w.DocNo
            WHERE
                w.DocNo IS NULL
)
SELECT 
    c.MachineCode,
    c.DocNo,
    c.Actual,
    c.[Plan],
    c.PrintTime,
    c.Remark,
    c.CustName,
    c.OrderWeight,
    c.SizeIn,
    c.SizeOut,
    c.PartName,
    c.CurrentStep,
    c.PlanStep
FROM 
    CombinedData c
ORDER BY 
    c.MachineCode,
    c.DocNo,
    c.IsOnlyPlan;
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - date:', parsedDate, 'next date:', nextDate);

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        console.log('Query result:', result.recordset);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: item.PrintTime ? moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            Step: `${item.CurrentStep || ''}/${item.PlanStep || ''}`
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});


router.get('/combinedDashboardCut', async (req, res) => {
    const { date, machineCodePrefix, additionalMachineCodes } = req.query;
    console.log('Received request with date:', date, 'machineCodePrefix:', machineCodePrefix, 'additionalMachineCodes:', additionalMachineCodes);

    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');
        console.log('Parsed date:', parsedDate);
        console.log('Next date:', nextDate);

        let machineCodeFilter = '';
        if (machineCodePrefix) {
            machineCodeFilter = `AND (MachineCode LIKE '${machineCodePrefix}%'`;
            if (additionalMachineCodes) {
                machineCodeFilter += ` OR MachineCode IN ('${additionalMachineCodes.split(',').join("','")}')`;
            }
            machineCodeFilter += ')';
        }

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName,
                MAX(CurrentStep) AS CurrentStep
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG'
                AND ItemType != 'RM'
                ${machineCodeFilter}
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
        PlanData AS (
            SELECT
                MachineCode,
                DocNo,
                ProductionQuantity AS [Plan],
                MAX(Step) AS PlanStep
            FROM
                [Production_Analytics].[dbo].[Planing_SectionAny]
            WHERE
                ProductionDate = @date
                ${machineCodeFilter}
            GROUP BY
                MachineCode, DocNo, ProductionQuantity
        ),
        CombinedData AS (
            SELECT 
                COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
                COALESCE(w.DocNo, p.DocNo) AS DocNo,
                w.TotalWIPWeight AS Actual,
                p.[Plan],
                w.LastPrintTime AS PrintTime,
                w.Remark,
                w.CustName, 
                w.OrderWeight,
                w.SizeIn,
                w.SizeOut,     
                w.PartName,
                w.CurrentStep,
                p.PlanStep,
                0 AS IsOnlyPlan
            FROM 
                DailyWIP w
            FULL OUTER JOIN
                PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo
        
            UNION ALL
        
            SELECT 
                p.MachineCode,
                p.DocNo,
                NULL AS Actual,
                p.[Plan],
                NULL AS PrintTime,
                'Plan Only' AS Remark,
                NULL AS CustName,  
                NULL AS OrderWeight,
                NULL AS SizeIn,
                NULL AS SizeOut,
                NULL AS PartName,
                NULL AS CurrentStep,
                p.PlanStep,
                1 AS IsOnlyPlan
            FROM 
                PlanData p
            LEFT JOIN
                DailyWIP w ON p.MachineCode = w.MachineCode AND p.DocNo = w.DocNo
            WHERE
                w.DocNo IS NULL
        )
SELECT 
    c.MachineCode,
    c.DocNo,
    c.Actual,
    c.[Plan],
    c.PrintTime,
    c.Remark,
    c.CustName,  
    -- ตัด MAX(dpc.Cause) AS Cause, ออก
    -- ตัด MAX(dpc.Downtime) AS Downtime, ออก
    c.OrderWeight,
    c.SizeIn,
    c.SizeOut,
    c.PartName,
    c.CurrentStep,
    c.PlanStep
FROM 
    CombinedData c
-- ตัด LEFT JOIN [DailyProductionCauses] dpc ออก
-- ตัด GROUP BY ออก
ORDER BY 
    c.MachineCode,
    c.DocNo,
    c.IsOnlyPlan;
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - date:', parsedDate, 'next date:', nextDate);

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        console.log('Query result:', result.recordset);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: item.PrintTime ? moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            Step: `${item.CurrentStep || ''}/${item.PlanStep || ''}`
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});


router.get('/combinedDashboardProfile', async (req, res) => {
    const { date, machineCodePrefix, additionalMachineCodes } = req.query;
    console.log('Received request with date:', date, 'machineCodePrefix:', machineCodePrefix, 'additionalMachineCodes:', additionalMachineCodes);

    if (!date) {
        return res.status(400).json({ error: 'Date is a required parameter' });
    }

    try {
        const parsedDate = moment.tz(date, 'Asia/Bangkok').format('YYYY-MM-DD');
        const nextDate = moment.tz(date, 'Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD');
        console.log('Parsed date:', parsedDate);
        console.log('Next date:', nextDate);

        let machineCodeFilter = '';
        if (machineCodePrefix) {
            machineCodeFilter = `AND (MachineCode LIKE '${machineCodePrefix}%'`;
            if (additionalMachineCodes) {
                machineCodeFilter += ` OR MachineCode IN ('${additionalMachineCodes.split(',').join("','")}')`;
            }
            machineCodeFilter += ')';
        }

        const sqlQuery = `
        WITH DailyWIP AS (
            SELECT 
                MachineCode,
                DocNo,
                CAST(@date AS DATE) AS ProductionDate,
                SUM(printWeight) AS TotalWIPWeight,
                MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                MAX(Remark) AS Remark,
                MAX(CustName) AS CustName,
                MAX(OrderWeight) AS OrderWeight,
                MAX(SizeIn) AS SizeIn,
                MAX(SizeOut) AS SizeOut,
                MAX(PartName) AS PartName,
                MAX(CurrentStep) AS CurrentStep
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE 
                PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                AND PrintTime < DATEADD(HOUR, 8, CAST(@nextDate AS DATETIME))
                AND ItemType != 'NG'
                AND ItemType != 'RM'
                ${machineCodeFilter}
                AND Isdelete = 0
            GROUP BY
                MachineCode, DocNo
        ),
PlanData AS (
    SELECT
        MachineCode,
        DocNo,
        SUM(ProductionQuantity) AS [Plan],
        MAX(Step) AS PlanStep
    FROM
        [Production_Analytics].[dbo].[Planing_SectionAny]
    WHERE
        ProductionDate = @date
        ${machineCodeFilter}
    GROUP BY
        MachineCode, DocNo
        ),
        CombinedData AS (
            SELECT 
                COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
                COALESCE(w.DocNo, p.DocNo) AS DocNo,
                w.TotalWIPWeight AS Actual,
                p.[Plan],
                w.LastPrintTime AS PrintTime,
                w.Remark,
                w.CustName, 
                w.OrderWeight,
                w.SizeIn,
                w.SizeOut,     
                w.PartName,
                w.CurrentStep,
                p.PlanStep,
                0 AS IsOnlyPlan
            FROM 
                DailyWIP w
            FULL OUTER JOIN
                PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo
        
            UNION ALL
        
            SELECT 
                p.MachineCode,
                p.DocNo,
                NULL AS Actual,
                p.[Plan],
                NULL AS PrintTime,
                'Plan Only' AS Remark,
                NULL AS CustName,  
                NULL AS OrderWeight,
                NULL AS SizeIn,
                NULL AS SizeOut,
                NULL AS PartName,
                NULL AS CurrentStep,
                p.PlanStep,
                1 AS IsOnlyPlan
            FROM 
                PlanData p
            LEFT JOIN
                DailyWIP w ON p.MachineCode = w.MachineCode AND p.DocNo = w.DocNo
            WHERE
                w.DocNo IS NULL
        )
        SELECT 
            c.MachineCode,
            c.DocNo,
            c.Actual,
            c.[Plan],
            c.PrintTime,
            c.Remark,
            c.CustName,  
            MAX(dpc.Cause) AS Cause,
            MAX(dpc.Downtime) AS Downtime,
            c.OrderWeight,
            c.SizeIn,
            c.SizeOut,
            c.PartName,
            c.CurrentStep,
            c.PlanStep
        FROM 
            CombinedData c
        LEFT JOIN
            [Production_Analytics].[dbo].[DailyProductionCauses] dpc
            ON c.MachineCode = dpc.MachineCode
            AND c.DocNo = dpc.DocNo
            AND CAST(@date AS DATE) = dpc.Date
        GROUP BY
            c.MachineCode,
            c.DocNo,
            c.Actual,
            c.[Plan],
            c.PrintTime,
            c.Remark,
            c.CustName,
            c.OrderWeight,
            c.SizeIn,
            c.SizeOut,
            c.PartName,   
            c.IsOnlyPlan,
            c.CurrentStep,
            c.PlanStep
        ORDER BY 
            c.MachineCode,
            c.DocNo,
            c.IsOnlyPlan
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - date:', parsedDate, 'next date:', nextDate);

        const result = await dbSQL.request()
            .input('date', sql.Date, parsedDate)
            .input('nextDate', sql.Date, nextDate)
            .query(sqlQuery);

        console.log('Query result:', result.recordset);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: item.PrintTime ? moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            Step: `${item.CurrentStep || ''}/${item.PlanStep || ''}`
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});


router.get('/machineDetailsExtended', async (req, res) => {
    const { startDate, endDate, machineCode } = req.query;
    console.log('Received request with startDate:', startDate, 'endDate:', endDate, 'machineCode:', machineCode);

    if (!startDate || !endDate || !machineCode) {
        return res.status(400).json({ error: 'startDate, endDate, and machineCode are required parameters' });
    }

    try {
        const parsedStartDate = moment.tz(startDate, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        const parsedEndDate = moment.tz(endDate, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.log('Parsed start date:', parsedStartDate);
        console.log('Parsed end date:', parsedEndDate);

        const sqlQuery = `
            SELECT 
                p.MachineCode,
                p.DocNo,
                p.ItemType,
                p.ItemQty,
                p.printWeight,
                p.CoilNo,
                CONVERT(varchar, p.PrintTime, 120) AS PrintTime,
                p.Remark,
                p.CustName,
                p.OrderWeight,
                p.ItemLen,
                p.SizeIn,
                p.SizeOut,
                p.PartName,
                p.RSNCode,
                p.NextStep,
                p.PlateNo,
                pl.ProductionQuantity AS [Plan],
                MAX(dpc.Cause) AS Cause,
                MAX(dpc.Downtime) AS Downtime
            FROM 
                [Production_Analytics].[dbo].[ProductionTrackingMaster] p
            LEFT JOIN
                [Production_Analytics].[dbo].[Planing_SectionAny] pl
                ON p.MachineCode = pl.MachineCode AND p.DocNo = pl.DocNo AND CAST(p.PrintTime AS DATE) = pl.ProductionDate
            LEFT JOIN
                [Production_Analytics].[dbo].[DailyProductionCauses] dpc
                ON p.MachineCode = dpc.MachineCode AND p.DocNo = dpc.DocNo AND CAST(p.PrintTime AS DATE) = dpc.Date
            WHERE 
                LEFT(p.MachineCode, 6) = LEFT(@machineCode, 6) -- เพิ่อมรวม COM003-1, COM003-2, etc.
                AND p.PrintTime BETWEEN @startDate AND @endDate
                AND p.Isdelete = 0 AND ItemType != 'NG'
            GROUP BY
                p.MachineCode,
                p.DocNo,
                p.ItemType,
                p.ItemQty,
                p.printWeight,
                p.CoilNo,
                p.PrintTime,
                p.Remark,
                p.CustName,
                p.OrderWeight,
                p.ItemLen,
                p.SizeIn,
                p.SizeOut,
                p.PartName,
                p.RSNCode,
                p.NextStep,
                p.PlateNo,
                pl.ProductionQuantity
            ORDER BY 
                p.PrintTime
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - startDate:', parsedStartDate, 'endDate:', parsedEndDate, 'machineCode:', machineCode);

        const result = await dbSQL.request()
            .input('startDate', sql.DateTime, parsedStartDate)
            .input('endDate', sql.DateTime, parsedEndDate)
            .input('machineCode', sql.VarChar, machineCode)
            .query(sqlQuery);

        console.log('Query executed successfully. Row count:', result.recordset.length);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            NextStep: item.NextStep || ''
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// สำหรับของตารางของ Annelaing เท่านั้น (อนาคตต้องการไข)
router.get('/machineAnnealing', async (req, res) => {
    const { startDate, endDate, machineCode } = req.query;
    console.log('Received request with startDate:', startDate, 'endDate:', endDate, 'machineCode:', machineCode);

    if (!startDate || !endDate || !machineCode) {
        return res.status(400).json({ error: 'startDate, endDate, and machineCode are required parameters' });
    }

    try {
        // ใช้ moment-timezone เพื่อจัดการ timezone ให้ถูกต้อง
        const parsedStartDate = moment.tz(startDate, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        const parsedEndDate = moment.tz(endDate, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
        console.log('Parsed start date:', parsedStartDate);
        console.log('Parsed end date:', parsedEndDate);

        const sqlQuery = `
        SELECT 
            p.MachineCode,
            p.DocNo,
            p.ItemType,
            p.printWeight,
            p.CoilNo,
            CONVERT(varchar, p.PrintTime, 120) AS PrintTime,
            p.Remark,
            p.SizeOut,
            p.PartName,
            p.RSNCode,
            p.NextStep,
            p.PlateNo,
            MAX(dpc.Cause) AS Cause,
            MAX(dpc.Downtime) AS Downtime
        FROM 
            [Production_Analytics].[dbo].[ProductionTrackingMaster] p
        LEFT JOIN
            [Production_Analytics].[dbo].[DailyProductionCauses] dpc
            ON p.MachineCode = dpc.MachineCode AND p.DocNo = dpc.DocNo AND CAST(p.PrintTime AS DATE) = dpc.Date
        WHERE 
            p.PrintTime >= @startDate
            AND p.PrintTime <= @endDate
            AND p.MachineCode LIKE @machineCode
            AND ItemType = 'WIP'
        GROUP BY
            p.MachineCode,
            p.DocNo,
            p.ItemType,
            p.printWeight,
            p.CoilNo,
            p.PrintTime,
            p.Remark,
            p.SizeOut,
            p.PartName,
            p.RSNCode,
            p.NextStep,
            p.PlateNo
        ORDER BY 
            p.PrintTime
        `;

        console.log('Executing SQL query:', sqlQuery);
        console.log('With parameters - startDate:', parsedStartDate, 'endDate:', parsedEndDate, 'machineCode:', machineCode);

        const result = await dbSQL.request()
            .input('startDate', sql.DateTime, parsedStartDate)
            .input('endDate', sql.DateTime, parsedEndDate)
            .input('machineCode', sql.VarChar, machineCode.endsWith('%') ? machineCode : machineCode + '%')
            .query(sqlQuery);

        console.log('Query executed successfully. Row count:', result.recordset.length);

        const formattedResult = result.recordset.map(item => ({
            ...item,
            PrintTime: moment.tz(item.PrintTime, 'Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
            Cause: item.Cause || '',
            Downtime: item.Downtime || 0,
            NextStep: item.NextStep || ''
        }));

        console.log('Formatted result:', formattedResult);

        res.json(formattedResult);
    } catch (err) {
        console.error('Database query error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            error: 'An error occurred while fetching data', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});


router.get('/weeklyReport', async (req, res) => {
    const { startDate, endDate } = req.query;
  
    try {
      if (!dbSQL) {
        throw new Error('Database connection not established');
      }
  
      const result = await dbSQL.request()
        .input('StartDate', sql.Date, new Date(startDate))
        .input('EndDate', sql.Date, new Date(endDate))
        .query`
WITH DailyPlan AS (
SELECT 
    MachineCode,
    ProductionDate,
    SUM(ProductionQuantity) AS DailyPlan
FROM 
    [Production_Analytics].[dbo].[Planing_SectionAny]
WHERE 
ProductionDate BETWEEN @StartDate AND @EndDate
AND (MachineCode LIKE 'CUT%' OR MachineCode LIKE 'DRA%' OR MachineCode LIKE 'CO2%' 
OR MachineCode LIKE 'PAP%' OR MachineCode LIKE 'PRO%' OR MachineCode LIKE 'CGM%')
GROUP BY 
    MachineCode, ProductionDate
),
DailyActual AS (
SELECT 
    MachineCode,
    CAST(CASE 
    WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
    THEN PrintTime 
    ELSE DATEADD(DAY, -1, PrintTime)
    END AS DATE) AS ProductionDate,
    SUM(CASE WHEN ItemType = 'WIP' THEN printWeight ELSE 0 END) AS DailyActual
FROM 
    [Production_Analytics].[dbo].[ProductionTrackingMaster]
WHERE 
PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@StartDate AS DATETIME)) AND DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@EndDate AS DATETIME)))
AND (MachineCode LIKE 'CUT%' OR MachineCode LIKE 'DRA%' OR MachineCode LIKE 'CO2%'
 OR MachineCode LIKE 'PAP%' OR MachineCode LIKE 'PRO%' OR MachineCode LIKE 'CGM%')
AND Isdelete = 0
GROUP BY 
    MachineCode,
    CAST(CASE 
    WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
    THEN PrintTime 
    ELSE DATEADD(DAY, -1, PrintTime)
    END AS DATE)
),
CumulativePOP AS (
SELECT 
    COALESCE(p.MachineCode, a.MachineCode) AS MachineCode,
    SUM(COALESCE(p.DailyPlan, 0)) AS TotalPlan,
    SUM(COALESCE(a.DailyActual, 0)) AS TotalWIPWeight
FROM 
    DailyPlan p
FULL OUTER JOIN
    DailyActual a ON p.MachineCode = a.MachineCode AND p.ProductionDate = a.ProductionDate
GROUP BY 
    COALESCE(p.MachineCode, a.MachineCode)
),
DailyCauses AS (
    SELECT 
        MachineCode,
        STRING_AGG(
            CONCAT(
                FORMAT([Date], 'yyyy-MM-dd'), 
                ': ', 
                ISNULL(Cause, ''),
                ' (',
                Downtime,
                ' นาที)'
            ), 
            '; '
        ) AS Issues,
        SUM(Downtime) AS TotalDowntime
    FROM 
        [Production_Analytics].[dbo].[BreakdownMaster]
    WHERE 
        [Date] BETWEEN @StartDate AND @EndDate
        AND (MachineCode LIKE 'CUT%' OR MachineCode LIKE 'DRA%' OR MachineCode LIKE 'CO2%' 
        OR MachineCode LIKE 'PAP%' OR MachineCode LIKE 'PRO%' OR MachineCode LIKE 'CGM%')
        AND (CauseCode != 'G01' OR CauseCode IS NULL)
        AND Cause IS NOT NULL
        AND LTRIM(RTRIM(ISNULL(Cause, ''))) != ''
    GROUP BY 
        MachineCode
)
SELECT 
    c.MachineCode,
    c.TotalWIPWeight,
    c.TotalPlan,
    CASE 
        WHEN c.TotalPlan > 0 THEN (c.TotalWIPWeight / c.TotalPlan) * 100 
        ELSE 0 
    END AS CumulativePOP,
    ISNULL(d.Issues, 'ไม่มีปัญหา') AS Issues,
    ISNULL(d.TotalDowntime, 0) AS TotalDowntime
FROM 
    CumulativePOP c
LEFT JOIN 
    DailyCauses d ON c.MachineCode = d.MachineCode
ORDER BY 
    CASE 
        WHEN c.MachineCode LIKE 'CUT%' THEN 1
        WHEN c.MachineCode = 'DRA022' THEN 2
        WHEN c.MachineCode LIKE 'CO2%' THEN 3
        WHEN c.MachineCode LIKE 'PAP%' THEN 4
        WHEN c.MachineCode LIKE 'PRO%' THEN 5
        WHEN c.MachineCode LIKE 'CGM%' THEN 6
        ELSE 7
    END,
    c.MachineCode
        `;
  
      console.log('API result:', result.recordset);
      res.json(result.recordset);
    } catch (error) {
      console.error('Error fetching weekly report:', error);
      res.status(500).json({ error: 'Failed to fetch weekly report', details: error.message });
    }
  });

router.post('/saveAllWeeklyReportPreventiveCorrections', async (req, res) => {
    const { startDate, endDate, data } = req.body;
    console.log('Received data:', { startDate, endDate, dataLength: data?.length });
  
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty data provided' });
    }
  
    try {
      if (!dbSQL) {
        throw new Error('Database connection not established');
      }
  
      const transaction = new sql.Transaction(dbSQL);
      await transaction.begin();
  
      try {
        for (const item of data) {
          // ตรวจสอบว่า PreventiveCorrection มีค่าหรือไม่
          if (item.preventiveCorrection && item.preventiveCorrection.trim() !== '') {
            console.log('Processing item:', item);
            await transaction.request()
              .input('StartDate', sql.Date, new Date(startDate))
              .input('EndDate', sql.Date, new Date(endDate))
              .input('MachineCode', sql.NVarChar(50), item.machineCode)
              .input('CumulativePOP', sql.Decimal(5,2), item.cumulativePOP)
              .input('Issues', sql.NVarChar(sql.MAX), item.issues)
              .input('PreventiveCorrection', sql.NVarChar(200), item.preventiveCorrection)
              .query(`
                MERGE INTO [Production_Analytics].[dbo].[WeeklyReportCauses] AS target
                USING (VALUES (@StartDate, @EndDate, @MachineCode)) AS source (StartDate, EndDate, MachineCode)
                ON target.StartDate = source.StartDate AND target.EndDate = source.EndDate AND target.MachineCode = source.MachineCode
                WHEN MATCHED THEN
                    UPDATE SET 
                        CumulativePOP = @CumulativePOP,
                        Issues = @Issues,
                        PreventiveCorrection = @PreventiveCorrection,
                        UpdatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (StartDate, EndDate, MachineCode, CumulativePOP, Issues, PreventiveCorrection)
                    VALUES (@StartDate, @EndDate, @MachineCode, @CumulativePOP, @Issues, @PreventiveCorrection);
              `);
          } else {
            console.log('Skipping item due to empty PreventiveCorrection:', item);
          }
        }
  
        await transaction.commit();
        res.status(200).json({ message: 'All weekly report preventive corrections saved successfully' });
      } catch (error) {
        console.error('Error in transaction:', error);
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error saving weekly report preventive corrections:', error);
      res.status(500).json({ 
        error: 'Failed to save weekly report preventive corrections', 
        details: error.message,
        stack: error.stack
      });
    }
  });

  router.get('/getWeeklyReport', async (req, res) => {
    const { startDate, endDate } = req.query;
  
    try {
      if (!dbSQL) {
        throw new Error('Database connection not established');
      }
  
      const result = await dbSQL.request()
        .input('StartDate', sql.Date, new Date(startDate))
        .input('EndDate', sql.Date, new Date(endDate))
        .query`
          SELECT * FROM [Production_Analytics].[dbo].[WeeklyReportCauses]
          WHERE StartDate = @StartDate AND EndDate = @EndDate
        `;
  
      res.json(result.recordset);
    } catch (error) {
      console.error('Error fetching weekly report:', error);
      res.status(500).json({ error: 'Failed to fetch weekly report', details: error.message });
    }
  });

  // ดึงข้อมูล PreventiveCorrection รายวันตามช่วงเวลา
router.post('/getPreventiveCorrectionByDateRange', async (req, res) => {
    const { machineCode, startDate, endDate } = req.body;
    // ดึงข้อมูลจาก SQL ตามช่วงวันที่และ MachineCode
    // ส่งข้อมูลกลับไปยัง client
  });
  
  // อัปเดตข้อมูล Cause รายวัน
  router.post('/updateDailyPreventiveCorrection', async (req, res) => {
    const updatedData = req.body;
    // อัปเดตข้อมูลใน SQL สำหรับแต่ละวัน
    // ส่งผลลัพธ์กลับไปยัง client
  });

  // Weekly ReportNCR
  router.get('/weeklyReportNCR', async (req, res) => {
    const { startDate, endDate } = req.query;
  
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }
  
        const query = `
WITH NCRSummary AS (
    SELECT 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy') as PrintDate,
        SUM(ptm.printWeight) as WeightPerNC,
        SUM(CASE WHEN ptm.ItemType = 'NG' THEN ptm.printWeight ELSE 0 END) AS TotalNGWeight
    FROM 
        [Production_Analytics].[dbo].[ProductionTrackingMaster] ptm
    LEFT JOIN 
        [Production_Analytics].[dbo].[tb_NC_Reason] ncr ON ptm.NCCode = ncr.NCCode
    WHERE 
        ptm.PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@StartDate AS DATETIME)) 
        AND DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@EndDate AS DATETIME)))
        AND ptm.MachineCode LIKE 'CGM%'
        AND ptm.Isdelete = 0
        AND ptm.NCCode != 'WIP01'
        AND ptm.ItemType = 'NG'
    GROUP BY 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy')
)
SELECT 
    MachineCode,
    SUM(TotalNGWeight) as TotalNGWeight,
    STRING_AGG(
        CASE 
            WHEN NCName IS NOT NULL THEN 
                NCName + ' (' + CAST(CAST(WeightPerNC AS DECIMAL(10,1)) AS VARCHAR) + ' Kg) - ' + PrintDate
            ELSE 'ไม่มีปัญหา'
        END,
        '; '
    ) WITHIN GROUP (ORDER BY PrintDate) AS Issues
FROM 
    NCRSummary
GROUP BY 
    MachineCode
ORDER BY 
    MachineCode;`;

        const result = await dbSQL.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query(query);

        console.log('Query executed successfully. Rows returned:', result.recordset.length);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching weekly report:', error);
        res.status(500).json({ error: 'Failed to fetch weekly report', details: error.message });
    }
});

router.get('/weeklyReportNCRbar1', async (req, res) => {
    const { startDate, endDate } = req.query;
  
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }
  
        const query = `
WITH NCRSummary AS (
    SELECT 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy') as PrintDate,
        SUM(ptm.printWeight) as WeightPerNC,
        SUM(CASE WHEN ptm.ItemType = 'NG' THEN ptm.printWeight ELSE 0 END) AS TotalNGWeight
    FROM 
        [Production_Analytics].[dbo].[ProductionTrackingMaster] ptm
    LEFT JOIN 
        [Production_Analytics].[dbo].[tb_NC_Reason] ncr ON ptm.NCCode = ncr.NCCode
    WHERE 
        ptm.PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@StartDate AS DATETIME)) 
        AND DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@EndDate AS DATETIME)))
        AND (
            ptm.MachineCode LIKE 'COM%'
            OR ptm.MachineCode = 'CUT022'
            OR ptm.MachineCode = 'ANB001'
            OR ptm.MachineCode = 'STN004'
            OR ptm.MachineCode = 'TWR001'
        )
        AND ptm.Isdelete = 0
        AND ptm.NCCode != 'WIP01'
        AND ptm.ItemType = 'NG'
    GROUP BY 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy')
)
SELECT 
    MachineCode,
    SUM(TotalNGWeight) as TotalNGWeight,
    STRING_AGG(
        CASE 
            WHEN NCName IS NOT NULL THEN 
                NCName + ' (' + CAST(CAST(WeightPerNC AS DECIMAL(10,1)) AS VARCHAR) + ' Kg) - ' + PrintDate
            ELSE 'ไม่มีปัญหา'
        END,
        '; '
    ) WITHIN GROUP (ORDER BY PrintDate) AS Issues
FROM 
    NCRSummary
GROUP BY 
    MachineCode
ORDER BY 
    CASE 
        WHEN MachineCode LIKE 'COM%' THEN 1
        WHEN MachineCode = 'CUT022' THEN 2
        WHEN MachineCode = 'ANB001' THEN 3
        WHEN MachineCode = 'STN004' THEN 4
        WHEN MachineCode = 'TWR001' THEN 5
        ELSE 6
    END,
    MachineCode;`;

        const result = await dbSQL.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query(query);

        console.log('Query executed successfully. Rows returned:', result.recordset.length);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching weekly report:', error);
        res.status(500).json({ error: 'Failed to fetch weekly report', details: error.message });
    }
});


router.get('/weeklyReportNCRPro', async (req, res) => {
    const { startDate, endDate } = req.query;
  
    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }
  
        const query = `
WITH NCRSummary AS (
    SELECT 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy') as PrintDate,
        SUM(ptm.printWeight) as WeightPerNC,
        SUM(CASE WHEN ptm.ItemType = 'NG' THEN ptm.printWeight ELSE 0 END) AS TotalNGWeight
    FROM 
        [Production_Analytics].[dbo].[ProductionTrackingMaster] ptm
    LEFT JOIN 
        [Production_Analytics].[dbo].[tb_NC_Reason] ncr ON ptm.NCCode = ncr.NCCode
    WHERE 
        ptm.PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@StartDate AS DATETIME)) 
        AND DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@EndDate AS DATETIME)))
        AND ptm.MachineCode LIKE 'PRO%'
        AND ptm.Isdelete = 0
        AND ptm.NCCode != 'WIP01'
        AND ptm.ItemType = 'NG'
    GROUP BY 
        ptm.MachineCode,
        ncr.NCName,
        FORMAT(ptm.PrintTime, 'dd/MM/yyyy')
)
SELECT 
    MachineCode,
    SUM(TotalNGWeight) as TotalNGWeight,
    STRING_AGG(
        CASE 
            WHEN NCName IS NOT NULL THEN 
                NCName + ' (' + CAST(CAST(WeightPerNC AS DECIMAL(10,1)) AS VARCHAR) + ' Kg) - ' + PrintDate
            ELSE 'ไม่มีปัญหา'
        END,
        '; '
    ) WITHIN GROUP (ORDER BY PrintDate) AS Issues
FROM 
    NCRSummary
GROUP BY 
    MachineCode
ORDER BY 
    MachineCode;
        `;

        const result = await dbSQL.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query(query);

        console.log('Query executed successfully. Rows returned:', result.recordset.length);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching weekly report:', error);
        res.status(500).json({ error: 'Failed to fetch weekly report', details: error.message });
    }
});

router.post('/saveWeeklyReportNCR', async (req, res) => {
    const { startDate, endDate, data } = req.body;
    console.log('Received NCR data:', { startDate, endDate, dataLength: data?.length });

    if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty data provided' });
    }

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const transaction = new sql.Transaction(dbSQL);
        await transaction.begin();

        try {
            for (const item of data) {
                if (item.preventiveCorrection && item.preventiveCorrection.trim() !== '') {
                    console.log('Processing NCR item:', item);
                    await transaction.request()
                        .input('StartDate', sql.Date, new Date(startDate))
                        .input('EndDate', sql.Date, new Date(endDate))
                        .input('MachineCode', sql.NVarChar(50), item.machineCode)
                        .input('NCRQuantity', sql.Decimal(5,2), item.ncrQuantity)
                        .input('Issues', sql.NVarChar(500), item.issues)
                        .input('PreventiveCorrection', sql.NVarChar(200), item.preventiveCorrection)
                        .query(`
                            MERGE INTO [Production_Analytics].[dbo].[WeeklyReportNCR] AS target
                            USING (VALUES (@StartDate, @EndDate, @MachineCode)) AS source (StartDate, EndDate, MachineCode)
                            ON target.StartDate = source.StartDate 
                            AND target.EndDate = source.EndDate 
                            AND target.MachineCode = source.MachineCode
                            WHEN MATCHED THEN
                                UPDATE SET 
                                    NCRQuantity = @NCRQuantity,
                                    Issues = @Issues,
                                    PreventiveCorrection = @PreventiveCorrection,
                                    UpdatedAt = GETDATE()
                            WHEN NOT MATCHED THEN
                                INSERT (StartDate, EndDate, MachineCode, NCRQuantity, Issues, PreventiveCorrection, CreatedAt)
                                VALUES (@StartDate, @EndDate, @MachineCode, @NCRQuantity, @Issues, @PreventiveCorrection, GETDATE());
                        `);
                }
            }

            await transaction.commit();
            res.status(200).json({ message: 'NCR data saved successfully' });
        } catch (error) {
            console.error('Error in transaction:', error);
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error saving NCR data:', error);
        res.status(500).json({
            error: 'Failed to save NCR data',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.get('/getWeeklyReportNCR', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const result = await dbSQL.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query`
                SELECT * FROM [Production_Analytics].[dbo].[WeeklyReportNCR]
                WHERE StartDate = @StartDate AND EndDate = @EndDate
                ORDER BY MachineCode
            `;

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching NCR report:', error);
        res.status(500).json({ 
            error: 'Failed to fetch NCR report', 
            details: error.message 
        });
    }
});
  

  router.get('/machineDetails', async (req, res) => {
    const { date, machineCode } = req.query;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const result = await dbSQL.request()
            .input('Date', sql.Date, new Date(date))
            .input('MachineCode', sql.NVarChar, machineCode)
            .query`
            SELECT 
                [DocNo], [RSNCode], [ItemType], [ItemQty],
                [printWeight], [CoilNo], [Remark], [MachineCode],
                CONVERT(varchar, PrintTime, 120) AS PrintTime,
                [OrderWeight], [ItemLen], [SizeIn], [SizeOut],
                [PartName]  
            FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE CAST(PrintTime AS DATE) = @Date
            AND MachineCode = @MachineCode
            AND Isdelete = 0
            ORDER BY PrintTime
            `;

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching machine details:', error);
        res.status(500).json({ error: 'Failed to fetch machine details', details: error.message });
    }
});

router.post('/updateRemark', async (req, res) => {
    const { docNo, rsnCode, remark, currentMachineCode, newMachineCode } = req.body;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const updateResult = await dbSQL.request()
            .input('DocNo', sql.NVarChar, docNo)
            .input('RSNCode', sql.NVarChar, rsnCode)
            .input('Remark', sql.NVarChar(200), remark)
            .input('NewMachineCode', sql.NVarChar(50), newMachineCode)
            .query`
                UPDATE [Production_Analytics].[dbo].[ProductionTrackingMaster]
                SET [Remark] = @Remark,
                    [MachineCode] = CASE
                        WHEN @NewMachineCode != '' THEN @NewMachineCode
                        ELSE [MachineCode]
                    END
                WHERE [DocNo] = @DocNo AND [RSNCode] = @RSNCode
                AND Isdelete = 0

                SELECT @@ROWCOUNT AS UpdatedRows;
            `;

        console.log('Update result:', updateResult);

        if (updateResult.recordset[0].UpdatedRows === 0) {
            return res.status(404).json({ error: 'Record not found or no changes made' });
        }

        const selectResult = await dbSQL.request()
            .input('DocNo', sql.NVarChar, docNo)
            .input('RSNCode', sql.NVarChar, rsnCode)
            .query`
                SELECT [MachineCode], [Remark]
                FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE [DocNo] = @DocNo AND [RSNCode] = @RSNCode;
            `;

        console.log('Select result:', selectResult);

        if (selectResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Updated record not found' });
        }

        const updatedRecord = selectResult.recordset[0];

        console.log('Updated record:', updatedRecord);

        res.status(200).json({ 
            message: 'Remark and MachineCode updated successfully',
            updatedData: { 
                docNo, 
                rsnCode, 
                remark: updatedRecord.Remark, 
                newMachineCode: updatedRecord.MachineCode 
            }
        });
    } catch (error) {
        console.error('Error updating remark and machine code:', error);
        res.status(500).json({ 
            error: 'Failed to update remark and machine code', 
            details: error.message
        });
    }
});

// ดึงข้อมูลปุ่ม Edit Plan modal
router.get('/getPlanData', async (req, res) => {
    const { date, department } = req.query;

    // Map สำหรับ pattern ของแต่ละแผนก
    const departmentPatterns = {
        'CGM': 'CGM%',
        'PRO': 'PRO%',
        'CUT': 'CUT%',
        'DRA': 'DRA%',
        'CO2': 'CO2%',
        'PAP': 'PAP%',
    };

    try {
        const machinePattern = departmentPatterns[department] || 'CGM%';

        // เพิ่ม console.log เพื่อดูข้อมูลที่ได้
        const result = await dbSQL.request()
            .input('date', sql.Date, new Date(date))
            .input('machinePattern', sql.NVarChar, machinePattern)
            .query(`
                SELECT [No], DocNo, MachineCode, ProductionQuantity, Step
                FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE ProductionDate = @date
                AND MachineCode LIKE @machinePattern
                ORDER BY MachineCode    
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงข้อมูลปุ่ม Edit Plan modal สำหรับ BAR2 โดยเฉพาะ
router.get('/getPlanDataBar2', async (req, res) => {
    const { date } = req.query;

    try {
        const result = await dbSQL.request()
            .input('date', sql.Date, new Date(date))
            .query(`
                    SELECT [No], DocNo, MachineCode, ProductionQuantity, Step
                    FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                    WHERE ProductionDate = @date
                    AND (MachineCode LIKE 'CUT%' OR 
                        MachineCode LIKE 'CO2%' OR 
                        MachineCode LIKE 'PAP%' OR 
                        MachineCode = 'DRA022')
                    ORDER BY MachineCode 
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงข้อมูลปุ่ม Edit Plan modal สำหรับ BAR1 โดยเฉพาะ
router.get('/getPlanDataBar1', async (req, res) => {
    const { date } = req.query;

    try {
        const result = await dbSQL.request()
        .input('date', sql.Date, new Date(date))
            .query(`
                SELECT [No], DocNo, MachineCode, ProductionQuantity, Step
                FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE ProductionDate = @date
                AND (MachineCode LIKE 'COM%' OR 
                    MachineCode = 'CUT022')
                ORDER BY MachineCode 
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

// อัพเดท Plan Modal
router.post('/updatePlan', async (req, res) => {
    const { No, machineCode, productionQuantity, step } = req.body;  
    try {
        await dbSQL.request()
            .input('No', sql.Int, No)  // เปลี่ยนชื่อ parameter
            .input('machineCode', sql.NVarChar, machineCode)
            .input('productionQuantity', sql.Float, productionQuantity)
            .input('step', sql.Int, step)
            .query(`
                UPDATE [Production_Analytics].[dbo].[Planing_SectionAny]
                SET MachineCode = @machineCode,
                    ProductionQuantity = @productionQuantity,
                    Step = @step
                WHERE [No] = @No
            `);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// บันทึก PlanRow Modal
router.post('/savePlanRow', async (req, res) => {
    const { docNo, machineCode, productionQuantity, step, date, department } = req.body;

    const sectionIdMap = {
        'CGM': 'CG',
        'PRO': 'PR',
        'CUT': 'CU',
        'DRA': 'DR',
        'CO2': 'CO',
        'PAP': 'PA'
    };

    try {
        const result = await dbSQL.request()
            .input('docNo', sql.NVarChar, docNo)
            .input('machineCode', sql.NVarChar, machineCode)
            .input('productionQuantity', sql.Float, productionQuantity)
            .input('step', sql.Int, step)
            .input('date', sql.Date, new Date(date))
            .input('sectionId', sql.NVarChar, sectionIdMap[department] || 'CG')
            .query(`
                UPDATE [Production_Analytics].[dbo].[Planing_SectionAny]
                SET MachineCode = @machineCode,
                    ProductionQuantity = @productionQuantity,
                    Step = @step
                WHERE DocNo = @docNo
                AND ProductionDate = @date
                AND SectionID = @sectionId
            `);

        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// เพิ่มข้อมูลใหม่ในของ PlanRow Modal
router.post('/addNewPlan', async (req, res) => {
    const { docNo, machineCode, productionQuantity, step, date, department } = req.body;

    // Map department code สำหรับ SectionID
    const sectionIdMap = {
        'CGM': 'CG',
        'PRO': 'PR',
        'CUT': 'CU',
        'DRA': 'DR',
        'CO2': 'CO',
        'PAP': 'PA'
    };

    try {
        await dbSQL.request()
            .input('docNo', sql.NVarChar, docNo)
            .input('machineCode', sql.NVarChar, machineCode)
            .input('productionQuantity', sql.Float, productionQuantity)
            .input('step', sql.Int, step)
            .input('date', sql.Date, new Date(date))
            .input('sectionId', sql.NVarChar, sectionIdMap[department])
            .query(`
               INSERT INTO [Production_Analytics].[dbo].[Planing_SectionAny]
               (DocNo, MachineCode, ProductionDate, ProductionQuantity, SectionID, Step) 
                VALUES
                (@docNo, @machineCode, @date, @ProductionQuantity, @sectionId, @Step)
            `);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ลบข้อมูลในของ PlanRow Modal
router.post('/deletePlan', async (req, res) => {
    const { No } = req.body;

    try {
        await dbSQL.request()
            .input('No', sql.Int, No)
            .query(`
               DELETE FROM [Production_Analytics].[dbo].[Planing_SectionAny]
               WHERE No = @No
            `);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/updateMultipleMachineCodes', async (req, res) => {
    const { docNo, newMachineCode, currentDate } = req.body;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const updateResult = await dbSQL.request()
            .input('DocNo', sql.NVarChar, docNo)
            .input('NewMachineCode', sql.NVarChar(50), newMachineCode)
            .input('CurrentDate', sql.Date, new Date(currentDate))
            .query`
                UPDATE [Production_Analytics].[dbo].[ProductionTrackingMaster]
                SET [MachineCode] = @NewMachineCode
                WHERE [DocNo] = @DocNo 
                AND CAST([PrintTime] AS DATE) = @CurrentDate
                AND Isdelete = 0

                SELECT @@ROWCOUNT AS UpdatedRows;
            `;

        console.log('Update result:', updateResult);

        if (updateResult.recordset[0].UpdatedRows === 0) {
            return res.status(404).json({ error: 'Records not found or no changes made' });
        }

        const selectResult = await dbSQL.request()
            .input('DocNo', sql.NVarChar, docNo)
            .input('CurrentDate', sql.Date, new Date(currentDate))
            .query`
                SELECT [MachineCode], [Remark], [RSNCode]
                FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE [DocNo] = @DocNo
                AND CAST([PrintTime] AS DATE) = @CurrentDate;
            `;

        console.log('Select result:', selectResult);

        if (selectResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Updated records not found' });
        }

        const updatedRecords = selectResult.recordset;

        console.log('Updated records:', updatedRecords);

        res.status(200).json({ 
            message: 'MachineCode updated successfully for the specified records',
            updatedData: updatedRecords.map(record => ({
                docNo, 
                rsnCode: record.RSNCode, 
                remark: record.Remark, 
                newMachineCode: record.MachineCode 
            }))
        });
    } catch (error) {
        console.error('Error updating machine codes:', error);
        res.status(500).json({ 
            error: 'Failed to update machine codes', 
            details: error.message
        });
    }
});

router.post('/saveAllCauses', async (req, res) => {
    console.log('Received request to /saveAllCauses');
    const { data } = req.body;
    console.log('Received data:', data);

    if (!Array.isArray(data) || data.length === 0) {
        console.log('Invalid or empty data received');
        return res.status(400).json({ error: 'Invalid or empty data provided' });
    }

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const transaction = new sql.Transaction(dbSQL);
        await transaction.begin();

        try {
            for (const item of data) {
                console.log('Processing item:', JSON.stringify(item, null, 2));
                let cause = '';
                let totalDowntime = 0;
                if (item.problems && item.problems.length > 0) {
                    cause = item.problems.map(problem => {
                        totalDowntime += parseInt(problem.downtime) || 0;
                        return `${problem.description}`;
                    }).join('; ');
                }
                console.log('Created cause string:', cause);
                console.log('Total downtime:', totalDowntime);

                const query = `
                    MERGE INTO [Production_Analytics].[dbo].[DailyProductionCauses] AS target
                    USING (VALUES (@Date, @MachineCode, @DocNo)) AS source (Date, MachineCode, DocNo)
                    ON target.Date = source.Date AND target.MachineCode = source.MachineCode AND target.DocNo = source.DocNo
                    WHEN MATCHED THEN
                        UPDATE SET 
                            Cause = @Cause,
                            Downtime = @Downtime,
                            UpdatedAt = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (Date, MachineCode, DocNo, Cause, Downtime)
                        VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime);
                `;

                console.log('SQL Query:', query);
                console.log('SQL Parameters:', {
                    Date: new Date(item.date),
                    MachineCode: item.machineCode,
                    DocNo: item.docNo,
                    Cause: cause,
                    Downtime: totalDowntime
                });

                await transaction.request()
                    .input('Date', sql.Date, new Date(item.date))
                    .input('MachineCode', sql.NVarChar(50), item.machineCode)
                    .input('DocNo', sql.NVarChar(50), item.docNo)
                    .input('Cause', sql.NVarChar(500), cause)
                    .input('Downtime', sql.Float, totalDowntime)
                    .query(query);
            }

            await transaction.commit();
            console.log('Transaction committed successfully');
            res.status(200).json({ message: 'All Causes saved successfully' });
        } catch (error) {
            await transaction.rollback();
            console.error('Error saving Causes:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({
                error: 'Failed to save Cause',
                details: error.message,
                stack: error.stack
            });
        }
    } catch (error) {
        console.error('Error saving Causes:', error);
        res.status(500).json({ 
            error: 'Failed to save Causes', 
            details: error.message,
            stack: error.stack
        });
    }
});

router.get('/getCauses', async (req, res) => {
    const { date } = req.query;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const result = await dbSQL.request()
            .input('Date', sql.Date, new Date(date))
            .query`
                SELECT MachineCode, DocNo, Cause, Downtime
                FROM [Production_Analytics].[dbo].[DailyProductionCauses]
                WHERE Date = @Date
            `;

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching Causes:', error);
        res.status(500).json({ error: 'Failed to fetch Causes', details: error.message });
    }
});

// ทดสอบดึง cause จาก postgresMswPlus
router.get('/getCausesMswAll', async (req, res) => {
    const { date } = req.query;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const result = await dbSQL.request()
            .input('Date', sql.Date, new Date(date))
            .query`
                SELECT [ID]
                ,[breakdownId]
                ,[Date]
                ,[MachineCode]
                ,[Cause]
                ,[UpdatedAt]
                ,[Downtime]
                ,[notes]
                FROM [Production_Analytics].[dbo].[BreakdownMaster]
                WHERE Date = @Date
            `;

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching CausesMswAll', error);
        res.status(500).json({ error: 'Failed to fetch CausesMswAll', details: error.message });
    }
});


router.post('/saveCause', async (req, res) => {
    try {
        const { date, machineCode, docNo, cause, downtime } = req.body;
        
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const query = `
            INSERT INTO [Production_Analytics].[dbo].[DailyProductionCauses] 
            (Date, MachineCode, DocNo, Cause, Downtime, CreatedAt, UpdatedAt)
            VALUES (@date, @machineCode, @docNo, @cause, @downtime, GETDATE(), GETDATE())
        `;
        
        await dbSQL.request()
            .input('date', sql.Date, new Date(date))
            .input('machineCode', sql.NVarChar(50), machineCode)
            .input('docNo', sql.NVarChar(50), docNo)
            .input('cause', sql.NVarChar(500), cause)
            .input('downtime', sql.Int, downtime)
            .query(query);

        res.json({ success: true, message: 'Cause saved successfully' });
    } catch (error) {
        console.error('Error saving cause:', error);
        res.status(500).json({ success: false, message: 'Failed to save cause', error: error.message });
    }
});



router.post('/updateCauses', async (req, res) => {
    const { date, machineCode, docNo, problems } = req.body;

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const transaction = new sql.Transaction(dbSQL);
        await transaction.begin();

        try {
            // ลบข้อมูลเดิมทั้งหมด
            await transaction.request()
                .input('Date', sql.Date, new Date(date))
                .input('MachineCode', sql.NVarChar(50), machineCode)
                .input('DocNo', sql.NVarChar(50), docNo)
                .query`
                    DELETE FROM [Production_Analytics].[dbo].[DailyProductionCauses]
                    WHERE Date = @Date AND MachineCode = @MachineCode AND DocNo = @DocNo
                `;

            // เพิ่มข้อมูลใหม่
            for (const problem of problems) {
                await transaction.request()
                    .input('Date', sql.Date, new Date(date))
                    .input('MachineCode', sql.NVarChar(50), machineCode)
                    .input('DocNo', sql.NVarChar(50), docNo)
                    .input('Cause', sql.NVarChar(500), problem.description)
                    .input('Downtime', sql.Int, problem.downtime)
                    .query`
                        INSERT INTO [Production_Analytics].[dbo].[DailyProductionCauses]
                        (Date, MachineCode, DocNo, Cause, Downtime)
                        VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime)
                    `;
            }

            await transaction.commit();
            res.json({ success: true, message: 'Causes updated successfully' });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating causes:', error);
        res.status(500).json({ success: false, message: 'Failed to update causes', error: error.message });
    }
});

// ทดดสอบ saveCause จาก postgresMswPlus
router.get('/saveCauseMswAll', async (req, res) => {
    try {
        const { date, machineCode, docNo, cause, downtime } = req.body;

        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const query = `
            INSERT INTO [Production_Analytics].[dbo].[BreakdownMaster]
            (Date, MachineCode, DocNo, Cause, Downtime, UpdatedAt)
            VALUES (@date, @machineCode, @docNo, @cause, @downtime, GETDATE())
        `;

        await dbSQL.request()
            .input('date', sql.Date, new Date(date))
            .input('machineCode', sql.NVarChar(50), machineCode)
            .input('docNo', sql.NVarChar(50), docNo)
            .input('cause', sql.NVarChar(500), cause)
            .input('downtime', sql.Int, downtime)
            .query(query);

        res.json({ success: true, message: 'Cause saved successfully' });
    } catch (error) {
        console.error('Error saving cause:', error);
        res.status(500).json({ success: false, message: 'Failed to save cause', error: error.message });
    }
});

// ทดสอบ saveAllCause จาก postgres
router.post('/saveAllCausesMswAll', async (req, res) => {
    console.log('Received request for saveAllCausesMswAll')
    const { data } = req.body;
    console.log('Received data:', data);

    if (!Array.isArray(data) || data.length === 0) {
        console.log('Invilide or empty data received');
        return res.status(400).json({ error: 'Invalid or empty data provided' });
    }

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const transaction = new sql.Transaction(dbSQL)
        await transaction.begin();

        try {
            for (const item of data) {
                console.log('Processing item:', JSON.stringify(item, null, 2));
                let cause = '';
                let totalDowntime = 0;
                if (item.problems && item.problems.length > 0) {
                    cause = item.problems.map(problem => {
                        totalDowntime += parseInt(problem.downtime) || 0;
                        return `${problem.description}`;                       
                    }).join('; ');
                }
                console.log('Created cause string:', cause);
                console.log('Total downtime:', totalDowntime)

                const query = `
                    MERGE INTO [Production_Analytics].[dbo].[BreakdownMaster] AS target
                    USING (VALUES (@Date, @MachineCode, @DocNo)) AS source (Date, MachineCode, DocNo)
                    ON target.Date = source.Date AND target.MachineCode = source.MachineCode AND target.DocNo = source.DocNo
                    WHEN MATCHED THEN
                        UPDATE SET
                            Cause = @Cause,
                            Downtime = @Downtime,
                            UpdatedAt = GETDATE()    
                    WHEN NOT MATCHED THEN
                        INSERT (Date, MachineCode, DocNo, Cause, Downtime)
                        VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime);
                `;

                console.log('SQL Query:', query);
                console.log('SQL Parameters:', {
                    Date: new Date(item.date),
                    MachineCode: item.machineCode,
                    DocNo: item.docNo,
                    Cause: cause,
                    Downtime: totalDowntime
                });

                await transaction.request()
                    .input('Date', sql.Date, new Date(item.date))
                    .input('MachineCode', sql.NVarChar(50), item.machineCode)
                    .input('DocNo', sql.NVarChar(50), item.docNo)
                    .input('Cause', sql.NVarChar(500), cause)
                    .input('Downtime', sql.Float, totalDowntime)
                    .query(query);
            }

            await transaction.commit();
            res.status(200).json({ message: 'All Causes saved successfully' });
        } catch (error) {
            await transaction.rollback();
            console.error('Error saving Cause:', error);
            console.error('Error stack:', error.stack);
            req.status(500).json({
                error: 'Failed to save Cause',
                details: error.message,
                stack: error.stack
            });
        }
    } catch (error) {
        console.error('Error saving Cause:', error);
        res.status(500).json({
            error: 'Failed to save Cause',
            details: error.message,
            stack: error.stack
        });
    }
});

router.get('/breakdown-causes', async (req, res) => {
    try {
        // เช็ค database connection
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        // ใส่ console.log เพื่อดูว่าเข้ามาถึงจุดนี้ไหม
        console.log('Fetching breakdown causes...');

        const result = await dbSQL.request()
            .query(`SELECT CauseCode, Description
                    FROM [Production_Analytics].[dbo].[BreakdownCauses]
                    WHERE IsActive = 1
                    ORDER BY CauseCode
            `);

        // log ผลลัพธ์
        console.log('Query result:', result.recordset);

        // ส่ง response กลับ
        res.json(result.recordset);

    } catch (error) {
        // log error แบบละเอียด
        console.error('Error in /api/breakdown-causes:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'An error occurred while fetching breakdown causes', 
            details: error.message,
            stack: error.stack
        });
    }
});

// ทดสอบ updateCauseMswPlus จาก postgres
router.post('/updateCausesMswAll', async (req, res) => {
    const { date, machineCode, docNo, problems, deletedProblems } = req.body;
    console.log('Received request for updateCausesMswAll:', { date, machineCode, docNo, problems, deletedProblems });

    if (!date || !machineCode || (!Array.isArray(problems) && !Array.isArray(deletedProblems))) {
        console.log('Invalid data');
        return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    try {
        if (!dbSQL) {
            throw new Error('Database connection not established');
        }

        const transaction = new sql.Transaction(dbSQL);
        await transaction.begin();

        try {
            const updatedProblems = [];

            // ลบข้อมูลที่ถูกเลือกให้ลบ
            if (Array.isArray(deletedProblems) && deletedProblems.length > 0) {
                for (const id of deletedProblems) {
                    console.log('Deleting problem with ID:', id);
                    await transaction.request()
                        .input('Id', sql.Int, id)
                        .query(`
                            DELETE FROM [Production_Analytics].[dbo].[BreakdownMaster]
                            WHERE ID = @Id;
                        `);
                }
            }

            // อัปเดตหรือเพิ่มข้อมูลใหม่
            if (Array.isArray(problems) && problems.length > 0) {
                for (const problem of problems) {
                    console.log('Processing problem:', problem);
                    const downtime = parseFloat(problem.downtime);
                    if (isNaN(downtime) || downtime < 0) {
                        console.log('Skipping problem due to invalid downtime:', downtime);
                        continue;
                    }

                    let result;
                    if (problem.id) {
                        // Update existing record
                        console.log('Updating existing record:', problem.id);
                        result = await transaction.request()
                            .input('Id', sql.Int, problem.id)
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes)
                            .input('CauseCode', sql.NVarChar(50), problem.causeCode) // เพิ่มตรงนี้
                            .query(`
                                UPDATE [Production_Analytics].[dbo].[BreakdownMaster]
                                SET Downtime = @Downtime, 
                                    UpdatedAt = GETDATE(),
                                    notes = @notes,
                                    CauseCode = @CauseCode
                                WHERE ID = @Id;
                                
                                SELECT ID, breakdownId, Cause, CauseCode, Downtime, notes
                                FROM [Production_Analytics].[dbo].[BreakdownMaster]
                                WHERE ID = @Id;
                            `);
                    } else {
                        // Insert new record 
                        console.log('Inserting new record');
                        result = await transaction.request()
                            .input('Date', sql.Date, new Date(date))
                            .input('MachineCode', sql.NVarChar(50), machineCode)
                            .input('DocNo', sql.NVarChar(50), docNo)
                            .input('Cause', sql.NVarChar(50), problem.description)
                            .input('CauseCode', sql.NVarChar(50), problem.causeCode) // เพิ่มตรงนี้
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes)
                            .query(`
                                INSERT INTO [Production_Analytics].[dbo].[BreakdownMaster]
                                (Date, MachineCode, DocNo, Cause, CauseCode, Downtime, UpdatedAt, notes)
                                VALUES (@Date, @MachineCode, @DocNo, @Cause, @CauseCode, @Downtime, GETDATE(), @notes);

                                SELECT SCOPE_IDENTITY() AS ID, NULL AS breakdownId, @Cause AS Cause, @CauseCode AS CauseCode, @Downtime AS Downtime, @notes AS notes;
                            `);
                    }
                    
                    console.log('Query result:', result);

                    if (result.recordset && result.recordset.length > 0) {
                        updatedProblems.push({
                            id: result.recordset[0].ID,
                            breakdownId: result.recordset[0].breakdownId,
                            description: result.recordset[0].Cause,
                            causeCode: result.recordset[0].CauseCode, // เพิ่มตรงนี้
                            downtime: result.recordset[0].Downtime,
                            notes: result.recordset[0].notes
                        });
                    } else {
                        console.log('Failed to update problem:', problem);
                    }
                }
            }

            await transaction.commit();
            console.log('Updated problems:', updatedProblems);

            res.json({ success: true, message: 'Causes updated successfully', updatedProblems });
        } catch (error) {
            await transaction.rollback();
            console.error('Error during transaction:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error updating causes:', error);
        res.status(500).json({ success: false, message: 'Failed to update causes', error: error.message });
    }
});

// POST Endpoint to receive data from Python and send a response
router.post('/python', async (req, res) => {
    try {
        const jsonData = req.body;
        
        // Check if data is an array or an object with key "data" containing an array
        const data = Array.isArray(jsonData) ? jsonData : jsonData.data;
        
        console.log('Received data:', data)
        
        if (Array.isArray(data)) {
            // Prepare the SQL query template to insert new data
            const insertQuery = `
                INSERT INTO Planing_SectionAny (MachineCode, DocNo, ProductionDate, ProductionQuantity, SectionID, Step)
                SELECT @MachineCode, @DocNo, @ProductionDate, @ProductionQuantity, @SectionID, @Step
                WHERE NOT EXISTS (
                    SELECT 1 FROM Planing_SectionAny 
                    WHERE MachineCode = @MachineCode
                    AND DocNo = @DocNo
                    AND ProductionDate = @ProductionDate
                    AND ProductionQuantity = @ProductionQuantity
                    AND SectionID = @SectionID
                    AND Step = @Step
                )
            `;
            
            // Array to store promises for each insert operation
            const promises = data.map(item => {
                return dbSQL.request()
                    .input('MachineCode', sql.NVarChar(50), item.MachineCode || '')
                    .input('DocNo', sql.NVarChar(30), item.DocNo)
                    .input('ProductionDate', sql.DateTime, new Date(item.ProductionDate))
                    .input('ProductionQuantity', sql.Float, item.ProductionQuantity)
                    .input('SectionID', sql.NVarChar(30), item.SectionID || '')
                    .input('Step', sql.NVarChar(10), item.Step || null)
                    .query(insertQuery);
            });
            
            await Promise.all(promises);
            // Return a response with a success message
            res.json({ message: 'Data received and stored successfully' });
        } else {
            // Send 400 Bad Request if data is not an array
            res.status(400).send('Data must be an array or an object with key "data" containing an array');
        }
    } catch (error) {
        // Log the error and send 500 Internal Server Error
        console.error('Error receiving data:', error);
        res.status(500).send('Error receiving data');
    }
});

// functions การทำ SSIS แบบ Incremental Load Lookup:PrintTime
// async function processIncrementalLoad() {
//     let sourcePoolWIP, sourcePoolMSWPLUS, destPool;
//     let rowsAdded = 0;
//     let softDeleteCount = 0;
//     let finalLastProcessedTime;
    
//     try {
//         console.log('Starting Incremental Load process...');
        
//         sourcePoolWIP = await connectSourceSql('WIP_MSW');
//         sourcePoolMSWPLUS = await connectSourceSql('MSWPLUS');
//         destPool = await connectDestSql();
//         if (!sourcePoolWIP || !sourcePoolMSWPLUS || !destPool) {
//             throw new Error('Failed to connect to databases');
//         }

//         let lastProcessedTime = await getLastProcessedTime(destPool);
//         console.log('Last processed time:', lastProcessedTime);

//         // ฟังก์ชันสำหรับดึงข้อมูลจากฐานข้อมูลแต่ละตัว
//         async function fetchDataFromSource(pool, databaseName) {
//             return await pool.request()
//             .input('lastProcessedTime', sql.DateTime, lastProcessedTime)
//             .query(`
//                 SELECT 
//                     w.[DocNo], w.[ItemType], w.[ItemCode], w.[CustName],
//                     w.[RSNCode], w.[ItemSize], w.[ItemQty], w.[ItemStatus],
//                     w.[MachineCode], w.[Remark], w.[UpdateDate], w.[UpdateBy], w.[CoilNo],
//                     w.[CurrentStep], w.[NextStep], w.[NCCode], w.[PrintTime], 
//                     COALESCE(w.[printWeight], w.[GrossWeight]) AS printWeight, -- คือถ้า printWeight เป็น NULL จะเอาค่าคอลัมน์ถัดไปมาใส่แทน
//                     w.[PlateNo],
//                     p.[PartName], p.[OrderWeight], p.[ItemLen],
//                     q.[SizeIn], q.[SizeOut], 
//                     d.[TimeIn]
//                 FROM [${databaseName}].[dbo].[tb_JobWIP] w
//                 LEFT JOIN [${databaseName}].[dbo].[tb_JobProduct] p ON w.[DocNo] = p.[DocNo]
//                 LEFT JOIN [${databaseName}].[dbo].[tb_Machine_Queue] q ON w.[DocNo] = q.[JobNo] AND w.[CurrentStep] = q.[Step]
//                 LEFT JOIN [${databaseName}].[dbo].[vDashboard] d ON w.RSNCode = d.OutRSNCode -- join RSNCode กับ OutRSNCode
//                 WHERE w.PrintTime > @lastProcessedTime
//                   AND (w.[DocNo] LIKE '%W24%'
//                    OR w.[DocNo] LIKE '%SP24%' OR w.[DocNo] LIKE '%EX24%'
//                    OR w.[DocNo] LIKE '%J24%' OR w.[DocNo] LIKE '%N24%'
//                    OR w.[DocNo] LIKE '%F24%' OR w.[DocNo] LIKE '%R24%' OR w.[DocNo] LIKE '%CP24%')
//                   AND w.[MachineCode] NOT LIKE 'COA%'
//                   AND w.[MachineCode] NOT LIKE 'RM0%'
//                   AND w.[MachineCode] NOT LIKE 'PAC%'
//                   AND w.[MachineCode] NOT LIKE 'JM0%'
//                 ORDER BY w.PrintTime
//             `);
//         }

//         // ดึงข้อมูลจากทั้งสองฐานข้อมูล
//         let resultWIP = await fetchDataFromSource(sourcePoolWIP, 'WIP_MSW');
//         let resultMSWPLUS = await fetchDataFromSource(sourcePoolMSWPLUS, 'MSWPLUS');

//         // รวมผลลัพธ์
//         let result = {
//             recordset: [...resultWIP.recordset, ...resultMSWPLUS.recordset].sort((a, b) => a.PrintTime - b.PrintTime)
//         };

//         console.log('Number of new records:', result.recordset.length);

//         if (result.recordset.length > 0) {
//             for (let row of result.recordset) {
//                 // Handle null values
//                 Object.keys(row).forEach(key => {
//                     if (row[key] === undefined) {
//                         row[key] = null;
//                     }
//                 });

//                 // Update MachineCode based on Remark
//                 row = updateMachineCodeFromRemark(row);

//                 const mergeResult = await destPool.request()
//                     .input('DocNo', sql.NVarChar(30), row.DocNo)
//                     .input('ItemType', sql.NVarChar(30), row.ItemType)
//                     .input('ItemCode', sql.NVarChar(100), row.ItemCode)
//                     // .input('ItemName', sql.NVarChar(500), row.ItemName)
//                     .input('CustName', sql.NVarChar(200), row.CustName)
//                     .input('RSNCode', sql.NVarChar(200), row.RSNCode)
//                     .input('ItemSize', sql.NVarChar(30), row.ItemSize)
//                     .input('ItemQty', sql.Float, row.ItemQty)
//                     .input('ItemStatus', sql.NVarChar(1), row.ItemStatus)
//                     .input('MachineCode', sql.NVarChar(50), row.MachineCode)
//                     .input('Remark', sql.NVarChar(200), row.Remark)
//                     .input('UpdateDate', sql.DateTime, row.UpdateDate)
//                     .input('UpdateBy', sql.NVarChar(30), row.UpdateBy)
//                     .input('CoilNo', sql.NVarChar(100), row.CoilNo)
//                     .input('CurrentStep', sql.NVarChar(10), row.CurrentStep)
//                     .input('NextStep', sql.NVarChar(10), row.NextStep)
//                     .input('NCCode', sql.NVarChar(50), row.NCCode)
//                     .input('PrintTime', sql.DateTime, row.PrintTime)
//                     .input('printWeight', sql.Float, row.printWeight)
//                     .input('Isdelete', sql.Bit, 0)
//                     .input('PartName', sql.NVarChar(500), row.PartName || null)
//                     .input('OrderWeight', sql.Float, row.OrderWeight ? parseFloat(row.OrderWeight) : null)
//                     .input('ItemLen', sql.NVarChar(50), row.ItemLen || null)
//                     .input('SizeIn', sql.NVarChar(50), row.SizeIn || null)
//                     .input('SizeOut', sql.NVarChar(50), row.SizeOut || null)
//                     .input('PlateNo', sql.NVarChar(50), row.PlateNo)
//                     .input('TimeIn', sql.DateTime, row.TimeIn)
//                     .query(`
// MERGE INTO [Production_Analytics].[dbo].[ProductionTrackingMaster] AS target
// USING (SELECT @PrintTime AS PrintTime) AS source
// ON (target.PrintTime = source.PrintTime)
// WHEN MATCHED AND target.Isdelete = 0 THEN
//     UPDATE SET
//     ItemType = @ItemType,
//     ItemCode = @ItemCode,
//     CustName = @CustName,
//     RSNCode = @RSNCode,
//     ItemSize = @ItemSize,
//     ItemQty = @ItemQty,
//     ItemStatus = @ItemStatus,
//     MachineCode = @MachineCode,
//     Remark = @Remark,
//     UpdateDate = @UpdateDate,
//     UpdateBy = @UpdateBy,
//     CoilNo = @CoilNo,
//     CurrentStep = @CurrentStep,
//     NextStep = @NextStep,
//     NCCode = @NCCode,
//     PrintTime = @PrintTime,
//     printWeight = @printWeight,
//     Isdelete = @Isdelete,
//     PartName = @PartName,  
//     OrderWeight = @OrderWeight,
//     ItemLen = @ItemLen,
//     SizeIn = @SizeIn,
//     SizeOut = @SizeOut,
//     PlateNo = @PlateNo,
//     TimeIn = @TimeIn -- เพิ่ม TimeIn
// WHEN NOT MATCHED THEN
//     INSERT (DocNo, ItemType, ItemCode, CustName, RSNCode, 
//             ItemSize, ItemQty, ItemStatus, MachineCode, Remark, UpdateDate, 
//             UpdateBy, CoilNo, CurrentStep, NextStep, NCCode, PrintTime, 
//             printWeight, Isdelete, PartName, OrderWeight, ItemLen, 
//             SizeIn, SizeOut, PlateNo, TimeIn)  
//     VALUES (@DocNo, @ItemType, @ItemCode, @CustName, @RSNCode, 
//             @ItemSize, @ItemQty, @ItemStatus, @MachineCode, @Remark, @UpdateDate, 
//             @UpdateBy, @CoilNo, @CurrentStep, @NextStep, @NCCode, @PrintTime, 
//             @printWeight, @Isdelete, @PartName, @OrderWeight, @ItemLen,
//             @SizeIn, @SizeOut, @PlateNo, @TimeIn); 

// SELECT @@ROWCOUNT AS AffectedRows;
// `)

//                 if (mergeResult.recordset[0].AffectedRows > 0) {
//                     rowsAdded++;
//                 }
//                 console.log(`Processed: DocNo: ${row.DocNo}, Action: ${mergeResult.recordset[0].AffectedRows > 0 ? 'Inserted/Updated' : 'No Action'}`);
//             }

//             finalLastProcessedTime = result.recordset[result.recordset.length - 1].PrintTime;
//             console.log(`Total rows processed: ${result.recordset.length}, Rows added/updated: ${rowsAdded}`);
//         }

//         // Soft delete process
//         if (finalLastProcessedTime) {
//             console.log('Starting soft delete process...');
            
//             let deleteResult = await destPool.request()
//                 .input('lastProcessedTime', sql.DateTime, finalLastProcessedTime)
//                 .query(`
//                     SELECT PrintTime
//                     FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
//                     WHERE PrintTime <= @lastProcessedTime
//                       AND Isdelete = 0
//                 `);

//             console.log('Number of records to check for soft delete:', deleteResult.recordset.length);

//             for (let row of deleteResult.recordset) {
//                 let sourceCheckWIP = await sourcePoolWIP.request()
//                     .input('PrintTime', sql.DateTime, row.PrintTime)
//                     .query(`
//                         SELECT TOP 1 1
//                         FROM [WIP_MSW].[dbo].[tb_JobWIP]
//                         WHERE PrintTime = @PrintTime
//                     `);
                
//                 let sourceCheckMSWPLUS = await sourcePoolMSWPLUS.request()
//                     .input('PrintTime', sql.DateTime, row.PrintTime)
//                     .query(`
//                         SELECT TOP 1 1
//                         FROM [MSWPLUS].[dbo].[tb_JobWIP]
//                         WHERE PrintTime = @PrintTime
//                     `);

//                 if (sourceCheckWIP.recordset.length === 0 && sourceCheckMSWPLUS.recordset.length === 0) {
//                     const softDeleteResult = await destPool.request()
//                         .input('PrintTime', sql.DateTime, row.PrintTime)
//                         .query(`
//                             UPDATE [Production_Analytics].[dbo].[ProductionTrackingMaster]
//                             SET Isdelete = 1
//                             WHERE PrintTime = @PrintTime AND Isdelete = 0;

//                             SELECT @@ROWCOUNT AS AffectedRows;
//                         `);

//                     if (softDeleteResult.recordset[0].AffectedRows > 0) {
//                         softDeleteCount++;
//                         console.log(`Soft deleted: PrintTime: ${row.PrintTime}`);
//                     }
//                 }
//             }

//             console.log(`Soft delete process completed. Total rows soft deleted: ${softDeleteCount}`);
//         }

//         await updateLastProcessedTime(
//             destPool, 
//             finalLastProcessedTime || lastProcessedTime, 
//             'Completed', 
//             finalLastProcessedTime ? 'Incremental load completed successfully' : 'No new data to process', 
//             rowsAdded, 
//             softDeleteCount
//         );

//         console.log('Incremental load completed successfully');
//         console.log(`Rows added/updated: ${rowsAdded}, Soft deletes: ${softDeleteCount}`);
//         return { rowsAdded, softDeleteCount };
//     } catch (err) {
//         console.error('Error during incremental load process:', err);
//         await updateLastProcessedTime(destPool, new Date(), 'Failed', `Error: ${err.message}`, rowsAdded, softDeleteCount);
//         throw err;
//     } finally {
//         if (sourcePoolWIP) {
//             await sourcePoolWIP.close();
//             console.log('WIP_MSW database connection closed');
//         }
//         if (sourcePoolMSWPLUS) {
//             await sourcePoolMSWPLUS.close();
//             console.log('MSWPLUS database connection closed');
//         }
//         if (destPool) {
//             await destPool.close();
//             console.log('Destination database connection closed');
//         }
//     }
// }

// // ฟังก์ชันสำหรับดึง Last Processed Time จาก DB: Destination ดึง PrintTime ล่าสุดมาใช้งาน 
// async function getLastProcessedTime(pool) {
//     try {
//         let result = await pool.request().query(`
//             SELECT MAX(PrintTime) AS LastProcessedTime
//             FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
//         `);
        
//         return result.recordset[0]?.LastProcessedTime || new Date('2000-01-01');
//     } catch (err) {
//         console.error('Error getting last processed time:', err);
//         return new Date('2000-01-01');
//     }
// }

// // ฟังก์ชันสำหรับอัพเดต Last Processed Time
// async function updateLastProcessedTime(pool, newTime, status = 'Completed', message = '', rowsAdded = 0, softDeleteCount = 0) {
//     try {
//         const result = await pool.request()
//             .input('newTime', sql.DateTime, newTime)
//             .input('status', sql.NVarChar(50), status)
//             .input('message', sql.NVarChar(sql.MAX), message)
//             .input('rowsAdded', sql.Int, rowsAdded)
//             .input('softDeleteCount', sql.Int, softDeleteCount)
//             .query(`
//                 INSERT INTO ProcessingLog 
//                 (LastProcessedTime, Status, Message, RowsAdded, SoftDeleteCount) 
//                 OUTPUT INSERTED.ID, INSERTED.LastProcessedTime, INSERTED.Status, INSERTED.RowsAdded, INSERTED.SoftDeleteCount
//                 VALUES 
//                 (@newTime, @status, @message, @rowsAdded, @softDeleteCount)
//             `);
        
//         console.log('ProcessingLog updated:', result.recordset[0]);
//     } catch (err) {
//         console.error('Error updating last processed time:', err);
//     }
// }

// function updateMachineCodeFromRemark(row) {
//     if (row.Remark) {
//         const match = row.Remark.match(/DRA\d{3}/);
//         if (match) {
//             row.MachineCode = match[0];
//         }
//     }
//     return row;
// }

// async function safeProcessIncrementalLoad() {
//     const release = await incrementalLoadMutex.acquire();
//     try {
//         console.log('Starting Incremental Load process...');
//         const result = await processIncrementalLoad();
//         console.log('Incremental load completed successfully');
//         console.log(`Rows added/updated: ${result.rowsAdded}, Soft deletes: ${result.softDeleteCount}`);
//         return result;
//     } catch (error) {
//         console.error('Error during incremental load process:', error);
//         throw error;
//     } finally {
//         release();
//     }
// }

// // ปรับปรุง cron job
// cron.schedule('*/10 * * * *', async () => {
//     console.log('Running scheduled incremental load job (10-minute interval)');
//     try {
//         await safeProcessIncrementalLoad();
//     } catch (error) {
//         console.error('Scheduled job failed:', error);
//     }
// });

// cron.schedule('50 7,19 * * *', async () => {
//     console.log('Running scheduled incremental load job (07:50 AM and 19:50 PM)');
//     try {
//         await safeProcessIncrementalLoad();
//     } catch (error) {
//         console.error('Scheduled job failed:', error);
//     }
// });

// // ปรับปรุง API endpoint
// router.get('/runIncrementalLoad', async (req, res) => {
//     try {
//         const result = await safeProcessIncrementalLoad();
//         res.json({ 
//             message: 'Incremental load process completed successfully',
//             rowsAdded: result.rowsAdded,
//             softDeleteCount: result.softDeleteCount
//         });
//     } catch (error) {
//         console.error('Error during incremental load:', error);
//         res.status(500).json({ error: 'An error occurred during incremental load', details: error.message });
//     }
// });

// // สำหรับเทส database
// router.get('/testSourceData', async (req, res) => {
//     try {
//         const sourcePoolWIP = await connectSourceSql('WIP_MSW');
//         const sourcePoolMSWPLUS = await connectSourceSql('MSWPLUS');
//         if (!sourcePoolWIP || !sourcePoolMSWPLUS) {
//             return res.status(500).json({ error: 'Failed to connect to source databases' });
//         }

//         async function fetchTestData(pool, databaseName) {
//             return await pool.request()
//                 .query(`
//                     SELECT TOP 10 
//                         [DocNo], [ItemType], [ItemCode], [CustName],
//                         [RSNCode], [ItemSize], [ItemQty], [ItemStatus],
//                         [MachineCode], [Remark], [UpdateDate], [UpdateBy], [CoilNo],
//                         [CurrentStep], [NextStep], [NCCode], [PrintTime], 
//                         COALESCE([printWeight], [ItemWeight]) AS printWeight,
//                         [PlateNo]
//                     FROM [${databaseName}].[dbo].[tb_JobWIP]
//                     WHERE ([DocNo] LIKE '%W24%'
//                        OR [DocNo] LIKE '%SP24%' OR [DocNo] LIKE '%EX24%'
//                        OR [DocNo] LIKE '%J24%' OR [DocNo] LIKE '%N24%'
//                        OR [DocNo] LIKE '%F24%' OR [DocNo] LIKE '%R24%')
//                       AND [MachineCode] NOT LIKE 'COA%'
//                       AND [MachineCode] NOT LIKE 'RM0%'
//                       AND [MachineCode] NOT LIKE 'PAC%'
//                       AND [MachineCode] NOT LIKE 'JM0%'
//                     ORDER BY PrintTime DESC
//                 `);
//         }

//         const resultWIP = await fetchTestData(sourcePoolWIP, 'WIP_MSW');
//         const resultMSWPLUS = await fetchTestData(sourcePoolMSWPLUS, 'MSWPLUS');

//         await sourcePoolWIP.close();
//         await sourcePoolMSWPLUS.close();

//         res.json({
//             WIP_MSW: resultWIP.recordset,
//             MSWPLUS: resultMSWPLUS.recordset
//         });
//     } catch (error) {
//         console.error('Error testing source data:', error);
//         res.status(500).json({ error: 'An error occurred while testing source data' });
//     }
// });



// Import service
const QuotationService = require('../src/services/quotation.service');
const CalculationService = require('../src/services/calculation.service');

// cal-Profile
router.post('/calculate-profile', async (req, res) => {
    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.calculateTotalPrice(req.body);
        
        res.json({
            success: true,
            totalPrice: result.totalPrice,
            details: result.details
        });
    } catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/material-categories', async (req, res) => {
    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.getMaterialCategories();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/material-grades/:categoryId', async (req, res) => {
    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.getMaterialGrades(req.params.categoryId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/shapes', async (req, res) => {
    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.getShapes();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/wire-types', async (req, res) => {
    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.getWireTypes();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/surface-emphasis', async (req, res) => {
    if (!dbSQL) {
        console.error('Database connection not available');
        return res.status(500).json({ error: 'Database connection not available' });
    }

    try {
        const calculationService = new CalculationService(dbSQL);
        const result = await calculationService.getSurfaceEmphasis();
        
        // เพิ่ม logging
        console.log('API response data:', result);
        
        res.json(result);
    } catch (error) {
        console.error('Error in surface-emphasis route:', error);
        res.status(500).json({ 
            error: 'Error fetching surface emphasis data',
            details: error.message
        });
    }
});


router.post('/save-quotation', async (req, res) => {
    if (!dbSQL) {
        return res.status(500).json({ error: 'Database connection not available' });
    }

    try {
        const quotationService = new QuotationService(dbSQL);
        const result = await quotationService.saveQuotation(req.body);
        res.json({
            success: true,
            quotationId: result.recordset[0].Id
        });
    } catch (error) {
        console.error('Error saving quotation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/quotation-history', async (req, res) => {
    if (!dbSQL) {
        return res.status(500).json({ error: 'Database connection not established' });
    }

    try {
        const result = await dbSQL.request()
            .query(`
                SELECT 
                    qh.*,
                    mg.GradeName,
                    s.ShapeName
                FROM QuotationHistory qh
                LEFT JOIN MaterialGrades mg ON qh.MaterialGradeId = mg.Id
                LEFT JOIN Shapes s ON qh.ShapeId = s.Id
                ORDER BY qh.QuotationDate DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching quotation history:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/quotation-history/search', async (req, res) => {
    if (!dbSQL) {
        return res.status(500).json({ error: 'Database connection not available' });
    }

    try {
        let query = `
            SELECT 
                qh.*,
                mg.GradeName,
                s.ShapeName
            FROM QuotationHistory qh
            LEFT JOIN MaterialGrades mg ON qh.MaterialGradeId = mg.Id
            LEFT JOIN Shapes s ON qh.ShapeId = s.Id
            WHERE 1=1
        `;

        const request = dbSQL.request();

        if (req.query.startDate) {
            query += ` AND qh.QuotationDate >= @StartDate`;
            request.input('StartDate', sql.DateTime, new Date(req.query.startDate));
        }

        if (req.query.endDate) {
            query += ` AND qh.QuotationDate <= @EndDate`;
            request.input('EndDate', sql.DateTime, new Date(req.query.endDate));
        }

        if (req.query.customerName) {
            query += ` AND qh.CustomerName LIKE @CustomerName`;
            request.input('CustomerName', sql.NVarChar, `%${req.query.customerName}%`);
        }

        if (req.query.status) {
            query += ` AND qh.Status = @Status`;
            request.input('Status', sql.NVarChar, req.query.status);
        }

        query += ` ORDER BY qh.QuotationDate DESC`;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error searching quotation history:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/quotation-history/:id', async (req, res) => {
    if (!dbSQL) {
        return res.status(500).json({ error: 'Database connection not available' });
    }

    try {
        const result = await dbSQL.request()
            .input('Id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    qh.*,
                    mg.GradeName,
                    s.ShapeName
                FROM QuotationHistory qh
                LEFT JOIN MaterialGrades mg ON qh.MaterialGradeId = mg.Id
                LEFT JOIN Shapes s ON qh.ShapeId = s.Id
                WHERE qh.Id = @Id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching quotation details:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST endpoint for saving quotation
router.post('/save-quotation', async (req, res) => {
    if (!dbSQL) {
        return res.status(500).json({ error: 'Database connection not available' });
    }

    try {
        const quotationService = new QuotationService(dbSQL);
        const result = await quotationService.saveQuotation(req.body);
        res.json({
            success: true,
            quotationId: result.recordset[0].Id
        });
    } catch (error) {
        console.error('Error saving quotation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


const OEEService = require('../src/services/oee.service');
const oeeService = new OEEService();  // สร้าง instance เดียว

router.get('/oee/summary', async (req, res) => {
    try {
        const { startDate, endDate, machineCode } = req.query;
        const result = await oeeService.calculateOEE(startDate, endDate, machineCode);
        
        // เพิ่ม logs ในการตอบกลับ
        res.json({
            success: true,
            data: result,
            logs: oeeService.getLogs(), // เพิ่มบรรทัดนี้
            timestamp: new Date()
        });
    } catch (error) {
        console.error('OEE Calculation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: oeeService.getLogs()
        });
    }
});

router.post('/oee/morningTalk', async (req, res) => {
    try {
        const { date, machineCode, downtime } = req.body;
        await oeeService.updateMorningTalk(date, machineCode, downtime);
        
        // ดึงข้อมูลใหม่โดยบังคับให้ไม่ใช้ cache
        const result = await oeeService.calculateOEE(date, date, machineCode, true);
        
        res.json({ 
            success: true, 
            data: result 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.get('/machines', async (req, res) => {
    try {
        const machines = await oeeService.getMachines();
        res.json(machines);
    } catch (error) {
        console.error('Error fetching machines:', error);
        res.status(500).json({ error: error.message });
    }
});

// Version2 SmartFactory
const Bar1Service = require('../src/services/bar1.service');

router.get('/bar1/v2/tableDaily', async (req, res) => {
    try {
        const { date } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getTableData(date);
        res.json(result); // ส่ง result โดยตรงเพราะ format ถูกจัดการใน service แล้ว
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/bar1/v2/machineDetails', async (req, res) => {
    try {
        const { machineCode, date } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getMachineDetails(machineCode, date); // มีแต่ async function showMachineDetails 
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/bar1/v2/updateRemark', async (req, res) => {
    try {
        const { docNo, rsnCode, remark, currentMachineCode, newMachineCode } = req.body;
        const service = new Bar1Service(dbSQL);
        const result = await service.updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/bar1/v2/updateCausesMswAll', async (req, res) => {
    try {
        const { date, machineCode, docNo, problems, deletedProblems } = req.body;
        const service = new Bar1Service(dbSQL);
        const result = await service.updateCausesMswAll(date, machineCode, docNo, problems, deletedProblems);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/bar1/v2/getCausesMswAll', async (req, res) => {
    try {
        const { date } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getCausesMswAll(date);
        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error fetching CausesMswAll:', error);
        res.status(500).json({ 
            error: 'Failed to fetch CausesMswAll', 
            details: error.message 
        });
    }
});

router.post('/bar1/v2/getCausesMswAll', async (req, res) => {
    try {
        const { date } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getCausesMswAll(date);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/bar1/v2/saveCause', async (req, res) => {
    try {
        const { data } = req.body;
        const service = new Bar1Service(dbSQL);
        const result = await service.saveCause(data);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/bar1/v2/weeklyReport', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getWeeklyReport(startDate, endDate);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/bar1/v2/monthlyData', async (req, res) => {
    try {
        const { month, year } = req.query;
        const service = new Bar1Service(dbSQL);
        const result = await service.getMonthlyData(month, year);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Version2 SmartFactory Annealing Form
const AnnealingService = require('../src/services/annealing.service');

router.get('/annealing/initial-data', async (req, res) => {
    try {
        const service = new AnnealingService(dbSQL)
        const result = await service.getInitialData()

        res.json(result)
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

router.get('/annealing/get-by-rsncode/:rsnCode', async (req, res) => {
    try {
        const service = new AnnealingService(dbSQL)
        const result = await service.getByRSNCode(req.params.rsnCode)

        if (result) {
            res.json(result)
        } else {
            res.status(404).json({ error: 'RSNCode not found' })
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})



module.exports = router;