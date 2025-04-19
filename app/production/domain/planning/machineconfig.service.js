// class MachineConfigService {
//     constructor(db) {
//         this.db = db;
//     }

//     async getMachineConfigurations() {
//         try {
//             const query = `
//                 SELECT 
//                     m.MachineCode,
//                     m.MachineName,
//                     m.Department,
//                     m.StationCode,
//                     m.HourlyCapacity,
//                     m.EfficiencyFactor,
//                     m.Status,
//                     m.LastMaintenance,
//                     m.NextMaintenance
//                 FROM 
//                     MachineMaster m
//                 WHERE 
//                     m.IsActive = 1
//                 ORDER BY
//                     m.Department, m.MachineCode
//             `;
            
//             const result = await this.db.request().query(query);
//             return result.recordset;
//         } catch (error) {
//             console.error('Error fetching machine configurations:', error);
//             throw error;
//         }
//     }

//     async updateMachineConfiguration(machineCode, productionTimes) {
//         try {
//             // Start transaction
//             const transaction = new sql.Transaction(this.db);
//             await transaction.begin();
            
//             try {
//                 // Update machine master record
//                 await transaction.request()
//                     .input('MachineCode', machineCode)
//                     .input('HourlyCapacity', productionTimes.hourlyCapacity || 0)
//                     .input('EfficiencyFactor', productionTimes.efficiencyFactor || 1.0)
//                     .query(`
//                         UPDATE MachineMaster
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
//                                 MERGE INTO MachineProductionTimes AS target
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
//             console.error('Error updating machine configuration:', error);
//             throw error;
//         }
//     }

//     async scheduleOvertime(date, machineCode, hours) {
//         try {
//             const result = await this.db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('MachineCode', sql.NVarChar, machineCode)
//                 .input('OvertimeHours', sql.Float, hours)
//                 .query(`
//                     MERGE INTO MachineSchedule AS target
//                     USING (VALUES (@Date, @MachineCode)) AS source (ScheduleDate, MachineCode)
//                     ON target.ScheduleDate = source.ScheduleDate AND target.MachineCode = source.MachineCode
//                     WHEN MATCHED THEN
//                         UPDATE SET OvertimeHours = @OvertimeHours, UpdatedAt = GETDATE()
//                     WHEN NOT MATCHED THEN
//                         INSERT (ScheduleDate, MachineCode, OvertimeHours)
//                         VALUES (@Date, @MachineCode, @OvertimeHours);
                        
//                     SELECT @@ROWCOUNT AS AffectedRows;
//                 `);
            
//             return { 
//                 success: true, 
//                 affectedRows: result.recordset[0].AffectedRows 
//             };
//         } catch (error) {
//             console.error('Error scheduling overtime:', error);
//             throw error;
//         }
//     }

//     async scheduleMaintenance(date, machineCode, duration, description) {
//         try {
//             const result = await this.db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('MachineCode', sql.NVarChar, machineCode)
//                 .input('Duration', sql.Float, duration)
//                 .input('Description', sql.NVarChar, description || 'Scheduled maintenance')
//                 .query(`
//                     INSERT INTO MachineMaintenance
//                     (MachineCode, MaintenanceDate, Duration, Description)
//                     VALUES (@MachineCode, @Date, @Duration, @Description);
                    
//                     UPDATE MachineMaster
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
//             console.error('Error scheduling maintenance:', error);
//             throw error;
//         }
//     }

//     async addHoliday(date, description, isRecurring = false) {
//         try {
//             const result = await this.db.request()
//                 .input('Date', sql.Date, new Date(date))
//                 .input('Description', sql.NVarChar, description)
//                 .input('IsRecurring', sql.Bit, isRecurring ? 1 : 0)
//                 .query(`
//                     INSERT INTO CompanyHolidays
//                     (HolidayDate, Description, IsRecurring)
//                     VALUES (@Date, @Description, @IsRecurring);
                    
//                     SELECT SCOPE_IDENTITY() AS HolidayId;
//                 `);
            
//             return { 
//                 success: true, 
//                 holidayId: result.recordset[0].HolidayId 
//             };
//         } catch (error) {
//             console.error('Error adding holiday:', error);
//             throw error;
//         }
//     }
// }