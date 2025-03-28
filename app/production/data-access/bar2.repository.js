// const sql = require('mssql/msnodesqlv8')
// const { connectDestSql } = require('../../../config/sqldb_dbconfig');

// class Bar2Repository {
//     constructor() {
//         this.dbConnection = null;
//     }

//     async getConnection() {
//         try {
//             if (!this.dbConnection || !this.dbConnection.connected) {
//                 this.dbConnection = await connectDestSql();
//             }
//             return this.dbConnection;
//         } catch (error) {
//             console.error('Database connection error:', error);
//             throw error;
//         }
//     }

//     // 1. Daily Production Dashboard
//     async getDailyProductionData(data, machineCodePrefix) {
//         const db = await this.getConnection();
//         const result = await db.request()
//             .input('date', sql.Date, new Date(date))
//             .input('machineCodePrefix', sql.VarChar, machineCodePrefix)
//             .query(`
//                 WITH DailyWIP AS (
//                     SELECT 
//                         MachineCode,
//                         DocNo,
//                         CAST(@date AS DATE) AS ProductionDate,
//                         SUM(printWeight) AS TotalWIPWeight,
//                         MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
//                         MAX(Remark) AS Remark,
//                         MAX(CustName) AS CustName,
//                         MAX(OrderWeight) AS OrderWeight,
//                         MAX(SizeIn) AS SizeIn,
//                         MAX(SizeOut) AS SizeOut,
//                         MAX(PartName) AS PartName,
//                         MAX(CurrentStep) AS CurrentStep
//                     FROM
//                         [Production_Analytics].[dbo].[ProductionTrackingMaster]
//                     WHERE 
//                         PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
//                         AND PrintTime < DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@date AS DATETIME)))
//                         AND ItemType != 'NG'
//                         AND ItemType != 'RM'
//                         AND MachineCode LIKE @machineCodePrefix + '%'
//                         AND Isdelete = 0
//                     GROUP BY
//                         MachineCode, DocNo
//                 ), 
//                 PlanData AS (
//                     SELECT
//                         MachineCode,
//                         DocNo,
//                         SUM(ProductionQuantity) AS [Plan],
//                         MAX(Step) AS PlanStep
//                     FROM
//                         [Production_Analytics].[dbo].[Planing_SectionAny]
//                     WHERE
//                         ProductionDate = @date
//                         AND MachineCode LIKE @machineCodePrefix + '%'

//                     GROUP BY
//                         MachineCode, DocNo
//                 ),
//                 CombinedData AS (
//                     SELECT 
//                         COALESCE(w.MachineCode, p.MachineCode) AS MachineCode,
//                         COALESCE(w.DocNo, p.DocNo) AS DocNo,
//                         w.TotalWIPWeight AS Actual,
//                         p.[Plan],
//                         w.LastPrintTime AS PrintTime,
//                         w.Remark,
//                         w.CustName,
//                         w.OrderWeight,
//                         w.SizeIn,
//                         w.SizeOut,
//                         w.PartName,
//                         w.CurrentStep,
//                         p.PlanStep,
//                         0 AS IsOnlyPlan
//                     FROM
//                         DailyWIP w  
//                     FULL OUTER JOIN
//                         PlanData p ON w.MachineCode = p.MachineCode AND w.DocNo = p.DocNo  
                
//                     UNION ALL

//                     SELECT
//                         p.MachineCode,
//                         p.DocNo,
//                         NULL AS Actual,
//                         p.[Plan],
//                         NULL AS Actual,
//                         p.[Plan],
//                         NULL AS PrintTime,
//                         'Plan Only' AS Remark,
//                         NULL AS CustName,
//                         NULL AS OrderWeight,
//                         NULL AS SizeIn,
//                         NULL AS SizeOut,
//                         NULL AS PartName,
//                         NULL AS CurrentStep,
//                         p.PlanStep,
//                         1 AS IsOnlyPlan
//                     FROM
//                         PlanData p
//                     LEFT JOIN
//                         DailyWIP w ON p.MachineCode = w.MachineCode AND p.DocNo = w.DocNo
//                     WHERE
//                         w.DocNo IS NULL
//                 )
//                 SELECT
//                     c.MachineCode,
//                     c.DocNo,
//                     c.Actual,
//                     c.[Plan],
//                     c.PrintTime,
//                     c.Remark,
//                     c.CustName,
//                     c.OrderWeight,
//                     c.SizeIn,
//                     c.SizeOut,
//                     c.PartName,
//                     c.CurrentStep,
//                     c.PlanStep
//                 FROM
//                     CombinedData c
//                 ORDER BY
//                     c.MachineCode,
//                     c.DocNo,
//                     c.IsOnlyPlan;
//                 `);
//         return result.recordset;
//     }

