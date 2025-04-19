// const sql = require('mssql');
// const { connectDestSql } = require('../../../../config/sqldb_dbconfig');

// class PlanningRepository {
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

//     async getMachineCapacityData(startDate, endDate) {
//         try {
//             const db = await this.getConnection();
            
//             // First, get machine basic data
//             const machines = await db.request()
//                 .input('startDate', sql.Date, new Date(startDate))
//                 .input('endDate', sql.Date, new Date(endDate))
//                 .query(`
//                     SELECT 
//                         m.MachineCode,
//                         m.MachineName,
//                         m.Department,
//                         m.Status,
//                         CASE
//                             WHEN ms.OvertimeHours IS NULL THEN 0
//                             ELSE ms.OvertimeHours
//                         END AS OvertimeHours,
//                         CASE
//                             WHEN ms.RegularHours IS NULL THEN 8
//                             ELSE ms.RegularHours
//                         END AS RegularHours
//                     FROM 
//                         [Production_Analytics].[dbo].[MachineMaster] m
//                     LEFT JOIN
//                         [Production_Analytics].[dbo].[MachineSchedule] ms
//                         ON m.MachineCode = ms.MachineCode
//                         AND ms.ScheduleDate BETWEEN @startDate AND @endDate
//                     WHERE 
//                         m.IsActive = 1
//                     GROUP BY
//                         m.MachineCode,
//                         m.MachineName,
//                         m.Department,
//                         m.Status,
//                         ms.OvertimeHours,
//                         ms.RegularHours
//                 `);
            
//             // Then, for each machine, get scheduled jobs
//             for (const machine of machines.recordset) {
//                 const scheduledJobs = await db.request()
//                     .input('machineCode', sql.NVarChar, machine.MachineCode)
//                     .input('startDate', sql.Date, new Date(startDate))
//                     .input('endDate', sql.Date, new Date(endDate))
//                     .query(`
//                         SELECT 
//                             p.DocNo,
//                             p.ProductionDate,
//                             p.ProductionQuantity,
//                             p.Step,
//                             COALESCE(pt.EstimatedHours, 
//                                 (p.ProductionQuantity / NULLIF(mc.HourlyCapacity, 0))) AS EstimatedHours,
//                             pt.IsHighMargin
//                         FROM 
//                             [Production_Analytics].[dbo].[Planing_SectionAny] p
//                         LEFT JOIN
//                             [Production_Analytics].[dbo].[ProductionTimes] pt
//                             ON p.DocNo = pt.DocNo AND p.MachineCode = pt.MachineCode
//                         LEFT JOIN
//                             [Production_Analytics].[dbo].[MachineCapacity] mc
//                             ON p.MachineCode = mc.MachineCode
//                         WHERE 
//                             p.MachineCode = @machineCode
//                             AND p.ProductionDate BETWEEN @startDate AND @endDate
//                         ORDER BY
//                             p.ProductionDate, p.DocNo
//                     `);
                
//                 machine.scheduledJobs = scheduledJobs.recordset;
//             }
            
//             return machines.recordset;
//         } catch (error) {
//             console.error('Error in getMachineCapacityData repository:', error);
//             throw new Error(`Failed to get machine capacity data: ${error.message}`);
//         }
//     }

//     async getHighMarginProducts() {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .query(`
//                     SELECT 
//                         p.ProductId,
//                         p.ProductName,
//                         p.Category,
//                         p.Grade,
//                         p.Size,
//                         p.UnitPrice,
//                         p.ProductionCost,
//                         (p.UnitPrice - p.ProductionCost) / p.ProductionCost * 100 AS Margin,
//                         CASE
//                             WHEN (p.UnitPrice - p.ProductionCost) / p.ProductionCost * 100 >= 30 THEN 1
//                             ELSE 0
//                         END AS IsHighMargin
//                     FROM 
//                         [Production_Analytics].[dbo].[ProductMaster] p
//                     WHERE 
//                         p.IsActive = 1
//                     ORDER BY 
//                         Margin DESC
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getHighMarginProducts repository:', error);
//             throw new Error(`Failed to get high margin products: ${error.message}`);
//         }
//     }

