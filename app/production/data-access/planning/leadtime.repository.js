// const sql = require('mssql');
// const { connectDestSql } = require('../../../../config/sqldb_dbconfig');

// class LeadTimeRepository {
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
//             // Parse stages data if stored as JSON
//             try {
//                 leadTime.stages = JSON.parse(leadTime.StagesData);
//                 delete leadTime.StagesData;
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

//     async getBaseLeadTime(productId) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('productId', sql.NVarChar, productId)
//                 .query(`
//                     SELECT 
//                         ProductId,
//                         StagesData
//                     FROM 
//                         [Production_Analytics].[dbo].[BaseLeadTimes]
//                     WHERE 
//                         ProductId = @productId
//                 `);
            
//             if (result.recordset.length === 0) {
//                 return null;
//             }
            
//             const baseLeadTime = result.recordset[0];
//             // Parse stages data if stored as JSON
//             try {
//                 baseLeadTime.stages = JSON.parse(baseLeadTime.StagesData);
//                 delete baseLeadTime.StagesData;
//             } catch (e) {
//                 baseLeadTime.stages = [];
//                 console.error('Error parsing stages data:', e);
//             }
            
//             return baseLeadTime;
//         } catch (error) {
//             console.error('Error in getBaseLeadTime repository:', error);
//             throw new Error(`Failed to get base lead time: ${error.message}`);
//         }
//     }

//     async getMachineConfigurations() {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .query(`
//                     SELECT 
//                         m.MachineCode,
//                         m.MachineName,
//                         m.Department,
//                         m.StationCode,
//                         m.HourlyCapacity,
//                         m.EfficiencyFactor,
//                         m.Status
//                     FROM 
//                         [Production_Analytics].[dbo].[MachineMaster] m
//                     WHERE 
//                         m.IsActive = 1
//                     ORDER BY
//                         m.Department, m.MachineCode
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getMachineConfigurations repository:', error);
//             throw new Error(`Failed to get machine configurations: ${error.message}`);
//         }
//     }

//     async getProductFactors(productId, grade, size) {
//         try {
//             const db = await this.getConnection();
//             // ข้อมูลตัวปรับแต่งตาม grade
//             const gradeFactors = await db.request()
//                 .input('productId', sql.NVarChar, productId)
//                 .query(`
//                     SELECT 
//                         Grade,
//                         AdjustmentFactor
//                     FROM 
//                         [Production_Analytics].[dbo].[ProductGradeFactors]
//                     WHERE 
//                         ProductId = @productId
//                 `);
            
//             // ข้อมูลตัวปรับแต่งตามขนาด
//             const sizeFactors = await db.request()
//                 .input('productId', sql.NVarChar, productId)
//                 .query(`
//                     SELECT 
//                         MinSize,
//                         MaxSize,
//                         AdjustmentFactor
//                     FROM 
//                         [Production_Analytics].[dbo].[ProductSizeFactors]
//                     WHERE 
//                         ProductId = @productId
//                 `);
            
//             // แปลงข้อมูล grade factors ให้อยู่ในรูปแบบ dictionary
//             const gradeFactorsDict = {};
//             for (const row of gradeFactors.recordset) {
//                 gradeFactorsDict[row.Grade] = row.AdjustmentFactor;
//             }
            
//             // แปลงข้อมูล size factors ให้อยู่ในรูปแบบ array ของ range
//             const sizeFactorsArray = sizeFactors.recordset.map(row => ({
//                 min: row.MinSize,
//                 max: row.MaxSize,
//                 factor: row.AdjustmentFactor
//             }));
            
//             return {
//                 gradeFactors: gradeFactorsDict,
//                 sizeFactors: sizeFactorsArray
//             };
//         } catch (error) {
//             console.error('Error in getProductFactors repository:', error);
//             throw new Error(`Failed to get product factors: ${error.message}`);
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

// module.exports = LeadTimeRepository;