// // 2. Machine Details
// async getMachineDetails(startDate, endDate, machineCode) {
//     const db = await this.getConnection();
//     return await db.request()
//         .input('startDate', sql.DateTime, startDate)
//         .input('endDate', sql.DateTime, endDate)
//         .input('machineCode', sql.VarChar, machineCode)
//         .query(`
//             SELECT 
//                 p.MachineCode,
//                 p.DocNo,
//                 p.ItemType,
//                 p.ItemQty,
//                 p.printWeight,
//                 p.CoilNo,
//                 p.PrintTime,
//                 p.MachineCode,
//                 p.Remark,
//                 p.RSNCode,
//                 p.NextStep,
//                 p.PlateNo,
//                 pl.ProductionQuantity AS [Plan],
//                 MAX(dpc.Cause) AS Cause,
//                 MAX(dpc.Downtime) AS Downtime
//             FROM 
//                 [Production_Analytics].[dbo].[ProductionTrackingMaster] p
//             LEFT JOIN
//                 [Production_Analytics].[dbo].[Planing_SectionAny] pl
//                 ON p.MachineCode = pl.MachineCode
//                 AND p.DocNo = pl.DocNo
//                 AND CAST(p.PrintTime AS DATE) = pl.ProductionDate
//             LEFT JOIN
//                 [Production_Analytics].[dbo].[DailyProductionCauses] dpc
//                 ON p.MachineCode = dpc.MachineCode
//                 AND p.DocNo = dpc.DocNo    
//                 AND CAST(p.PrintTime AS DATE) = dpc.Date
//             WHERE 
//                 LEFT(p.MachineCode, 6) = LEFT(@machineCode, 6)
//                 AND p.PrintTime BETWEEN @startDate AND @endDate
//                 AND p.Isdelete = 0
//                 AND p.ItemType != 'NG'
//             GROUP BY
//                 p.MachineCode,
//                 p.DocNo,
//                 p.ItemType,
//                 p.ItemQty,
//                 p.printWeight,
//                 p.CoilNo,
//                 p.PrintTime,
//                 p.Remark,
//                 p.RSNCode,
//                 p.NextStep,
//                 p.PlateNo,
//                 pl.ProductionQuantity
//             ORDER BY
//                 p.PrintTime                                      
//         `);
// }

// // 3. Plan Data
// async getPlanData(date, department) {
//     const db = await this.getConnection();
//     return await db.request()
//         .input('date', sql.Date, new Date(date))
//         .input('machinePattern', sql.NVarChar, department === 'CUT' ? 'CUT' : '')
//         .query(`
//             SELECT [No], DocNo, MachineCode, ProductionQuantity, Step
//             FROM [Production_Analytics].[dbo].[Planing_SectionAny]
//             WHERE ProductionDate = @date
//             AND MachineCode LIKE @machinePattern
//             ORDER BY MachineCode
//         `);
// }

// // 4. Chart Data
// async getChartData(startDate, endDate) {
//     const db  = await this.getConnection();
//     const result = await db.request()
//         .input('startDate', sql.Date, new Date(startDate))
//         .input('endDate', sql.Date, new Date(endDate))
//         .query(`
//             WITH DailyPlan AS (
//                 SELECT
//                     MachineCode,
//                     SUM(ProductionQuantity) AS TotalPlan
//                 FROM 
//                     [Production_Analytics].[dbo].[Planing_SectionAny]
//                 WHERE 
//                     ProductionDate BETWEEN @startDate AND @endDate
//                     AND MachineCode LIKE 'CUT%'
//                 GROUP BY
//                     MachineCode
//             ),
//             DailyActual AS (
//                 SELECT
//                     MachineCode,
//                     SUM(CASE WHEN ItemType = 'WIP' THEN printWeight ELSE 0 END) AS TotalActual,
//                     SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS TotalNG
//                 FROM 
//                     [Production_Analytics].[dbo].[ProductionTrackingMaster]
//                 WHERE 
//                     PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME))
//                     AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
//                     AND MachineCode LIKE 'CUT%'
//                     AND Isdelete = 0
//                 GROUP BY
//                     MachineCode
//             )    
//             SELECT
//                 COALESCE(p.MachineCode, a.MachineCode) AS MachineCode,
//                 ISNULL(p.TotalPlan, 0) AS PlanQuantity,
//                 ISNULL(a.TotalActual, 0) AS ActualQuantity,
//                 ISNULL(a.TotalNG, 0) AS NGQuantity
//             FROM
//                 DailyPlan p
//             FULL OUTER JOIN
//                 DailyActual a ON p.MachineCode = a.MachineCode
//             ORDER BY
//                 COALESCE(p.MachineCode, a.MachineCode)
//         `);
//     return result.recordset;
// }

// // 5. Weekly Report
// async getWeeklyReportData(startDate, endDate) {
//     const db = await this.getConnection();
//     return await db.request()
//         .input('StartDate', sql.Date, new Date(startDate))
//         .input('EndDate', sql.Date, new Date(endDate))
//         .query(`
//             WITH DailyPlan AS (
//                 SELECT
//                     MachineCode,
//                     ProductionDate,
//                     SUM(ProductionQuantity) AS DailyPlan
//                 FROM 
//                     [Production_Analytics].[dbo].[Planing_SectionAny]
//                 WHERE 
                    
//             )    
//         `)
// }

// }