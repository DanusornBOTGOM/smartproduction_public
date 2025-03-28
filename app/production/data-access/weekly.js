const sql = require('mssql/msnodesqlv8');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class WeeklyRepository {
    async getConnection() {
        try {
            return await connectDestSql();
        } catch (error) {
            throw new Error(`Database connection error: ${error.message}`);
        }
    }

    async getWeeklyReportData(startDate, endDate) {
        const db = await this.getConnection();
        return await db.request()
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
                            ISNULL(Cause, '')
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
            `);
    }

    async saveWeeklyReportCorrections(data) {
        const db = await this.getConnection();
        const transaction = new sql.Transaction(db);
        
        try {
            await transaction.begin();

            for (const item of data) {
                await transaction.request()
                    .input('StartDate', sql.Date, new Date(item.startDate))
                    .input('EndDate', sql.Date, new Date(item.endDate))
                    .input('MachineCode', sql.NVarChar(50), item.machineCode)
                    .input('PreventiveCorrection', sql.NVarChar(500), item.preventiveCorrection)
                    .input('Issues', sql.NVarChar(sql.MAX), item.issues)
                    .query(`
                        MERGE INTO [Production_Analytics].[dbo].[WeeklyReportCauses] AS target
                        USING (VALUES (@StartDate, @EndDate, @MachineCode)) 
                        AS source (StartDate, EndDate, MachineCode)
                        ON target.StartDate = source.StartDate 
                            AND target.EndDate = source.EndDate 
                            AND target.MachineCode = source.MachineCode
                        WHEN MATCHED THEN
                            UPDATE SET 
                                Issues = @Issues,
                                PreventiveCorrection = @PreventiveCorrection,
                                UpdatedAt = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (StartDate, EndDate, MachineCode, Issues, 
                                   PreventiveCorrection, CreatedAt)
                            VALUES (@StartDate, @EndDate, @MachineCode, @Issues, 
                                   @PreventiveCorrection, GETDATE());
                    `);
            }

            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getSavedWeeklyReport(startDate, endDate) {
        const db = await this.getConnection();
        return await db.request()
            .input('StartDate', sql.Date, new Date(startDate))
            .input('EndDate', sql.Date, new Date(endDate))
            .query(`
                SELECT * FROM [Production_Analytics].[dbo].[WeeklyReportCauses]
                WHERE StartDate = @StartDate AND EndDate = @EndDate
            `);
    }
}

module.exports = WeeklyRepository;