//     async getLeadTimeForMfg(mfgId) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('mfgId', sql.NVarChar, mfgId)
//                 .query(`
//                     SELECT 
//                         l.MfgId,
//                         l.ProductId,
//                         l.TotalDays,
//                         l.Grade,
//                         l.Size,
//                         l.StagesData
//                     FROM 
//                         [Production_Analytics].[dbo].[LeadTimes] l
//                     WHERE 
//                         l.MfgId = @mfgId
//                 `);
            
//             if (result.recordset.length === 0) {
//                 return null;
//             }
            
//             const leadTime = result.recordset[0];
//             // Parse the stages data if stored as JSON string
//             try {
//                 leadTime.stages = JSON.parse(leadTime.StagesData);
//                 delete leadTime.StagesData; // Remove the JSON string field
//             } catch (e) {
//                 leadTime.stages = [];
//                 console.error('Error parsing stages data:', e);
//             }
            
//             return leadTime;
//         } catch (error) {
//             console.error('Error in getLeadTimeForMfg repository:', error);
//             throw new Error(`Failed to get lead time for MFG: ${error.message}`);
//         }
//     }

//     async getProductionStatus(mfgId) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('mfgId', sql.NVarChar, mfgId)
//                 .query(`
//                     SELECT 
//                         ps.MfgId,
//                         ps.CurrentStage,
//                         ps.CurrentStageStartTime,
//                         ps.CompletedStagesData,
//                         ps.CurrentStageDelays,
//                         ps.EstimatedCompletion,
//                         ps.ActualStartTime,
//                         ps.LastUpdated
//                     FROM 
//                         [Production_Analytics].[dbo].[ProductionStatus] ps
//                     WHERE 
//                         ps.MfgId = @mfgId
//                 `);
            
//             if (result.recordset.length === 0) {
//                 return {
//                     mfgId,
//                     currentStage: null,
//                     completedStages: [],
//                     currentStageDelays: 0,
//                     hasStarted: false
//                 };
//             }
            
//             const status = result.recordset[0];
//             // Parse the completed stages data if stored as JSON string
//             try {
//                 status.completedStages = JSON.parse(status.CompletedStagesData);
//                 delete status.CompletedStagesData; // Remove the JSON string field
//             } catch (e) {
//                 status.completedStages = [];
//                 console.error('Error parsing completed stages data:', e);
//             }
            
//             status.hasStarted = !!status.ActualStartTime;
            
//             return status;
//         } catch (error) {
//             console.error('Error in getProductionStatus repository:', error);
//             throw new Error(`Failed to get production status: ${error.message}`);
//         }
//     }

//     async getProductionMonitoringData() {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .query(`
//                     SELECT 
//                         o.MfgId,
//                         o.ProductId,
//                         p.ProductName,
//                         o.CustomerName,
//                         o.OrderQuantity,
//                         o.DeliveryDate,
//                         ps.CurrentStage,
//                         ps.EstimatedCompletion,
//                         ps.ActualStartTime,
//                         lt.TotalDays AS LeadTimeDays,
//                         CASE
//                             WHEN ps.ActualStartTime IS NOT NULL THEN 1
//                             ELSE 0
//                         END AS HasStarted,
//                         (pm.UnitPrice - pm.ProductionCost) / pm.ProductionCost * 100 AS Margin,
//                         CASE
//                             WHEN (pm.UnitPrice - pm.ProductionCost) / pm.ProductionCost * 100 >= 30 THEN 1
//                             ELSE 0
//                         END AS IsHighMargin
//                     FROM 
//                         [Production_Analytics].[dbo].[OrderMaster] o
//                     JOIN
//                         [Production_Analytics].[dbo].[ProductMaster] p ON o.ProductId = p.ProductId
//                     LEFT JOIN
//                         [Production_Analytics].[dbo].[ProductionStatus] ps ON o.MfgId = ps.MfgId
//                     LEFT JOIN
//                         [Production_Analytics].[dbo].[LeadTimes] lt ON o.MfgId = lt.MfgId
//                     LEFT JOIN
//                         [Production_Analytics].[dbo].[ProductMaster] pm ON o.ProductId = pm.ProductId
//                     WHERE 
//                         o.Status != 'Completed'
//                         AND o.Status != 'Cancelled'
//                     ORDER BY
//                         o.DeliveryDate ASC
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getProductionMonitoringData repository:', error);
//             throw new Error(`Failed to get production monitoring data: ${error.message}`);
//         }
//     }

