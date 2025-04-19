const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class OeeRepository {
    constructor() {
        this.dbConnection = null;
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

// oee.repository.js
async getOverallDepartmentOEE(startDate, endDate, department) {
    const db = await this.getConnection();
    
    try {
        if (department === 'CGM') {
            return await this.getCGMOEE(db, startDate, endDate);
        } else {
            return await this.getNormalOEE(db, startDate, endDate, department);
        }
    } catch (error) {
        console.error('Error in repository query:', error);
        throw error;
    }
}

    getUniqueDates(startDate, endDate) {
        const dates = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);
        
        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }

    async getCGMOEE(db, startDate, endDate) {
        const result = await db.request()
            .input('startDate', sql.DateTime, new Date(startDate))
            .input('endDate', sql.DateTime, new Date(endDate))
            .query(`
                WITH PlanData AS (
                    SELECT
                        CAST(ProductionDate AS DATE) AS ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END as MachineCode,
                        DocNo,
                        SUM(ProductionQuantity) AS PlannedQty
                    FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                    WHERE ProductionDate BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE 'CGM%'
                    GROUP BY 
                        CAST(ProductionDate AS DATE),
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END,
                        DocNo
                ),
                ProductionData AS (
                    SELECT 
                        CASE 
                            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                            THEN CAST(PrintTime AS DATE) 
                            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                        END AS ProductionDate,
                        MachineCode,
                        DocNo,
                        SUM(printWeight) AS ActualQty
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    WHERE PrintTime BETWEEN 
                        DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
                        DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                    AND MachineCode LIKE 'CGM%'
                    AND ItemType IN ('WIP', 'FG')
                    AND Isdelete = 0
                    GROUP BY
                        CASE 
                            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                            THEN CAST(PrintTime AS DATE) 
                            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                        END,
                        MachineCode,
                        DocNo
                ),
                TotalActualByDocNo AS (
                    SELECT 
                        DocNo,
                        ProductionDate,
                        SUM(ActualQty) AS TotalActualWeight,
                        COUNT(DISTINCT MachineCode) as ActualMachineCount
                    FROM ProductionData
                    GROUP BY DocNo, ProductionDate
                ),
                DocNoToSplit AS (
                    SELECT 
                        p.DocNo,
                        p.ProductionDate,
                        COUNT(DISTINCT p.MachineCode) AS PlannedMachineCount,
                        ta.TotalActualWeight,
                        ta.ActualMachineCount
                    FROM PlanData p
                    LEFT JOIN TotalActualByDocNo ta 
                        ON p.DocNo = ta.DocNo
                        AND p.ProductionDate = ta.ProductionDate
                    GROUP BY
                        p.DocNo,
                        p.ProductionDate,
                        ta.TotalActualWeight,
                        ta.ActualMachineCount
                ),
                AllProduction AS (
                    SELECT 
                        pd.ProductionDate,
                        pd.MachineCode,
                        CASE 
                            WHEN EXISTS (
                                SELECT 1 
                                FROM PlanData p2 
                                WHERE p2.DocNo = pd.DocNo
                                AND p2.ProductionDate = pd.ProductionDate
                                AND ds.PlannedMachineCount > 1
                            ) 
                            THEN CAST(ds.TotalActualWeight AS FLOAT) / CAST(ds.PlannedMachineCount AS FLOAT)
                            ELSE actual.ActualQty
                        END as SplitQuantity
                    FROM PlanData pd
                    LEFT JOIN ProductionData actual
                        ON pd.DocNo = actual.DocNo 
                        AND pd.ProductionDate = actual.ProductionDate
                        AND pd.MachineCode = actual.MachineCode
                    LEFT JOIN DocNoToSplit ds 
                        ON pd.DocNo = ds.DocNo 
                        AND pd.ProductionDate = ds.ProductionDate
    
                    UNION ALL
    
                    SELECT 
                        pd.ProductionDate,
                        pd.MachineCode,
                        CASE
                            WHEN EXISTS (
                                SELECT 1 
                                FROM PlanData p 
                                WHERE p.DocNo = pd.DocNo
                                AND p.ProductionDate = pd.ProductionDate
                                AND p.MachineCode != pd.MachineCode
                                AND ds.PlannedMachineCount > 1
                            ) THEN 0
                            ELSE pd.ActualQty
                        END as SplitQuantity
                    FROM ProductionData pd
                    LEFT JOIN DocNoToSplit ds 
                        ON pd.DocNo = ds.DocNo 
                        AND pd.ProductionDate = ds.ProductionDate
                    WHERE NOT EXISTS (
                        SELECT 1 
                        FROM PlanData p 
                        WHERE p.DocNo = pd.DocNo 
                        AND p.MachineCode = pd.MachineCode
                        AND p.ProductionDate = pd.ProductionDate
                    )
                ),
                FinalProduction AS (
                    SELECT 
                        ProductionDate,
                        MachineCode,
                        SUM(SplitQuantity) as GoodQuantity,
                        0 as NgQuantity,
                        SUM(SplitQuantity) as TotalQuantity
                    FROM AllProduction
                    GROUP BY
                        ProductionDate,
                        MachineCode
                ),
                WorkingHoursData AS (
                    SELECT 
                        workdate as ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END as MachineCode,
                        SUM(working_minutes) as total_working_minutes,
                        CASE 
                            WHEN SUM(working_minutes) >= 1440 THEN 220
                            WHEN SUM(working_minutes) >= 960 THEN 160
                            WHEN SUM(working_minutes) >= 480 THEN 80
                            ELSE 0
                        END as planned_downtime_minutes
                    FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    WHERE workdate BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE 'CGM%'
                    GROUP BY workdate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END
                )
                SELECT 
                    final.MachineCode,
                    SUM(final.GoodQuantity) as ActualQuantity,
                    SUM(pl.PlannedQty) as PlannedQuantity,
                    SUM(final.NgQuantity) as NgQuantity,
                    SUM(d.TotalDowntime) as Downtime,
                    
                    -- Performance
                    CASE 
                        WHEN SUM(pl.PlannedQty) > 0 
                        THEN (SUM(final.TotalQuantity) / SUM(pl.PlannedQty)) * 100
                        ELSE 0 
                    END as Performance,
                    
                    -- Availability
                    CASE 
                        WHEN (SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes)) > 0 
                        THEN (
                            (SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes) - ISNULL(SUM(d.TotalDowntime), 0)) / 
                            (SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes))
                        ) * 100
                        ELSE 0 
                    END as Availability,
                    
                    -- Quality
                    CASE 
                        WHEN SUM(final.TotalQuantity) > 0 
                        THEN (SUM(final.GoodQuantity) / SUM(final.TotalQuantity)) * 100
                        ELSE 0 
                    END as Quality,
                    
                    -- OEE
                    CASE
                        WHEN SUM(pl.PlannedQty) > 0 
                             AND (SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes)) > 0 
                             AND SUM(final.TotalQuantity) > 0
                        THEN (
                            ((SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes) - ISNULL(SUM(d.TotalDowntime), 0)) / 
                             (SUM(wh.total_working_minutes) - SUM(wh.planned_downtime_minutes))) * 
                            (SUM(final.GoodQuantity) / SUM(pl.PlannedQty)) * 
                            (SUM(final.GoodQuantity) / SUM(final.TotalQuantity)) * 
                            100
                        )
                        ELSE 0
                    END as OEE
                FROM FinalProduction final
                LEFT JOIN PlanData pl ON 
                    final.ProductionDate = pl.ProductionDate AND
                    final.MachineCode = pl.MachineCode
                LEFT JOIN (
                    SELECT
                        CAST([Date] AS DATE) as ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END as MachineCode,
                        SUM(CASE 
                            WHEN CauseCode = 'G01' THEN 0  
                            ELSE Downtime 
                        END) as TotalDowntime
                    FROM [Production_Analytics].[dbo].[BreakdownMaster]
                    WHERE [Date] BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE 'CGM%'
                    GROUP BY CAST([Date] AS DATE),
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode
                        END
                ) d ON 
                    final.ProductionDate = d.ProductionDate AND
                    final.MachineCode = d.MachineCode
                LEFT JOIN WorkingHoursData wh ON
                    final.ProductionDate = wh.ProductionDate AND
                    final.MachineCode = wh.MachineCode
                GROUP BY final.MachineCode
                ORDER BY final.MachineCode
            `);
    
        return result.recordset;
    }

    // เมธอดสำหรับแผนกปกติ
    async getNormalOEE(db, startDate, endDate, department) {
        const result = await db.request()
            .input('startDate', sql.DateTime, new Date(startDate))
            .input('endDate', sql.DateTime, new Date(endDate))
            .input('department', sql.VarChar, department)
            .query(`
                WITH ProductionData AS (
                    SELECT 
                        CASE 
                            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                            THEN CAST(PrintTime AS DATE) 
                            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                        END AS ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END as MachineCode,
                        SUM(CASE 
                            WHEN ItemType IN ('WIP', 'FG') THEN printWeight 
                            ELSE 0 
                        END) as GoodQuantity,
                        SUM(CASE 
                            WHEN ItemType = 'NG' AND NCCode != 'WIP01' THEN printWeight 
                            ELSE 0 
                        END) as NgQuantity,
                        SUM(printWeight) as TotalQuantity
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    WHERE PrintTime BETWEEN 
                        DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
                        DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                        AND ItemType IN ('WIP', 'FG', 'NG')
                        AND Isdelete = 0
                        AND MachineCode LIKE @department + '%'
                    GROUP BY 
                        CASE 
                            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
                            THEN CAST(PrintTime AS DATE) 
                            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
                        END,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END
                ),
                PlanData AS (
                    SELECT 
                        CAST(ProductionDate AS DATE) as ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END as MachineCode,
                        SUM(ProductionQuantity) as PlannedQuantity
                    FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                    WHERE ProductionDate BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE @department + '%'
                    GROUP BY 
                        CAST(ProductionDate AS DATE),
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END
                ),
                Downtime AS (
                    SELECT 
                        CAST([Date] AS DATE) as ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END as MachineCode,
                        -- คำนวณ downtime โดยไม่รวม G01 ตั้งแต่แรก
                        SUM(CASE 
                            WHEN CauseCode = 'G01' THEN 0  
                            ELSE Downtime 
                        END) as TotalDowntime
                    FROM [Production_Analytics].[dbo].[BreakdownMaster]
                    WHERE [Date] BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE @department + '%'
                    GROUP BY 
                        CAST([Date] AS DATE),
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END
                ),
                WorkingHours AS (
                    SELECT 
                        workdate as ProductionDate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END as MachineCode,
                        SUM(working_minutes) as total_working_minutes
                    FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    WHERE workdate BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE @department + '%'
                    GROUP BY workdate,
                        CASE 
                            WHEN CHARINDEX('-', MachineCode) > 0 
                            THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                            ELSE MachineCode 
                        END
                ),
            PlannedDowntime AS (
                SELECT 
                    MachineCode,
                    CASE 
                        WHEN SUM(total_working_minutes) >= 1440 THEN 220
                        WHEN SUM(total_working_minutes) >= 960 THEN 160
                        WHEN SUM(total_working_minutes) >= 480 THEN 80
                        ELSE 0
                    END as planned_downtime
                FROM WorkingHours
                GROUP BY MachineCode
            )
            SELECT 
                pd.MachineCode,
                SUM(pd.GoodQuantity) as ActualQuantity,
                SUM(pl.PlannedQuantity) as PlannedQuantity,  -- ใช้ PlannedQuantity
                SUM(pd.NgQuantity) as NgQuantity,
                SUM(d.TotalDowntime) as Downtime,
                -- Performance
CASE 
    WHEN SUM(pl.PlannedQuantity) > 0 
    THEN (SUM(pd.TotalQuantity) / SUM(pl.PlannedQuantity)) * 100
    ELSE 0 
END as Performance,
                -- Availability 
                CASE 
                    WHEN (SUM(wh.total_working_minutes) - pdt.planned_downtime) > 0 
                    THEN (
                        (SUM(wh.total_working_minutes) - pdt.planned_downtime - ISNULL(SUM(d.TotalDowntime), 0)) / 
                        (SUM(wh.total_working_minutes) - pdt.planned_downtime)
                    ) * 100
                    ELSE 0 
                END as Availability,
                -- Quality
                CASE 
                    WHEN SUM(pd.TotalQuantity) > 0 
                    THEN (SUM(pd.GoodQuantity) / SUM(pd.TotalQuantity)) * 100
                    ELSE 0 
                END as Quality,
                -- OEE
                CASE 
                    WHEN SUM(pd.GoodQuantity) > 0 
                    THEN (
                        CASE 
                            WHEN (SUM(wh.total_working_minutes) - pdt.planned_downtime) > 0 
                            THEN (
                                (SUM(wh.total_working_minutes) - pdt.planned_downtime - ISNULL(SUM(d.TotalDowntime), 0)) / 
                                (SUM(wh.total_working_minutes) - pdt.planned_downtime)
                            ) * 100
                            ELSE 0 
                        END *
                        CASE 
                            WHEN SUM(pl.PlannedQuantity) > 0 
                            THEN (SUM(pd.TotalQuantity) / SUM(pl.PlannedQuantity)) * 100
                            ELSE 0 
                        END *
                        CASE 
                            WHEN SUM(pd.TotalQuantity) > 0 
                            THEN (SUM(pd.GoodQuantity) / SUM(pd.TotalQuantity)) * 100
                            ELSE 0 
                        END
                    ) / 10000
                    ELSE 0 
                END as OEE
            FROM ProductionData pd
            LEFT JOIN PlanData pl ON 
                pd.ProductionDate = pl.ProductionDate AND
                pd.MachineCode = pl.MachineCode
            LEFT JOIN Downtime d ON 
                pd.ProductionDate = d.ProductionDate AND
                pd.MachineCode = d.MachineCode
            LEFT JOIN WorkingHours wh ON
                pd.ProductionDate = wh.ProductionDate AND
                pd.MachineCode = wh.MachineCode
            LEFT JOIN PlannedDowntime pdt ON
                pd.MachineCode = pdt.MachineCode
            GROUP BY pd.MachineCode, pdt.planned_downtime
            ORDER BY pd.MachineCode
        `);

    return result.recordset;
}


    async getMachinePerformanceDetails(startDate, endDate, department) {
        const db = await this.getConnection();
        
        try {
            if (department === 'CGM') {
                return await this.getCGMMachineDetails(db, startDate, endDate);
            } else {
                return await this.getNormalMachineDetails(db, startDate, endDate, department);
            }
        } catch (error) {
            throw error;
        }
    }

    async getCGMMachineDetails(db, startDate, endDate) {
        try {
            const result = await db.request()
                .input('startDate', sql.Date, new Date(startDate))
                .input('endDate', sql.Date, new Date(endDate))
                .query(`
                    SELECT 
                        m.MachineCode,
                        SUM(CASE WHEN m.ItemType IN ('WIP','FG') THEN m.printWeight ELSE 0 END) as GoodQuantity,
                        SUM(CASE WHEN m.ItemType = 'NG' THEN m.printWeight ELSE 0 END) as NgQuantity,
                        p.PlannedQuantity,
                        ISNULL(d.Downtime, 0) as Downtime
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster] m
                    LEFT JOIN (
                        SELECT 
                            MachineCode,
                            SUM(ProductionQuantity) as PlannedQuantity
                        FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                        WHERE ProductionDate BETWEEN @startDate AND @endDate
                            AND MachineCode LIKE 'CGM%'
                        GROUP BY MachineCode
                    ) p ON m.MachineCode = p.MachineCode
                    LEFT JOIN (
                        SELECT 
                            MachineCode,
                            SUM(CASE 
                                WHEN CauseCode = 'G01' THEN 0
                                ELSE Downtime 
                            END) as Downtime
                        FROM [Production_Analytics].[dbo].[BreakdownMaster]
                        WHERE Date BETWEEN @startDate AND @endDate
                            AND MachineCode LIKE 'CGM%'
                        GROUP BY MachineCode
                    ) d ON m.MachineCode = d.MachineCode
                    WHERE m.PrintTime BETWEEN 
                        DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
                        DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                        AND m.MachineCode LIKE 'CGM%'
                        AND m.Isdelete = 0
                    GROUP BY 
                        m.MachineCode,
                        p.PlannedQuantity,
                        d.Downtime
                    ORDER BY m.MachineCode
                `);
                    
            return result.recordset;
        } catch (error) {
            throw error;
        }
    }

    async getNormalMachineDetails(db, startDate, endDate, department) {
        try {
            const result = await db.request()
                .input('startDate', sql.Date, new Date(startDate))
                .input('endDate', sql.Date, new Date(endDate))
                .input('department', sql.VarChar, `${department}%`)
                .query(`
                    SELECT 
                        m.MachineCode,
                        SUM(CASE WHEN m.ItemType IN ('WIP','FG') THEN m.printWeight ELSE 0 END) as GoodQuantity,
                        SUM(CASE WHEN m.ItemType = 'NG' THEN m.printWeight ELSE 0 END) as NgQuantity,
                        p.PlannedQuantity,
                        ISNULL(d.Downtime, 0) as Downtime
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster] m
                    LEFT JOIN (
                        SELECT 
                            MachineCode,
                            SUM(ProductionQuantity) as PlannedQuantity
                        FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                        WHERE ProductionDate BETWEEN @startDate AND @endDate
                        GROUP BY MachineCode
                    ) p ON m.MachineCode = p.MachineCode
                    LEFT JOIN (
                        SELECT 
                            MachineCode,
                            SUM(Downtime) as Downtime
                        FROM [Production_Analytics].[dbo].[BreakdownMaster]
                        WHERE Date BETWEEN @startDate AND @endDate
                        GROUP BY MachineCode
                    ) d ON m.MachineCode = d.MachineCode
                    WHERE m.PrintTime BETWEEN 
                        DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
                        DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                        AND m.MachineCode LIKE @department
                        AND m.Isdelete = 0
                    GROUP BY 
                        m.MachineCode,
                        p.PlannedQuantity,
                        d.Downtime
                    ORDER BY m.MachineCode
                `);
                
            return result.recordset;
        } catch (error) {
            throw error;
        }
    }

    async getDepartments() {
        return [
            'PRO', // Profile
            'CUT'
        ];
    }
}

module.exports = OeeRepository;