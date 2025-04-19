const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class ProfileRepository {
    constructor() {
        this.dbConnection = null;
        // this.connectionPromise = null // เพิ่มตัวแปรเพื่อเก็บ promise ของการเชื่อมต่อ
    }

    async getConnection() {
        try {
            if (!this.dbConnection || !this.dbConnection.connected) {
                this.dbConnection = await connectDestSql();
            }
            return this.dbConnection;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    // 1. Daily Production Dashboard
    async getDailyProductionData(date, machineCodePrefix) {
        try {
            if (!date) {
                throw new Error('Date parameter is required'); 
            }

            console.log(`Fetching daily production data for date: ${date}, prefix: ${machineCodePrefix}`);
            const db = await this.getConnection();

            // สร้างวันที่ถัดไปเพื่อใช้ในการกำหนดช่วงเวลา
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            const nextDate = nextDay.toISOString().split('T')[0];

            const result = await db.request()
                .input('date', sql.Date, new Date(date))
                .input('nextDate', sql.Date, new Date(date))
                .input('machineCodePrefix', sql.NVarChar, machineCodePrefix)
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
                        MAX(SizeIn) AS SizeIn,
                        MAX(SizeOut) AS SizeOut,
                        MAX(PartName) AS PartName,
                        MAX(CurrentStep) AS CurrentStep
                    FROM 
                        [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    WHERE 
                        PrintTime >= DATEADD(HOUR, 8, CAST(@date AS DATETIME))
                        AND PrintTime < DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@date AS DATETIME)))
                        AND ItemType != 'NG'
                        AND ItemType != 'RM'
                        AND MachineCode LIKE @machineCodePrefix + '%'
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
                        AND MachineCode LIKE @machineCodePrefix + '%'
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
                `);

            console.log(`Retrieved ${result.recordset.length} records for daily production`);
            return result.recordset;                   
        } catch (error) {
            console.error('Error in getDailyProductionData:', error);
            throw new Error(`Failed to get daily production data: ${error.message}`);
        }
}

// 2. Machine Details
async getMachineDetails(startDate, endDate, machineCode) {
    try {
        const db = await this.getConnection();
        const result = await db.request()
            .input('startDate', sql.DateTime, startDate)
            .input('endDate', sql.DateTime, endDate)
            .input('machineCode', sql.VarChar, machineCode)
            .query(`
                SELECT 
                    p.MachineCode,
                    p.DocNo,
                    p.ItemType,
                    p.ItemQty,
                    p.printWeight,
                    p.CoilNo,
                    p.PrintTime,
                    p.MachineCode,
                    p.Remark,
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
                    ON p.MachineCode = pl.MachineCode 
                    AND p.DocNo = pl.DocNo 
                    AND CAST(p.PrintTime AS DATE) = pl.ProductionDate
                LEFT JOIN
                    [Production_Analytics].[dbo].[DailyProductionCauses] dpc
                    ON p.MachineCode = dpc.MachineCode 
                    AND p.DocNo = dpc.DocNo 
                    AND CAST(p.PrintTime AS DATE) = dpc.Date
                WHERE 
                    LEFT(p.MachineCode, 6) = LEFT(@machineCode, 6)
                    AND p.PrintTime BETWEEN @startDate AND @endDate
                    AND p.Isdelete = 0 
                    AND p.ItemType != 'NG'
                GROUP BY
                    p.MachineCode,
                    p.DocNo,
                    p.ItemType,
                    p.ItemQty,
                    p.printWeight,
                    p.CoilNo,
                    p.PrintTime,
                    p.Remark,
                    p.RSNCode,
                    p.NextStep,
                    p.PlateNo,
                    pl.ProductionQuantity
                ORDER BY 
                    p.PrintTime
            `);

        return result.recordset;
    } catch (error) {
        console.error('Error', error);
        throw new Error(`Fail to get MachineDetails: ${error.message}`)
    }

}

// 3. Plan Data
async getPlanData(date, department) {
    try {
        const db = await this.getConnection();
        const result = await db.request()
            .input('date', sql.Date, new Date(date))
            .input('machinePattern', sql.NVarChar, department === 'PRO' ? 'PRO%' : '')
            .query(`
                SELECT [No], DocNo, MachineCode, ProductionQuantity, Step
                FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE ProductionDate = @date
                AND MachineCode LIKE @machinePattern
                ORDER BY MachineCode    
            `);

        return result.recordset;
    } catch (error) {
        console.error('Error in getPlanData repository:', error);
        throw new Error(`Failed to get plan data: ${error.message}`);
    }
}

// 4. Chart Data
async getChartData(startDate, endDate) {
    const db = await this.getConnection();
    const result = await db.request()
        .input('startDate', sql.Date, new Date(startDate))
        .input('endDate', sql.Date, new Date(endDate))
        .query(`
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
                    PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) 
                    AND DATEADD(HOUR, 32, CAST(@endDate AS DATETIME))
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
        `);

    return result.recordset;
}

// 5. Weekly Report Data
async getWeeklyReportData(startDate, endDate) {
    try {
        const db = await this.getConnection();
        const result = await db.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query(`
                WITH DailyPlan AS (
                    SELECT 
                        MachineCode,
                        ProductionDate,
                        SUM(ProductionQuantity) AS DailyPlan
                    FROM 
                        [Production_Analytics].[dbo].[Planing_SectionAny]
                    WHERE 
                        ProductionDate BETWEEN @StartDate AND @EndDate
                        AND MachineCode LIKE 'PRO%'
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
                        PrintTime BETWEEN DATEADD(HOUR, 8, CAST(@StartDate AS DATETIME)) 
                        AND DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@EndDate AS DATETIME)))
                        AND MachineCode LIKE 'PRO%'
                        AND Isdelete = 0
                    GROUP BY 
                        MachineCode,
                        CAST(CASE 
                            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                            THEN PrintTime 
                            ELSE DATEADD(DAY, -1, PrintTime)
                        END AS DATE)
                )
                SELECT 
                    c.MachineCode,
                    SUM(COALESCE(p.DailyPlan, 0)) AS TotalPlan,
                    SUM(COALESCE(a.DailyActual, 0)) AS TotalWIPWeight,
                    MAX(d.Issues) AS Issues,
                    SUM(d.TotalDowntime) AS TotalDowntime
                FROM 
                    (SELECT DISTINCT MachineCode FROM DailyPlan UNION SELECT DISTINCT MachineCode FROM DailyActual) c
                LEFT JOIN 
                    DailyPlan p ON c.MachineCode = p.MachineCode
                LEFT JOIN 
                    DailyActual a ON c.MachineCode = a.MachineCode AND p.ProductionDate = a.ProductionDate
                LEFT JOIN 
                    [Production_Analytics].[dbo].[DailyProductionCauses] d 
                    ON c.MachineCode = d.MachineCode 
                    AND p.ProductionDate = d.Date
                GROUP BY 
                    c.MachineCode
                ORDER BY 
                    c.MachineCode
            `);

        return result.recordset;
    } catch (error) {
        console.error('Error in getPlanData repository:', error);
        throw new Error(`Failed to get WeeklyReport data: ${error.message}`);
    }
}

    // 6. Update Remark To New MachineCode
    async updateRemark(docNo, rsnCode, remark, newMachineCode) {
        try {
            const db = await this.getConnection();
            const result = await db.request()
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
                    WHERE [DocNo] = @DocNo AND [RSNCode] = @RSNCode
                    AND Isdelete = 0
                `);

            return result.recordset
        } catch (error) {
            console.error('Error in getPlanData repository:', error);
            throw new Error(`Failed to updateRemark: ${error.message}`);
        }
    }

    // 7.1 Update Causes - Delete Causes
    async updateCauses(date, machineCode, docNo, problems, deletedProblems) {
        if (!date || !machineCode) {
            throw new Error('Date and machineCode are required parameters');
        }

        const db = await this.getConnection();
        const transaction = new sql.Transaction(db);
        
        try {
            await transaction.begin();
            console.log(`Starting transaction for causes update - Machine: ${machineCode}, Date: ${date}`);
            
            // ลบปัญหาที่ถูกเลือกให้ลบ
            if (Array.isArray(deletedProblems) && deletedProblems.length > 0) {
                console.log(`Deleting ${deletedProblems.length} problems`);
                for (const id of deletedProblems) {
                    await transaction.request()
                        .input('Id', sql.Int, id)
                        .query(`
                            DELETE FROM [Production_Analytics].[dbo].[BreakdownMaster]
                            WHERE ID = @Id;
                        `);
                }
            }
    
            // อัปเดตหรือเพิ่มข้อมูลใหม่
            const updatedProblems = [];
            if (Array.isArray(problems) && problems.length > 0) {
                console.log(`Processing ${problems.length} problems`);
                for (const problem of problems) {
                    const downtime = parseFloat(problem.downtime);
                    
                    // Validate input
                    if (isNaN(downtime) || downtime < 0) {
                        console.warn(`Invalid downtime value: ${problem.downtime}, skipping`);
                        continue;
                    }

                    let result;
                    if (problem.id) {
                        // อัปเดตข้อมูลที่มีอยู่
                        console.log(`Updating problem ID: ${problem.id}`);
                        result = await transaction.request()
                            .input('Id', sql.Int, problem.id)
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes)
                            .input('CauseCode', sql.NVarChar(50), problem.causeCode || '')
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
                        // เพิ่มข้อมูลใหม่
                        console.log(`Adding new problem: ${problem.description}`);
                        result = await transaction.request()
                            .input('Date', sql.Date, new Date(date))
                            .input('MachineCode', sql.NVarChar(50), machineCode)
                            .input('DocNo', sql.NVarChar(50), docNo || '')
                            .input('Cause', sql.NVarChar(50), problem.description)
                            .input('CauseCode', sql.NVarChar(50), problem.causeCode || '')
                            .input('Downtime', sql.Float, downtime)
                            .input('notes', sql.NVarChar(500), problem.notes || '')
                            .query(`
                                INSERT INTO [Production_Analytics].[dbo].[BreakdownMaster]
                                (Date, MachineCode, DocNo, Cause, CauseCode, Downtime, UpdatedAt, notes)
                                VALUES (@Date, @MachineCode, @DocNo, @Cause, @CauseCode, @Downtime, GETDATE(), @notes);

                                SELECT SCOPE_IDENTITY() AS ID, NULL AS breakdownId, @Cause AS Cause, 
                                       @CauseCode AS CauseCode, @Downtime AS Downtime, @notes AS notes;
                            `);
                    }
                    
                    if (result.recordset && result.recordset.length > 0) {
                        updatedProblems.push({
                            id: result.recordset[0].ID,
                            breakdownId: result.recordset[0].breakdownId,
                            description: result.recordset[0].Cause,
                            causeCode: result.recordset[0].CauseCode,
                            downtime: result.recordset[0].Downtime,
                            notes: result.recordset[0].notes
                        });
                    }
                }
            }
    
            await transaction.commit();
            console.log('Causes update transaction committed successfully');
            return { success: true, updatedProblems };
        } catch (error) {
            await transaction.rollback();
            console.error('Error in updateCauses transaction:', error);
            throw new Error(`Failed to update causes: ${error.message}`);
        }
    }

    // 7.2 Get Causes Data All
    async getCauseData(date, machineCodePrefix = 'PRO') {
        const db = await this.getConnection();
        const result = await db.request()
            .input('Date', sql.Date, new Date(date))
            .input('MachineCodePrefix', sql.NVarChar, machineCodePrefix)
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
                AND MachineCode LIKE @MachineCodePrefix + '%'
            `);
    
        // จัดกลุ่มข้อมูลตาม MachineCode
        return result.recordset.reduce((acc, item) => {
            if (item && item.MachineCode) {
                const machineCode = item.MachineCode.split('-')[0];
                if (!acc[machineCode]) {
                    acc[machineCode] = [];
                }
                acc[machineCode].push({
                    description: item.Cause,
                    downtime: item.Downtime,
                    notes: item.notes,
                    breakdownId: item.breakdownId,
                    id: item.ID
                });
            }
            return acc;
        }, {});
    }

    // 7.3 Get BreakdownCause All
    async getBreakdownCauses() {
        try {
            const db = await this.getConnection();
            const result = await db.request()
                .query(`
                   SELECT CauseCode, Description
                   FROM [Production_Analytics].[dbo].[BreakdownCauses]
                   WHERE IsActive = 1
                   ORDER BY CauseCode
                `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error in getBreakdownCauses:', error);
            throw new Error(`Failed to get breakdown causes: ${error.message}`);
        }
    }

    // 8. Remarks Management
    async updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode) {
        const db = await this.getConnection();
        const result = await db.request()
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
                WHERE [DocNo] = @DocNo AND [RSNCode] = @RSNCode
                AND Isdelete = 0
            `);
        return result;
    }

    // 9. Save Weekly Report - Corrections
    async saveWeeklyReportCorrections(data) {
        try {
            return await this.repository.saveWeeklyReportCorrections(data);
        } catch (error) {
            throw new Error(`Error in saveWeeklyReportCorrections: ${error.message}`);
        }
    }

    // 9.1 Save Weekly Report - startDate or endDate
    async getSavedWeeklyReport(startDate, endDate) {
        try {
            return await this.repository.getSavedWeeklyReport(startDate, endDate);
        } catch (error) {
            throw new Error(`Error in getSavedWeeklyReport: ${error.message}`);
        }
    }

 // 1. บันทึก Causes ทั้งหมด