//     async saveLeadTime(mfgId, productId, leadTimeData) {
//         try {
//             const db = await this.getConnection();
//             // แปลงข้อมูล stages เป็น JSON string
//             const stagesJSON = JSON.stringify(leadTimeData.stages);
            
//             // บันทึกข้อมูล lead time
//             await db.request()
//                 .input('mfgId', sql.NVarChar, mfgId)
//                 .input('productId', sql.NVarChar, productId)
//                 .input('totalDays', sql.Int, leadTimeData.totalDays)
//                 .input('grade', sql.NVarChar, leadTimeData.grade)
//                 .input('size', sql.NVarChar, leadTimeData.size)
//                 .input('stagesData', sql.NVarChar(sql.MAX), stagesJSON)
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[LeadTimes] AS target
//                     USING (VALUES (@mfgId)) AS source (MfgId)
//                     ON target.MfgId = source.MfgId
//                     WHEN MATCHED THEN
//                         UPDATE SET 
//                             ProductId = @productId,
//                             TotalDays = @totalDays,
//                             Grade = @grade,
//                             Size = @size,
//                             StagesData = @stagesData,
//                             UpdatedAt = GETDATE()
//                     WHEN NOT MATCHED THEN
//                         INSERT (MfgId, ProductId, TotalDays, Grade, Size, StagesData)
//                         VALUES (@mfgId, @productId, @totalDays, @grade, @size, @stagesData);
//                 `);
            
//             return true;
//         } catch (error) {
//             console.error('Error in saveLeadTime repository:', error);
//             throw new Error(`Failed to save lead time: ${error.message}`);
//         }
//     }

//     async getProductDetails(productId) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('productId', sql.NVarChar, productId)
//                 .query(`
//                     SELECT 
//                         p.ProductId,
//                         p.ProductName,
//                         p.Category,
//                         p.Complexity,
//                         CASE
//                             WHEN (p.UnitPrice - p.ProductionCost) / p.ProductionCost * 100 >= 30 THEN 'high'
//                             WHEN (p.UnitPrice - p.ProductionCost) / p.ProductionCost * 100 >= 20 THEN 'medium'
//                             ELSE 'low'
//                         END AS priority,
//                         (SELECT COUNT(*) FROM [Production_Analytics].[dbo].[OrderMaster] o 
//                          WHERE o.ProductId = p.ProductId AND o.Status = 'Active') AS currentWorkload
//                     FROM 
//                         [Production_Analytics].[dbo].[ProductMaster] p
//                     WHERE 
//                         p.ProductId = @productId
//                 `);
            
//             if (result.recordset.length === 0) {
//                 return {
//                     productId,
//                     currentWorkload: 0,
//                     priority: 'medium',
//                     complexity: 'medium'
//                 };
//             }
            
//             return result.recordset[0];
//         } catch (error) {
//             console.error('Error in getProductDetails repository:', error);
//             throw new Error(`Failed to get product details: ${error.message}`);
//         }
//     }
// }

// module.exports = PlanningRepository;
