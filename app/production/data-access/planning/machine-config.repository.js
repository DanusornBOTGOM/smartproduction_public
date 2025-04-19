// const sql = require('mssql');
// const { connectDestSql } = require('../../../../config/sqldb_dbconfig');

// class MachineConfigRepository {
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
//                         m.Status,
//                         m.LastMaintenance,
//                         m.NextMaintenance
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

//     async updateMachineConfiguration(machineCode, productionTimes) {
//         try {
//             const db = await this.getConnection();
//             const transaction = new sql.Transaction(db);
//             await transaction.begin();
            
//             try {
//                 // Update machine master record
//                 await transaction.request()
//                     .input('MachineCode', machineCode)
//                     .input('HourlyCapacity', productionTimes.hourlyCapacity || 0)
//                     .input('EfficiencyFactor', productionTimes.efficiencyFactor || 1.0)
//                     .query(`
//                         UPDATE [Production_Analytics].[dbo].[MachineMaster]
//                         SET HourlyCapacity = @HourlyCapacity,
//                             EfficiencyFactor = @EfficiencyFactor,
//                             UpdatedAt = GETDATE()
//                         WHERE MachineCode = @MachineCode
//                     `);
                
//                 // Update or insert product-specific production times
//                 if (productionTimes.products && productionTimes.products.length > 0) {
//                     for (const product of productionTimes.products) {
//                         await transaction.request()
//                             .input('MachineCode', machineCode)
//                             .input('ProductId', product.productId)
//                             .input('GradeId', product.gradeId || null)
//                             .input('SizeMin', product.sizeMin || null)
//                             .input('SizeMax', product.sizeMax || null)
//                             .input('ProcessingTime', product.processingTime)
//                             .query(`
//                                 MERGE INTO [Production_Analytics].[dbo].[MachineProductionTimes] AS target
//                                 USING (VALUES (@MachineCode, @ProductId, @GradeId, @SizeMin, @SizeMax)) 
//                                       AS source (MachineCode, ProductId, GradeId, SizeMin, SizeMax)
//                                 ON target.MachineCode = source.MachineCode 
//                                    AND target.ProductId = source.ProductId
//                                    AND ISNULL(target.GradeId, 0) = ISNULL(source.GradeId, 0)
//                                    AND ISNULL(target.SizeMin, 0) = ISNULL(source.SizeMin, 0)
//                                    AND ISNULL(target.SizeMax, 0) = ISNULL(source.SizeMax, 0)
//                                 WHEN MATCHED THEN
//                                     UPDATE SET ProcessingTime = @ProcessingTime, UpdatedAt = GETDATE()
//                                 WHEN NOT MATCHED THEN
//                                     INSERT (MachineCode, ProductId, GradeId, SizeMin, SizeMax, ProcessingTime)
//                                     VALUES (@MachineCode, @ProductId, @GradeId, @SizeMin, @SizeMax, @ProcessingTime);
//                             `);
//                     }
//                 }
                
//                 await transaction.commit();
//                 return { success: true };
//             } catch (error) {
//                 await transaction.rollback();
//                 throw error;
//             }
//         } catch (error) {
//             console.error('Error in updateMachineConfiguration repository:', error);
//             throw new Error(`Failed to update machine configuration: ${error.message}`);
//         }
//     }

//     async getOvertimeSchedule(startDate, endDate) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('startDate', sql.Date, new Date(startDate))
//                 .input('endDate', sql.Date, new Date(endDate))
//                 .query(`
//                     SELECT 
//                         ms.MachineCode,
//                         m.MachineName,
//                         ms.ScheduleDate,
//                         ms.RegularHours,
//                         ms.OvertimeHours
//                     FROM 
//                         [Production_Analytics].[dbo].[MachineSchedule] ms
//                     JOIN
//                         [Production_Analytics].[dbo].[MachineMaster] m ON ms.MachineCode = m.MachineCode
//                     WHERE 
//                         ms.ScheduleDate BETWEEN @startDate AND @endDate
//                     ORDER BY
//                         ms.ScheduleDate, ms.MachineCode
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getOvertimeSchedule repository:', error);
//             throw new Error(`Failed to get overtime schedule: ${error.message}`);
//         }
//     }

