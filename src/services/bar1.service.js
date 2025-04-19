const sql = require('mssql');
const NodeCache = require('node-cache');
const { 
    formatDateThai, 
    formatDate, 
    getStartEndDates,
    formatForDatabase,
    isValidDate 
} = require('../utils/dateUtils');


class Bar1ServiceError extends Error {
    constructor(message, code = 'GENERAL_ERROR') {
        super(message);
        this.name = 'Bar1ServiceError';
        this.code = code;
    }
}

class Bar1Service {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection is required');
        }
        if (typeof db.request !== 'function') {
            throw new Error('Invalid database connection object: missing request method');
        }
        this.db = db;
        this.cache = new NodeCache({ stdTTL: 600 });
        this.logs = [];
    }

    log(message, level = 'info', details = {}) {
        const logEntry = {
            timestamp: new Date(),
            level,
            message: typeof message === 'object' ? JSON.stringify(message) : message,
            details: Object.keys(details).length > 0 ? details : undefined
        };
        
        this.logs.push(logEntry);
        console.log(`[${logEntry.timestamp.toISOString()}][${level}] ${logEntry.message}`);
    
        if (this.logs.length > 100) {
            this.logs.shift();
        }
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    // เพิ่มฟังก์ชัน formatDate ใน bar1.service.js
    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', date);
            return '';
        }
        const bangkokTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const year = bangkokTime.getFullYear();
        const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');
        const day = String(bangkokTime.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async saveCause(data) {
        let transaction;
        try {
            // สร้างและเริ่ม transaction
            transaction = new sql.Transaction(this.db);
            await transaction.begin();
    
            for (const item of data) {
                let cause = '';
                let totalDowntime = 0;
    
                if (item.problems && item.problems.length > 0) {
                    cause = item.problems.map(problem => {
                        totalDowntime += parseInt(problem.downtime) || 0;
                        return `${problem.description}`;
                    }).join('; ');
                }
    
                await transaction.request()
                    .input('Date', sql.Date, new Date(item.date))
                    .input('MachineCode', sql.NVarChar(50), item.machineCode)
                    .input('DocNo', sql.NVarChar(50), item.docNo)
                    .input('Cause', sql.NVarChar(500), cause)
                    .input('Downtime', sql.Float, totalDowntime)
                    .query(`
                        MERGE INTO [Production_Analytics].[dbo].[BreakdownMaster] AS target
                        USING (VALUES (@Date, @MachineCode, @DocNo)) AS source (Date, MachineCode, DocNo)
                        ON target.Date = source.Date 
                        AND target.MachineCode = source.MachineCode 
                        AND target.DocNo = source.DocNo
                        WHEN MATCHED THEN
                            UPDATE SET 
                                Cause = @Cause,
                                Downtime = @Downtime,
                                UpdatedAt = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (Date, MachineCode, DocNo, Cause, Downtime, UpdatedAt)
                            VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime, GETDATE());
                    `);
            }
    
            await transaction.commit();
            this.log('Causes saved successfully', 'info');
            return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
        } catch (error) {
            if (transaction) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    this.log('Error rolling back transaction', 'error', { error: rollbackError });
                }
            }
            this.log('Error in saveCause:', 'error', { error: error.message });
            throw error;
        }
    }
    
    async updateCausesMswAll(date, machineCode, docNo, problems, deletedProblems) {
        let transaction;
        try {
            // แปลงวันที่ให้อยู่ในรูปแบบที่ถูกต้อง
            const parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                throw new Error('Invalid date format');
            }
    
            transaction = new sql.Transaction(this.db);
            await transaction.begin();
    
            // ลบ problems ที่ถูกเลือกให้ลบ
            if (Array.isArray(deletedProblems) && deletedProblems.length > 0) {
                for (const id of deletedProblems) {
                    await transaction.request()
                        .input('Id', sql.Int, id)
                        .query(`
                            DELETE FROM [Production_Analytics].[dbo].[BreakdownMaster]
                            WHERE ID = @Id;
                        `);
                }
            }
    
            const updatedProblems = [];
            if (Array.isArray(problems) && problems.length > 0) {
                for (const problem of problems) {
                    if (!problem.description?.trim()) continue;
    
                    const downtime = parseFloat(problem.downtime);
                    if (isNaN(downtime) || downtime < 0) continue;
    
                    let result;
                    if (problem.id) {
                        result = await transaction.request()
                            .input('Id', sql.Int, problem.id)
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes)
                            .query(`
                                UPDATE [Production_Analytics].[dbo].[BreakdownMaster]
                                SET Downtime = @Downtime, 
                                    UpdatedAt = GETDATE(),
                                    notes = @notes
                                WHERE ID = @Id;
                                
                                SELECT ID, breakdownId, Cause, Downtime, notes
                                FROM [Production_Analytics].[dbo].[BreakdownMaster]
                                WHERE ID = @Id;
                            `);
                    } else {
                        result = await transaction.request()
                            .input('Date', sql.Date, parsedDate)  // ใช้วันที่ที่แปลงแล้ว
                            .input('MachineCode', sql.NVarChar(50), machineCode)
                            .input('DocNo', sql.NVarChar(50), docNo)
                            .input('Cause', sql.NVarChar(50), problem.description)
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes)
                            .query(`
                                INSERT INTO [Production_Analytics].[dbo].[BreakdownMaster]
                                (Date, MachineCode, DocNo, Cause, Downtime, UpdatedAt, notes)
                                VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime, GETDATE(), @notes);
    
                                SELECT SCOPE_IDENTITY() AS ID, NULL AS breakdownId, 
                                       @Cause AS Cause, @Downtime AS Downtime, @notes AS notes;
                            `);
                    }
    
                    if (result.recordset?.length > 0) {
                        updatedProblems.push({
                            id: result.recordset[0].ID,
                            breakdownId: result.recordset[0].breakdownId,
                            description: result.recordset[0].Cause,
                            downtime: result.recordset[0].Downtime,
                            notes: result.recordset[0].notes
                        });
                    }
                }
            }
    
            await transaction.commit();
            this.cache.del(`cause_${date}`);
            return { success: true, updatedProblems };
    
        } catch (error) {
            if (transaction) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    this.log('Error rolling back transaction:', rollbackError);
                }
            }
            this.log('Error in updateCausesMswAll:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    async getCauseSummary(startDate, endDate, machineCode) {
        try {
            const result = await this.db.request()
                .input('StartDate', sql.Date, new Date(startDate))
                .input('EndDate', sql.Date, new Date(endDate))
                .input('MachineCode', sql.NVarChar(50), machineCode)
                .query(`
                    SELECT 
                        MachineCode,
                        Cause,
                        SUM(Downtime) as TotalDowntime,
                        COUNT(*) as Frequency
                    FROM [Production_Analytics].[dbo].[BreakdownMaster]
                    WHERE Date BETWEEN @StartDate AND @EndDate
                    AND (@MachineCode IS NULL OR MachineCode LIKE @MachineCode + '%')
                    GROUP BY MachineCode, Cause
                    ORDER BY MachineCode, TotalDowntime DESC
                `);
    
            return result.recordset;
        } catch (error) {
            this.log('Error in getCauseSummary:', error);
            throw error;
        }
    }

    async getCausesMswAll(date) {
        try {
            if (!this.db) {
                throw new Error('Database connection not established');
            }
    
            const result = await this.db.request()
                .input('Date', sql.Date, new Date(date))
                .query(`
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
                `);
    
            return {
                success: true,
                data: result.recordset
            };
        } catch (error) {
            this.log('Error in getCausesMswAll:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getCauseData(date) {
        try {
            const result = await this.db.request()
                .input('Date', sql.Date, new Date(date))
                .query(`
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
                `);
            return result.recordset;
        } catch (error) {
            this.log('Error in getCauseData:', error);
            throw error;
        }
    }

    async updateCauses(date, machineCode, docNo, problems) {
        let transaction;
        try {
            // เริ่ม transaction
            transaction = new sql.Transaction(this.db);
            await transaction.begin();
    
            const updatedProblems = [];
            for (const problem of problems) {
                const downtime = parseFloat(problem.downtime);
                if (isNaN(downtime) || downtime < 0) continue;
    
                const result = await transaction.request()
                    .input('Date', sql.Date, new Date(date))
                    .input('MachineCode', sql.NVarChar(50), machineCode)
                    .input('DocNo', sql.NVarChar(50), docNo)
                    .input('Cause', sql.NVarChar(300), problem.description)
                    .input('Downtime', sql.Float, downtime)
                    .input('notes', sql.NVarChar(500), problem.notes)
                    .query(`
                        INSERT INTO [Production_Analytics].[dbo].[BreakdownMaster]
                        (Date, MachineCode, DocNo, Cause, Downtime, UpdatedAt, notes)
                        VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime, GETDATE(), @notes);
    
                        SELECT SCOPE_IDENTITY() AS ID;
                    `);
    
                if (result.recordset && result.recordset.length > 0) {
                    updatedProblems.push({
                        id: result.recordset[0].ID,
                        description: problem.description,
                        downtime: downtime,
                        notes: problem.notes
                    });
                }
            }
    
            await transaction.commit();
            this.log('Causes updated successfully', 'info', { machineCode, docNo });
            return { 
                success: true, 
                updatedProblems,
                message: 'บันทึกข้อมูลสำเร็จ'
            };
        } catch (error) {
            if (transaction) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    this.log('Error rolling back transaction', 'error', { error: rollbackError });
                }
            }
            this.log('Error in updateCauses:', 'error', { error: error.message });
            throw error;
        }
    }

    async updateMultipleMachineCodes(docNo, newMachineCode, currentDate) {
        try {
            const result = await this.db.request()
                .input('DocNo', sql.NVarChar, docNo)
                .input('NewMachineCode', sql.NVarChar, newMachineCode)
                .input('CurrentDate', sql.Date, new Date(currentDate))
                .query(`
                    UPDATE [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    SET MachineCode = @NewMachineCode
                    WHERE DocNo = @DocNo
                    AND CAST(PrintTime AS DATE) = @CurrentDate;
    
                    SELECT @@ROWCOUNT as UpdatedCount;
                `);
    
            return {
                success: true,
                updatedCount: result.recordset[0].UpdatedCount
            };
        } catch (error) {
            this.log('Error in updateMultipleMachineCodes:', error);
            throw error;
        }
    }

    async getTableData(date) {
        if (!date) {
            throw new Error('Date is required');
        }
        try {
    
            // แก้ไขการจัดการวันที่ให้ตรงกับระบบเดิม
            const parsedDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
            const nextDate = new Date(parsedDate);
            nextDate.setDate(nextDate.getDate() + 1);
    
            // แปลงเป็น format ที่ต้องการ
            const formattedDate = parsedDate.toISOString().split('T')[0];
            const formattedNextDate = nextDate.toISOString().split('T')[0];
    
            const result = await this.db.request()
                .input('date', sql.Date, formattedDate)
                .input('nextDate', sql.Date, formattedNextDate)
                .query(`
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
                            AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022' OR MachineCode = 'TWR001')
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
                `);
    
            this.log(`Retrieved ${result.recordset.length} records for date ${date}`);
            return {
                data: result.recordset,
                success: true,
                logs: this.getLogs()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                logs: this.getLogs()
            };
        }
    }


    async getMachineDetails(machineCode, date) {
        try {
            if (!machineCode || !date) {
                throw new Error('MachineCode and date are required');
            }

            const { startDate, endDate } = getStartEndDates(date);

            const result = await this.db.request()
                .input('machineCode', sql.NVarChar, machineCode)
                .input('startDate', sql.DateTime, startDate)
                .input('endDate', sql.DateTime, endDate)
                .query(`
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
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster] p
                    LEFT JOIN [Production_Analytics].[dbo].[Planing_SectionAny] pl
                        ON p.MachineCode = pl.MachineCode 
                        AND p.DocNo = pl.DocNo 
                        AND CAST(p.PrintTime AS DATE) = pl.ProductionDate
                    LEFT JOIN [Production_Analytics].[dbo].[BreakdownMaster] dpc
                        ON p.MachineCode = dpc.MachineCode 
                        AND p.DocNo = dpc.DocNo 
                        AND CAST(p.PrintTime AS DATE) = dpc.Date
                    WHERE 
                        LEFT(p.MachineCode, 6) = LEFT(@machineCode, 6)
                        AND p.PrintTime BETWEEN @startDate AND @endDate
                        AND p.Isdelete = 0 
                        AND ItemType != 'NG'
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
                `);

            return result.recordset.map(row => ({
                ...row,
                PrintTime: formatDateThai(row.PrintTime),
                Cause: row.Cause || '',
                Downtime: Number(row.Downtime) || 0,
                Plan: Number(row.Plan) || 0
            }));
        } catch (error) {
            this.log('Error in getMachineDetails:', error);
            throw error;
        }
    }

    async updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode) {
        try {
            if (!docNo || !rsnCode) {
                throw new Error('DocNo and RSNCode are required');
            }
    
            // ถ้ามีการเปลี่ยน machine code ให้ใช้ base machine code
            if (newMachineCode) {
                newMachineCode = newMachineCode.split('-')[0];
            }
    
            const result = await this.db.request()
                .input('DocNo', sql.NVarChar, docNo)
                .input('RSNCode', sql.NVarChar, rsnCode)
                .input('Remark', sql.NVarChar(200), remark)
                .input('NewMachineCode', sql.NVarChar(50), newMachineCode)
                .query(`
                    UPDATE [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    SET [Remark] = @Remark,
                        [MachineCode] = CASE
                            WHEN @NewMachineCode != '' THEN @NewMachineCode
                            ELSE [MachineCode]
                        END
                    WHERE [DocNo] = @DocNo 
                    AND [RSNCode] = @RSNCode;
    
                    SELECT @@ROWCOUNT as UpdatedCount;
                `);
    
            if (result.recordset[0].UpdatedCount === 0) {
                this.log('No records updated', 'warning', { docNo, rsnCode });
                return {
                    success: false,
                    message: 'Record not found or no changes made'
                };
            }
    
            this.log('Record updated successfully', 'info', { docNo, rsnCode });
            return { 
                success: true, 
                message: 'Updated successfully'
            };
        } catch (error) {
            this.log(`Error in updateRemark: ${error.message}`, 'error');
            throw error;
        }
    }

    async getWeeklyReport(startDate, endDate) {
        try {
            this.log('Fetching weekly report', 'info', { startDate, endDate });
    
            const result = await this.db.request()
                .input('startDate', sql.Date, new Date(startDate))
                .input('endDate', sql.Date, new Date(endDate))
                .query(`
                    WITH PlanData AS
                    (
                        SELECT
                            MachineCode,
                            DocNo,
                            ProductionQuantity AS [Plan],
                            MAX(Step) AS PlanStep,
                            ProductionDate
                        FROM
                            [Production_Analytics].[dbo].[Planing_SectionAny]
                        WHERE 
                            ProductionDate BETWEEN @startDate AND @endDate
                            AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
                        GROUP BY
                            MachineCode, DocNo, ProductionQuantity, ProductionDate      
                    ),
                    ProductionData AS
                    (
                        SELECT 
                            MachineCode,
                            DocNo,
                            SUM(printWeight) AS TotalWIPWeight,
                            MAX(CONVERT(varchar, PrintTime, 120)) AS LastPrintTime,
                            CAST(DATEADD(HOUR, -8, PrintTime) AS DATE) AS ProductionDate
                        FROM
                            [Production_Analytics].[dbo].[ProductionTrackingMaster]
                        WHERE
                            PrintTime >= DATEADD(HOUR, 8, CAST(@startDate AS DATETIME))
                            AND PrintTime < DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                            AND ItemType != 'NG' AND Isdelete = 0
                            AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
                        GROUP BY
                            MachineCode, DocNo, CAST(DATEADD(HOUR, -8, PrintTime) AS DATE)
                    )
                    SELECT
                        COALESCE(p.MachineCode, pd.MachineCode) AS MachineCode,
                        SUM(p.[Plan]) AS PlanQuantity,
                        SUM(pd.TotalWIPWeight) AS ActualQuantity,
                        CASE
                            WHEN SUM(p.[Plan]) > 0 THEN (SUM(pd.TotalWIPWeight) / SUM(p.[Plan])) * 100 
                            ELSE 0
                        END AS Percentage
                    FROM 
                        PlanData p
                    FULL OUTER JOIN
                        ProductionData pd ON p.MachineCode = pd.MachineCode 
                        AND p.DocNo = pd.DocNo 
                        AND p.ProductionDate = pd.ProductionDate
                    GROUP BY
                        COALESCE(p.MachineCode, pd.MachineCode)
                    ORDER BY
                        COALESCE(p.MachineCode, pd.MachineCode)`);
    
            const processedData = result.recordset.map(row => ({
                MachineCode: row.MachineCode,
                PlanQuantity: Number(row.PlanQuantity) || 0,
                ActualQuantity: Number(row.ActualQuantity) || 0,
                Percentage: Number(row.Percentage) || 0
            }));
    
            this.log(`Retrieved ${processedData.length} records`, 'info');
    
            return processedData;
            
        } catch (error) {
            this.log('Error in getWeeklyReport:', 'error', { error: error.message });
            throw error;
        }
    }

    async getMonthlyData(month, year) {
        try {
            this.log('Fetching monthly data', 'info', { month, year });
    
            const result = await this.db.request()
                .input('year', sql.Int, parseInt(year))
                .input('month', sql.Int, parseInt(month))
                .query(`
                    WITH DailyPlan AS (
                        SELECT 
                            MachineCode,
                            ProductionDate,
                            SUM(ProductionQuantity) AS ProductionQuantity
                        FROM 
                            [Production_Analytics].[dbo].[Planing_SectionAny]
                        WHERE 
                            YEAR(ProductionDate) = @year 
                            AND MONTH(ProductionDate) = @month
                            AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
                        GROUP BY
                            MachineCode, ProductionDate
                    ),
                    DailyActual AS (
                        SELECT 
                            MachineCode,
                            CASE 
                                WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                                THEN CAST(PrintTime AS DATE) 
                                ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                            END AS ProductionDate,
                            SUM(CASE WHEN ItemType IN ('WIP', 'FG') THEN printWeight ELSE 0 END) AS Actual,
                            SUM(CASE WHEN ItemType = 'NG' THEN printWeight ELSE 0 END) AS NgWeight
                        FROM 
                            [Production_Analytics].[dbo].[ProductionTrackingMaster]
                        WHERE 
                            YEAR(PrintTime) = @year 
                            AND MONTH(PrintTime) = @month
                            AND (MachineCode LIKE 'COM%' OR MachineCode = 'CUT022')
                            AND Isdelete = 0
                        GROUP BY 
                            MachineCode,
                            CASE 
                                WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                                THEN CAST(PrintTime AS DATE) 
                                ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                            END
                    )
                    SELECT 
                        COALESCE(p.MachineCode, w.MachineCode) AS MachineCode,
                        COALESCE(p.ProductionDate, w.ProductionDate) AS ProductionDate,
                        ISNULL(p.ProductionQuantity, 0) AS ProductionQuantity,
                        ISNULL(w.Actual, 0) AS Actual,
                        ISNULL(w.NgWeight, 0) AS NgWeight
                    FROM 
                        DailyPlan p
                    FULL OUTER JOIN 
                        DailyActual w ON p.MachineCode = w.MachineCode 
                        AND p.ProductionDate = w.ProductionDate
                    ORDER BY
                        COALESCE(p.MachineCode, w.MachineCode), 
                        COALESCE(p.ProductionDate, w.ProductionDate)`);
    
            const processedData = result.recordset.map(row => ({
                MachineCode: row.MachineCode,
                ProductionDate: row.ProductionDate,
                ProductionQuantity: Number(row.ProductionQuantity) || 0,
                Actual: Number(row.Actual) || 0,
                NgWeight: Number(row.NgWeight) || 0
            }));
    
            this.log(`Retrieved ${processedData.length} records`, 'info');
            
            return processedData;
    
        } catch (error) {
            this.log('Error in getMonthlyData:', 'error', { error: error.message });
            throw error;
        }
    }

    async getWasteChartData(startDate, endDate, machineCodePrefix) {
        try {
            const query = `
                SELECT 
                    MachineCode,
                    PrintTime,
                    ItemCode,
                    PartName,
                    printWeight AS WasteQuantity,
                    DocNo,
                    SizeIn,
                    SizeOut,
                    ItemLen,
                    CoilNo,
                    NCCode,
                    Remark
                FROM 
                    [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE 
                    PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) 
                    AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
                    AND ItemType = 'NG' AND ItemCode NOT LIKE 'NW%'
                    AND (MachineCode LIKE @machineCodePrefix + '%')
                    AND Isdelete = 0 
                ORDER BY
                    PrintTime, MachineCode`;
    
            const result = await this.db.query(query, { 
                startDate, 
                endDate, 
                machineCodePrefix 
            });
    
            return this._processWasteChartData(result);
        } catch (error) {
            throw new Error(`Error in getWasteChartData: ${error.message}`);
        }
    }