async saveAllCauses(data) {
    try {
        console.log('Repository: Saving all causes, items:', data.length);
        const db = await this.getConnection();
        const transaction = new sql.Transaction(db);
        await transaction.begin();
        
        try {
            // วนลูปบันทึกข้อมูล causes
            for (const item of data) {
                // แปลงข้อมูล problems เป็น cause string
                let cause = '';
                let totalDowntime = 0;
                if (item.problems && item.problems.length > 0) {
                    cause = item.problems.map(problem => {
                        totalDowntime += parseInt(problem.downtime) || 0;
                        return `${problem.description}`;
                    }).join('; ');
                } else if (item.cause) {
                    // กรณีที่มีค่า cause โดยตรง
                    cause = item.cause;
                    // ถ้ามี totalDowntime ให้ใช้เลย
                    totalDowntime = parseFloat(item.totalDowntime || 0);
                }
                
                console.log(`Saving cause for ${item.machineCode}, ${item.docNo}: ${cause}`);
                
                await transaction.request()
                    .input('Date', sql.Date, new Date(item.date))
                    .input('MachineCode', sql.NVarChar(50), item.machineCode)
                    .input('DocNo', sql.NVarChar(50), item.docNo)
                    .input('Cause', sql.NVarChar(500), cause)
                    .input('Downtime', sql.Float, totalDowntime)
                    .query(`
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
                    `);
            }
            
            await transaction.commit();
            console.log('Transaction committed successfully');
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            console.error('Transaction rolled back due to error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in saveAllCauses repository:', error);
        throw new Error(`Failed to save all causes: ${error.message}`);
    }
}

// 2. ดึงข้อมูล Breakdown Causes
async getBreakdownCauses() {
    try {
        console.log('Repository: Fetching breakdown causes');
        const db = await this.getConnection();
        const result = await db.request()
            .query(`
                SELECT CauseCode, Description
                FROM [Production_Analytics].[dbo].[BreakdownCauses]
                WHERE IsActive = 1
                ORDER BY CauseCode
            `);
        
        console.log(`Retrieved ${result.recordset.length} breakdown causes`);
        return result.recordset;
    } catch (error) {
        console.error('Error in getBreakdownCauses repository:', error);
        throw new Error(`Failed to get breakdown causes: ${error.message}`);
    }
}

// 3. ลบแผนการผลิต
async deletePlan(planNo) {
    try {
        console.log('Repository: Deleting plan:', planNo);
        const db = await this.getConnection();
        const result = await db.request()
            .input('No', sql.Int, planNo)
            .query(`
                DELETE FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                WHERE No = @No;
                
                SELECT @@ROWCOUNT AS DeletedRows;
            `);
        
        const deletedRows = result.recordset[0].DeletedRows;
        console.log(`Deleted ${deletedRows} plan rows`);
        
        if (deletedRows === 0) {
            throw new Error(`Plan with No ${planNo} not found`);
        }
        
        return { success: true, deletedRows };
    } catch (error) {
        console.error('Error in deletePlan repository:', error);
        throw new Error(`Failed to delete plan: ${error.message}`);
    }
}

// 4. อัพเดทแผนการผลิต
async updatePlan(planNo, planData) {
    try {
        console.log('Repository: Updating plan:', planNo, 'with data:', planData);
        const db = await this.getConnection();
        const result = await db.request()
            .input('No', sql.Int, planNo)
            .input('MachineCode', sql.NVarChar(50), planData.machineCode)
            .input('ProductionQuantity', sql.Float, planData.productionQuantity)
            .input('Step', sql.Int, planData.step || 0)
            .query(`
                UPDATE [Production_Analytics].[dbo].[Planing_SectionAny]
                SET MachineCode = @MachineCode,
                    ProductionQuantity = @ProductionQuantity,
                    Step = @Step
                WHERE No = @No;
                
                SELECT @@ROWCOUNT AS UpdatedRows;
            `);
        
        const updatedRows = result.recordset[0].UpdatedRows;
        console.log(`Updated ${updatedRows} plan rows`);
        
        if (updatedRows === 0) {
            throw new Error(`Plan with No ${planNo} not found`);
        }
        
        return { success: true, updatedRows };
    } catch (error) {
        console.error('Error in updatePlan repository:', error);
        throw new Error(`Failed to update plan: ${error.message}`);
    }
}   

    // 10. Helper Methods
    processWeeklyReportData(data, savedReport) {
        // เช็คและแปลงทั้ง data และ savedReport
        if (!Array.isArray(data)) {
            data = data.recordset;
        }
        if (!Array.isArray(savedReport)) {
            savedReport = savedReport.recordset || [];
        }
    
        return data
            .filter(item => item.MachineCode.startsWith('PRO'))
            .map(item => {
                const baseMachineCode = item.MachineCode.split('-')[0];
                const saved = savedReport.find(s => s.MachineCode === baseMachineCode);
                
                return {
                    MachineCode: baseMachineCode,
                    Actual: item.TotalWIPWeight,  
                    ProductionQuantity: item.TotalPlan,
                    CumulativePOP: item.CumulativePOP,
                    Issues: item.Issues || 'ไม่มีปัญหา',
                    TotalDowntime: item.TotalDowntime || 0,
                    PreventiveCorrection: saved?.PreventiveCorrection || ''
                };
            })
            .sort((a, b) => {
                const numA = parseInt(a.MachineCode.replace('PRO', ''));  
                const numB = parseInt(b.MachineCode.replace('PRO', '')); 
                return numA - numB;
            });
    }

    calculateCumulativePOP(item) {
        return item.TotalPlan > 0 ? 
            (item.TotalWIPWeight / item.TotalPlan) * 100 : 0;
    }
}

module.exports = ProfileRepository;