//     async scheduleOvertime(date, machineCode, hours) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('MachineCode', sql.NVarChar, machineCode)
//                 .input('OvertimeHours', sql.Float, hours)
//                 .query(`
//                     MERGE INTO [Production_Analytics].[dbo].[MachineSchedule] AS target
//                     USING (VALUES (@Date, @MachineCode)) AS source (ScheduleDate, MachineCode)
//                     ON target.ScheduleDate = source.ScheduleDate AND target.MachineCode = source.MachineCode
//                     WHEN MATCHED THEN
//                         UPDATE SET OvertimeHours = @OvertimeHours, UpdatedAt = GETDATE()
//                     WHEN NOT MATCHED THEN
//                         INSERT (ScheduleDate, MachineCode, OvertimeHours, RegularHours)
//                         VALUES (@Date, @MachineCode, @OvertimeHours, 8);
                        
//                     SELECT @@ROWCOUNT AS AffectedRows;
//                 `);
            
//             return { 
//                 success: true, 
//                 affectedRows: result.recordset[0].AffectedRows 
//             };
//         } catch (error) {
//             console.error('Error in scheduleOvertime repository:', error);
//             throw new Error(`Failed to schedule overtime: ${error.message}`);
//         }
//     }

//     async scheduleMaintenance(date, machineCode, duration, description) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('MachineCode', sql.NVarChar, machineCode)
//                 .input('Duration', sql.Float, duration)
//                 .input('Description', sql.NVarChar, description || 'Scheduled maintenance')
//                 .query(`
//                     INSERT INTO [Production_Analytics].[dbo].[MachineMaintenance]
//                     (MachineCode, MaintenanceDate, Duration, Description)
//                     VALUES (@MachineCode, @Date, @Duration, @Description);
                    
//                     UPDATE [Production_Analytics].[dbo].[MachineMaster]
//                     SET LastMaintenance = CASE 
//                                             WHEN @Date <= GETDATE() THEN @Date
//                                             ELSE LastMaintenance
//                                           END,
//                         NextMaintenance = CASE
//                                             WHEN @Date > GETDATE() THEN @Date
//                                             ELSE NextMaintenance
//                                           END
//                     WHERE MachineCode = @MachineCode;
                    
//                     SELECT SCOPE_IDENTITY() AS MaintenanceId;
//                 `);
            
//             return { 
//                 success: true, 
//                 maintenanceId: result.recordset[0].MaintenanceId 
//             };
//         } catch (error) {
//             console.error('Error in scheduleMaintenance repository:', error);
//             throw new Error(`Failed to schedule maintenance: ${error.message}`);
//         }
//     }

//     async getMaintenanceSchedule(startDate, endDate) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('startDate', sql.Date, new Date(startDate))
//                 .input('endDate', sql.Date, new Date(endDate))
//                 .query(`
//                     SELECT 
//                         mm.Id,
//                         mm.MachineCode,
//                         m.MachineName,
//                         mm.MaintenanceDate,
//                         mm.Duration,
//                         mm.Description,
//                         mm.IsCompleted
//                     FROM 
//                         [Production_Analytics].[dbo].[MachineMaintenance] mm
//                     JOIN
//                         [Production_Analytics].[dbo].[MachineMaster] m ON mm.MachineCode = m.MachineCode
//                     WHERE 
//                         mm.MaintenanceDate BETWEEN @startDate AND @endDate
//                     ORDER BY
//                         mm.MaintenanceDate, mm.MachineCode
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getMaintenanceSchedule repository:', error);
//             throw new Error(`Failed to get maintenance schedule: ${error.message}`);
//         }
//     }

//     async addHoliday(date, description, isRecurring = false) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('Description', sql.NVarChar, description)
//                 .input('IsRecurring', sql.Bit, isRecurring ? 1 : 0)
//                 .query(`
//                     INSERT INTO [Production_Analytics].[dbo].[CompanyHolidays]
//                     (HolidayDate, Description, IsRecurring)
//                     VALUES (@Date, @Description, @IsRecurring);
                    
//                     SELECT SCOPE_IDENTITY() AS HolidayId;
//                 `);
            
//             return { 
//                 success: true, 
//                 holidayId: result.recordset[0].HolidayId 
//             };
//         } catch (error) {
//             console.error('Error in addHoliday repository:', error);
//             throw new Error(`Failed to add holiday: ${error.message}`);
//         }
//     }

//     async getHolidays(year) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('year', sql.Int, year)
//                 .query(`
//                     SELECT 
//                         Id,
//                         HolidayDate,
//                         Description,
//                         IsRecurring
//                     FROM 
//                         [Production_Analytics].[dbo].[CompanyHolidays]
//                     WHERE 
//                         YEAR(HolidayDate) = @year
//                     ORDER BY
//                         HolidayDate
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getHolidays repository:', error);
//             throw new Error(`Failed to get holidays: ${error.message}`);
//         }
//     }
// }

// module.exports = MachineConfigRepository;
