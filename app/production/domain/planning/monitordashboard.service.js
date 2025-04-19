// class MonitorDashboardService {
//     constructor(db) {
//         this.db = db;
//     }

//     async getMonitoringData() {
//         try {
//             const query = `
//                 SELECT 
//                     o.MfgId,
//                     o.ProductId,
//                     p.ProductName,
//                     o.CustomerName,
//                     o.OrderQuantity,
//                     o.DeliveryDate,
//                     ps.CurrentStage,
//                     ps.EstimatedCompletion,
//                     lt.TotalDays AS LeadTimeDays,
//                     CASE
//                         WHEN ps.ActualStartTime IS NULL THEN 'Not Started'
//                         WHEN ps.EstimatedCompletion > o.DeliveryDate THEN 'At Risk'
//                         ELSE 'On Track'
//                     END AS Status,
//                     CAST(
//                         DATEDIFF(DAY, GETDATE(), o.DeliveryDate) AS VARCHAR(10)
//                     ) + ' days' AS RemainingTime,
//                     CASE
//                         WHEN ps.EstimatedCompletion > o.DeliveryDate THEN 
//                             CAST(
//                                 DATEDIFF(DAY, o.DeliveryDate, ps.EstimatedCompletion) AS VARCHAR(10)
//                             ) + ' days delay'
//                         ELSE ''
//                     END AS Alert,
//                     CASE
//                         WHEN pm.Margin >= 30 THEN 'High'
//                         WHEN pm.Margin >= 20 THEN 'Medium'
//                         ELSE 'Low'
//                     END AS MarginLevel
//                 FROM 
//                     OrderMaster o
//                 JOIN
//                     ProductMaster p ON o.ProductId = p.ProductId
//                 LEFT JOIN
//                     ProductionStatus ps ON o.MfgId = ps.MfgId
//                 LEFT JOIN
//                     LeadTimes lt ON o.MfgId = lt.MfgId
//                 LEFT JOIN (
//                     SELECT 
//                         ProductId, 
//                         (UnitPrice - ProductionCost) / ProductionCost * 100 AS Margin
//                     FROM 
//                         ProductMaster
//                 ) pm ON o.ProductId = pm.ProductId
//                 WHERE 
//                     o.Status != 'Completed'
//                     AND o.Status != 'Cancelled'
//                 ORDER BY
//                     CASE
//                         WHEN ps.EstimatedCompletion > o.DeliveryDate THEN 0
//                         ELSE 1
//                     END,
//                     o.DeliveryDate
//             `;
            
//             const result = await this.db.request().query(query);
//             return result.recordset;
//         } catch (error) {
//             console.error('Error fetching monitoring data:', error);
//             throw error;
//         }
//     }

//     async getMachineMonitoringData() {
//         try {
//             const query = `
//                 WITH MachinePlannedCapacity AS (
//                     SELECT 
//                         m.MachineCode,
//                         m.MachineName,
//                         CASE 
//                             WHEN ms.RegularHours IS NULL THEN 8 
//                             ELSE ms.RegularHours 
//                         END AS RegularHours,
//                         CASE 
//                             WHEN ms.OvertimeHours IS NULL THEN 0 
//                             ELSE ms.OvertimeHours 
//                         END AS OvertimeHours,
//                         CASE
//                             WHEN mm.MaintenanceDate IS NOT NULL THEN 'Maintenance Scheduled'
//                             WHEN m.Status = 'Breakdown' THEN 'Breakdown'
//                             ELSE 'Operational'
//                         END AS Status
//                     FROM 
//                         MachineMaster m
//                     LEFT JOIN 
//                         MachineSchedule ms ON m.MachineCode = ms.MachineCode AND ms.ScheduleDate = CAST(GETDATE() AS DATE)
//                     LEFT JOIN 
//                         MachineMaintenance mm ON m.MachineCode = mm.MachineCode AND mm.MaintenanceDate = CAST(GETDATE() AS DATE)
//                     WHERE 
//                         m.IsActive = 1
//                 ),
//                 MachineCurrentWork AS (
//                     SELECT 
//                         pt.MachineCode,
//                         pt.DocNo,
//                         MAX(pt.PrintTime) AS LastActivity,
//                         COUNT(DISTINCT pt.RSNCode) AS ItemsProcessedToday,
//                         SUM(pt.printWeight) AS WeightProcessedToday,
//                         MAX(o.CustomerName) AS CustomerName,
//                         MAX(o.DeliveryDate) AS DeliveryDate,
//                         MAX(p.ProductName) AS ProductName
//                     FROM 
//                         ProductionTrackingMaster pt
//                     LEFT JOIN
//                         OrderMaster o ON pt.DocNo = o.MfgId
//                     LEFT JOIN
//                         ProductMaster p ON o.ProductId = p.ProductId
//                     WHERE 
//                         pt.PrintTime >= DATEADD(HOUR, 8, CAST(GETDATE() AS DATE))
//                         AND pt.PrintTime < DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(GETDATE() AS DATE)))
//                         AND pt.Isdelete = 0
//                     GROUP BY
//                         pt.MachineCode, pt.DocNo
//                 )
//                 SELECT 
//                     c.MachineCode,
//                     c.MachineName,
//                     c.RegularHours,
//                     c.OvertimeHours,
//                     c.Status,
//                     w.DocNo AS CurrentMfgId,
//                     w.CustomerName,
//                     w.DeliveryDate,
//                     w.ProductName,
//                     w.WeightProcessedToday,
//                     w.ItemsProcessedToday,
//                     w.LastActivity,
//                     CASE
//                         WHEN w.DeliveryDate IS NOT NULL AND w.DeliveryDate < DATEADD(DAY, 3, GETDATE()) THEN 'Urgent'
//                         WHEN c.Status = 'Breakdown' THEN 'Alert'
//                         ELSE 'Normal'
//                     END AS AlertLevel
//                 FROM 
//                     MachinePlannedCapacity c
//                 LEFT JOIN
//                     MachineCurrentWork w ON c.MachineCode = w.MachineCode
//                 ORDER BY
//                     CASE
//                         WHEN c.Status = 'Breakdown' THEN 0
//                         WHEN w.DeliveryDate IS NOT NULL AND w.DeliveryDate < DATEADD(DAY, 3, GETDATE()) THEN 1
//                         ELSE 2
//                     END,
//                     c.MachineCode
//             `;
            