// Helper methods for processing
_processWeeklyReport(data) {
    return data.map(row => ({
        MachineCode: row.MachineCode,
        PlanQuantity: Number(row.PlanQuantity) || 0,
        ActualQuantity: Number(row.ActualQuantity) || 0,
        Percentage: Number(row.Percentage) || 0
    }));
}

_processMonthlyData(data) {
    return data.map(row => ({
        MachineCode: row.MachineCode,
        ProductionDate: row.ProductionDate,
        ProductionQuantity: Number(row.ProductionQuantity) || 0,
        Actual: Number(row.Actual) || 0,
        NgWeight: Number(row.NgWeight) || 0
    }));
}
_processWasteChartData(data) {
    const summaryData = data.reduce((acc, curr) => {
        const existingItem = acc.find(item => item.MachineCode === curr.MachineCode);
        if (existingItem) {
            existingItem.WasteQuantity += curr.WasteQuantity;
        } else {
            acc.push({
                MachineCode: curr.MachineCode,
                WasteQuantity: curr.WasteQuantity
            });
        }
        return acc;
    }, []);

    return {
        summary: summaryData,
        details: data
    };
}

_processMachineDetails(data) {
    return data.map(item => ({
        ...item,
        PrintTime: item.PrintTime,
        Cause: item.Cause || '',
        Downtime: item.Downtime || 0,
        Plan: Number(item.Plan) || 0
    }));
}

    // Error handling helper
    _handleDatabaseError(error, operation) {
        console.error(`Database error in ${operation}:`, error);
        throw new Error(`Database error in ${operation}: ${error.message}`);
    }
}


module.exports = Bar1Service;