//             const result = await this.db.request().query(query);
//             return result.recordset;
//         } catch (error) {
//             console.error('Error fetching machine monitoring data:', error);
//             throw error;
//         }
//     }

//     async generateOptimizationSuggestions() {
//         try {
//             // Analyze current production and provide optimization suggestions
//             const query = `
//                 WITH DelayedOrders AS (
//                     SELECT 
//                         o.MfgId,
//                         o.ProductId,
//                         p.ProductName,
//                         o.CustomerName,
//                         o.DeliveryDate,
//                         ps.EstimatedCompletion,
//                         DATEDIFF(DAY, o.DeliveryDate, ps.EstimatedCompletion) AS DelayDays,
//                         (pm.UnitPrice - pm.ProductionCost) / pm.ProductionCost * 100 AS Margin
//                     FROM 
//                         OrderMaster o
//                     JOIN 
//                         ProductMaster pm ON o.ProductId = pm.ProductId
//                     JOIN 
//                         ProductMaster p ON o.ProductId = p.ProductId
//                     JOIN 
//                         ProductionStatus ps ON o.MfgId = ps.MfgId
//                     WHERE 
//                         ps.EstimatedCompletion > o.DeliveryDate
//                         AND o.Status = 'Active'
//                 ),
//                 LowMarginOrders AS (
//                     SELECT 
//                         o.MfgId,
//                         o.ProductId,
//                         p.ProductName,
//                         o.CustomerName,
//                         o.DeliveryDate,
//                         (pm.UnitPrice - pm.ProductionCost) / pm.ProductionCost * 100 AS Margin
//                     FROM 
//                         OrderMaster o
//                     JOIN 
//                         ProductMaster pm ON o.ProductId = pm.ProductId
//                     JOIN 
//                         ProductMaster p ON o.ProductId = p.ProductId
//                     LEFT JOIN
//                         ProductionStatus ps ON o.MfgId = ps.MfgId
//                     WHERE 
//                         (pm.UnitPrice - pm.ProductionCost) / pm.ProductionCost * 100 < 20
//                         AND (ps.CurrentStage IS NULL OR ps.CurrentStage = '')
//                         AND o.Status = 'Active'
//                 )
//                 SELECT 
//                     'Reschedule Low Margin Orders' AS SuggestionType,
//                     'Consider rescheduling these low margin orders to prioritize high margin products' AS Description,
//                     JSON_QUERY((
//                         SELECT MfgId, ProductName, CustomerName, DeliveryDate, Margin
//                         FROM LowMarginOrders
//                         FOR JSON PATH
//                     )) AS RelatedOrders
                
//                 UNION ALL
                
//                 SELECT 
//                     'Add Overtime for Delayed Orders' AS SuggestionType,
//                     'Add overtime to ensure these high margin delayed orders are completed on time' AS Description,
//                     JSON_QUERY((
//                         SELECT MfgId, ProductName, CustomerName, DeliveryDate, EstimatedCompletion, DelayDays, Margin
//                         FROM DelayedOrders
//                         WHERE Margin > 30
//                         FOR JSON PATH
//                     )) AS RelatedOrders
                
//                 UNION ALL
                
//                 SELECT 
//                     'Communicate Delays to Customers' AS SuggestionType,
//                     'Inform customers about potential delays for these orders' AS Description,
//                     JSON_QUERY((
//                         SELECT MfgId, ProductName, CustomerName, DeliveryDate, EstimatedCompletion, DelayDays
//                         FROM DelayedOrders
//                         WHERE DelayDays > 5
//                         FOR JSON PATH
//                     )) AS RelatedOrders
//             `;
            
//             const result = await this.db.request().query(query);
//             return result.recordset;
//         } catch (error) {
//             console.error('Error generating optimization suggestions:', error);
//             throw error;
//         }
//     }
// }