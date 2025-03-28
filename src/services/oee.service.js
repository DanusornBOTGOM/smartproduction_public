// services/oee.service.js
const sql = require('mssql/msnodesqlv8');
const { connectDestSql } = require('../../config/sqldb_dbconfig');
const NodeCache = require('node-cache');
const { 
    formatDateThai, 
    formatDate, 
    getStartEndDates,
    formatForDatabase,
    isValidDate 
} = require('../utils/dateUtils');


class OEEService {
    constructor() {
        // ลบ db parameter ออก
        this.cache = new NodeCache({
            stdTTL: 600,
            checkperiod: 60,
            useClones: false
        });
        this.logs = [];
    }

    // แก้ไขเมธอด clearCache ให้เคลียร์เฉพาะวันที่เกี่ยวข้อง
    clearCache(date) {
        const cacheKeys = this.cache.keys();
        let clearedKeys = 0;
        
        cacheKeys.forEach(key => {
            // เคลียร์เฉพาะ cache ที่เกี่ยวข้องกับวันที่นั้นๆ
            if (key.includes(date)) {
                this.cache.del(key);
                clearedKeys++;
                this.log(`Cleared cache key: ${key}`);
            }
        });
        
        this.log(`Cleared ${clearedKeys} cache keys for date: ${date}`);
    }

    // helper method
    formatDateForSQL(dateString) {
        try {
            // ใช้ formatDate จาก dateUtils
            const formatted = formatDate(new Date(dateString));
            if (!formatted) {
                this.log('Invalid date format for:', dateString);
                return null;
            }
            return formatted;
        } catch (error) {
            this.log('Error formatting date:', error);
            return null;
        }
    }

    getCacheInfo() {
        return {
            keys: this.cache.keys(),
            stats: this.cache.getStats()
        };
    }

    log(...args) {
        const logEntry = {
            timestamp: new Date(),
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' ')
        };
        
        //console.log(...args); // server log
        this.logs.push(logEntry); // เก็บ log

        // เก็บแค่ 100 ล่าสุด
        if (this.logs.length > 100) {
            this.logs.shift();
        }

        return logEntry;
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    async updateMorningTalk(date, machineCode, downtime) {
        try {
            const pool = await connectDestSql();
            await pool.request()
                .input('date', sql.Date, new Date(date))
                .input('machineCode', sql.VarChar, machineCode)
                .input('downtime', sql.Float, downtime)
                .query(`
                    MERGE [Production_Analytics].[dbo].[BreakdownMaster] AS target
                    USING (SELECT @date AS Date, @machineCode AS MachineCode) AS source
                    ON target.Date = source.Date 
                    AND target.MachineCode = source.MachineCode
                    AND target.CauseCode = 'G01'
                    WHEN MATCHED THEN
                        UPDATE SET 
                            Downtime = @downtime,
                            lastupdate = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (Date, MachineCode, CauseCode, Cause, Downtime, lastupdate)
                        VALUES (@date, @machineCode, 'G01', 'Morning Talk', @downtime, GETDATE());
                `);

            // เคลียร์ cache ทั้งหมด
            this.cache.flushAll();
            this.log('Cleared all cache after Morning Talk update');
            return { success: true };
        } catch (error) {
            this.log('Error updating Morning Talk:', error);
            throw error;
        }
    }

    // เพิ่มเมธอดสำหรับเคลียร์ cache ทั้งระบบ
    clearAllCache() {
        this.cache.flushAll();
        this.log('Cleared all cache');
    } 

    async calculateOEE(startDate, endDate, machineCode) {
        try {
            // 1. ตรวจสอบและ format วันที่
            if (!startDate || !endDate) {
                throw new Error('Start date and end date are required');
            }
    
            const formattedStartDate = this.formatDateForSQL(startDate);
            const formattedEndDate = this.formatDateForSQL(endDate);
    
            // 2. เพิ่ม log ก่อนเริ่ม query
            this.log('Query parameters:', {
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                machineCode: machineCode || 'all',
                shift_start: 'DATEADD(HOUR, 8, CAST(@startDate AS DATETIME))',
                shift_end: 'DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))'
            });
    
            const cacheKey = `oee_${formattedStartDate}_${formattedEndDate}_${machineCode || 'all'}`;
            const cachedData = this.cache.get(cacheKey);
    
            // 3. เพิ่ม log สำหรับ cache
            if (cachedData) {
                this.log('Using cached data:', { cacheKey });
                return { ...cachedData, status: 'Retrieved from cache' };
            }
    
            // เปลี่ยนจาก this.db เป็น pool
            const pool = await connectDestSql();
            const request = pool.request()
            request.input('startDate', sql.DateTime, new Date(formattedStartDate));
            request.input('endDate', sql.DateTime, new Date(formattedEndDate));
            request.input('machineCode', sql.VarChar, machineCode || '');    


            // 4. เพิ่ม log ก่อนรัน queries
            this.log('Executing queries with parameters:', {
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                machineCode: machineCode || 'all'
            });            

            // Losstime
            const losstimeQuery = `
            SELECT 
                CAST(b.Date AS DATE) as ProductionDate,
                CASE 
                    WHEN CHARINDEX('-', b.MachineCode) > 0 
                    THEN LEFT(b.MachineCode, CHARINDEX('-', b.MachineCode) - 1)
                    ELSE b.MachineCode
                END as MachineCode,
                b.CauseCode,
                b.Cause,
                b.Downtime,
                COALESCE(c.Description, b.Cause) as CauseDescription
            FROM [Production_Analytics].[dbo].[BreakdownMaster] b
            LEFT JOIN [Production_Analytics].[dbo].[BreakdownCauses] c 
                ON b.CauseCode = c.CauseCode
            WHERE b.Date BETWEEN @startDate AND @endDate
                AND (@machineCode = '' OR 
                    CASE 
                        WHEN CHARINDEX('-', b.MachineCode) > 0 
                        THEN LEFT(b.MachineCode, CHARINDEX('-', b.MachineCode) - 1)
                        ELSE b.MachineCode
                    END = @machineCode)
                AND b.Downtime > 0  -- ยังต้องมีเงื่อนไขนี้
            ORDER BY 
                CAST(b.Date AS DATE),
                MachineCode,
                b.CauseCode`;
    
            // Planned Production Query
            const planQuery = `
                SELECT 
                    CAST(p.ProductionDate AS DATE) as ProductionDate,
                    CASE 
                        WHEN CHARINDEX('-', p.MachineCode) > 0 
                        THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                        ELSE p.MachineCode
                    END as MachineCode,
                    SUM(p.ProductionQuantity) as PlannedQuantity,
                    COUNT(DISTINCT p.DocNo) as BatchCount
                FROM [Production_Analytics].[dbo].[Planing_SectionAny] p
                WHERE CAST(p.ProductionDate AS DATE) BETWEEN @startDate AND @endDate
                    AND (@machineCode = '' OR 
                        CASE 
                            WHEN CHARINDEX('-', p.MachineCode) > 0 
                            THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                            ELSE p.MachineCode
                        END = @machineCode)
                    AND MachineCode NOT LIKE 'CGM%'
                GROUP BY 
                    CAST(p.ProductionDate AS DATE),
                    CASE 
                        WHEN CHARINDEX('-', p.MachineCode) > 0 
                        THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                        ELSE p.MachineCode
                    END;
                `;

                const cgmActualQuery = `
                WITH PlanData AS (
                    SELECT
                        CAST(ProductionDate AS DATE) AS ProductionDate,
                        MachineCode,
                        DocNo,
                        SUM(ProductionQuantity) AS PlannedQty
                    FROM [Production_Analytics].[dbo].[Planing_SectionAny]
                    WHERE ProductionDate BETWEEN @startDate AND @endDate
                        AND MachineCode LIKE 'CGM%'
                    GROUP BY 
                        CAST(ProductionDate AS DATE),
                        MachineCode,
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
NgData AS (
    SELECT 
        CASE 
            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
            THEN CAST(PrintTime AS DATE) 
            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
        END AS ProductionDate,
        MachineCode,
        SUM(CASE 
            WHEN ItemType = 'NG' AND NCCode NOT IN ('WIP01', 'R100', 'R101', 'R102', 'P101') THEN printWeight
            ELSE 0 
        END) as NgQuantity
    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
    WHERE PrintTime BETWEEN 
        DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
        DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
    AND MachineCode LIKE 'CGM%'
    AND ItemType = 'NG'
    AND Isdelete = 0
    GROUP BY
        CASE 
            WHEN CAST(PrintTime AS TIME) >= '08:00:00' 
            THEN CAST(PrintTime AS DATE) 
            ELSE DATEADD(DAY, -1, CAST(PrintTime AS DATE))
        END,
        MachineCode
),
TotalActualByDocNo AS (
    SELECT 
        DocNo,
        ProductionDate,
        SUM(ActualQty) AS TotalActualWeight,
        COUNT(DISTINCT MachineCode) as ActualMachineCount  -- เพิ่มการนับจำนวนเครื่องที่ผลิตจริง
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
    -- ข้อมูลที่มีการแบ่งหาร (เฉพาะที่มีหลายเครื่อง)
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
    WHERE (@machineCode = '' OR pd.MachineCode = @machineCode)

    UNION ALL

    -- ข้อมูลที่ไม่มีในแผน หรือเป็นงานปกติ
    SELECT 
        pd.ProductionDate,
        pd.MachineCode,
        CASE
            -- ถ้า DocNo นี้มีในแผนที่เครื่องอื่นและมีหลายเครื่อง ให้เป็น 0
            WHEN EXISTS (
                SELECT 1 
                FROM PlanData p 
                WHERE p.DocNo = pd.DocNo
                AND p.ProductionDate = pd.ProductionDate
                AND p.MachineCode != pd.MachineCode
                AND ds.PlannedMachineCount > 1
            ) THEN 0
            -- ถ้าไม่ใช่ ใช้ค่าจริง
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
    AND (@machineCode = '' OR pd.MachineCode = @machineCode)
)
SELECT 
    a.ProductionDate,
    a.MachineCode,
    SUM(a.SplitQuantity) as GoodQuantity,
    ISNULL(n.NgQuantity, 0) as NgQuantity,  -- เพิ่ม NG จาก NgData
    SUM(a.SplitQuantity) + ISNULL(n.NgQuantity, 0) as TotalQuantity
FROM AllProduction a
LEFT JOIN NgData n ON 
    a.ProductionDate = n.ProductionDate AND 
    a.MachineCode = n.MachineCode
GROUP BY
    a.ProductionDate,
    a.MachineCode,
    n.NgQuantity  -- ต้องเพิ่มในการ GROUP BY เพราะไม่ได้ใช้ aggregate function
ORDER BY
    a.ProductionDate,
    a.MachineCode`;

                const cgmPlanQuery = `
                SELECT 
                    CAST(p.ProductionDate AS DATE) as ProductionDate,
                    CASE 
                        WHEN CHARINDEX('-', p.MachineCode) > 0 
                        THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                        ELSE p.MachineCode
                    END as MachineCode,
                    SUM(p.ProductionQuantity) as PlannedQuantity,
                    COUNT(DISTINCT p.DocNo) as BatchCount
                FROM [Production_Analytics].[dbo].[Planing_SectionAny] p
                WHERE CAST(p.ProductionDate AS DATE) BETWEEN @startDate AND @endDate
                    AND (@machineCode = '' OR 
                        CASE 
                            WHEN CHARINDEX('-', p.MachineCode) > 0 
                            THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                            ELSE p.MachineCode
                        END = @machineCode)
                    AND MachineCode LIKE 'CGM%'  -- เปลี่ยนเป็น LIKE 'CGM%'
                GROUP BY 
                    CAST(p.ProductionDate AS DATE),
                    CASE 
                        WHEN CHARINDEX('-', p.MachineCode) > 0 
                        THEN LEFT(p.MachineCode, CHARINDEX('-', p.MachineCode) - 1)
                        ELSE p.MachineCode
                    END;
                `; 
                    
            // Actual Production Query
            const actualQuery = `
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
                    WHEN ItemType = 'NG' AND NCCode NOT IN ('WIP01', 'R100', 'R101', 'R102', 'P101') THEN printWeight
                    ELSE 0 
                END) as NgQuantity,
                SUM(printWeight) as TotalQuantity
            FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
            WHERE PrintTime BETWEEN 
                DATEADD(HOUR, 8, CAST(@startDate AS DATETIME)) AND
                DATEADD(HOUR, 8, DATEADD(DAY, 1, CAST(@endDate AS DATETIME)))
                AND (@machineCode = '' OR 
                    CASE 
                        WHEN CHARINDEX('-', MachineCode) > 0 
                        THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                        ELSE MachineCode
                    END = @machineCode)
                AND Isdelete = 0
                AND ItemType IN ('WIP', 'FG', 'NG')
                AND MachineCode NOT LIKE 'CGM%'
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
                END`;

            // ปรับปรุง workingHoursQuery
            const workingHoursQuery = `
            SELECT 
                workdate as ProductionDate,
                CASE 
                    WHEN CHARINDEX('-', MachineCode) > 0 
                    THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                    ELSE MachineCode
                END as MachineCode,
                SUM(working_hours) as total_working_hours,
                SUM(working_minutes) as total_working_minutes
            FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
            WHERE workdate BETWEEN @startDate AND @endDate
                AND (@machineCode = '' OR 
                    CASE 
                        WHEN CHARINDEX('-', MachineCode) > 0 
                        THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                        ELSE MachineCode
                    END = @machineCode)
            GROUP BY workdate,
                CASE 
                    WHEN CHARINDEX('-', MachineCode) > 0 
                    THEN LEFT(MachineCode, CHARINDEX('-', MachineCode) - 1)
                    ELSE MachineCode
                END`;        

                
    
            console.log('Executing queries...');
            
        // ประกาศตัวแปรครั้งเดียว
        let planResult, actualResult, losstimeResult, workingHoursResult;

        try {
            if (machineCode && machineCode.startsWith('CGM')) {
                [planResult, actualResult, losstimeResult, workingHoursResult] = await Promise.all([
                    request.query(cgmPlanQuery),
                    request.query(cgmActualQuery),
                    request.query(losstimeQuery),
                    request.query(workingHoursQuery)
                ]);
                console.log('Using CGM queries');
            } else {
                [planResult, actualResult, losstimeResult, workingHoursResult] = await Promise.all([
                    request.query(planQuery),
                    request.query(actualQuery),
                    request.query(losstimeQuery),
                    request.query(workingHoursQuery)
                ]);
                console.log('Using normal queries');
            }

            console.log('Queries executed successfully');
            console.log('Plan records:', planResult.recordset.length);
            console.log('Actual records:', actualResult.recordset.length);
            console.log('Losstime records:', losstimeResult.recordset.length);

            // สร้าง Map เพื่อเก็บข้อมูลชั่วโมงการทำงาน
            const workingHoursMap = new Map(
                workingHoursResult.recordset.map(row => [
                    `${formatDate(row.ProductionDate)}_${row.MachineCode}`,
                    {
                        working_hours: row.total_working_hours,
                        working_minutes: row.total_working_minutes
                    }
                ])
            );

                // 5. เพิ่ม log หลังรัน queries
                this.log('Query results:', {
                    planRecords: planResult.recordset.length,
                    actualRecords: actualResult.recordset.length,
                    losstimeRecords: losstimeResult.recordset.length,
                    timeRange: {
                        firstPlan: planResult.recordset[0]?.ProductionDate,
                        lastPlan: planResult.recordset[planResult.recordset.length - 1]?.ProductionDate,
                        firstActual: actualResult.recordset[0]?.ProductionDate,
                        lastActual: actualResult.recordset[actualResult.recordset.length - 1]?.ProductionDate
                    }
                });

                // จัดกลุ่มข้อมูล Losstime ตามวันและเครื่องจักร
                const losstimeMap = losstimeResult.recordset.reduce((acc, curr) => {
                    const key = `${curr.ProductionDate}_${curr.MachineCode}`;
                    if (!acc.has(key)) {
                        acc.set(key, {
                            causes: new Map(),
                            total: 0
                        });
                    }
                    const dayData = acc.get(key);
                    dayData.causes.set(curr.CauseCode, {
                        description: curr.CauseDescription,
                        downtime: curr.TotalDowntime || 0
                    });
                    dayData.total += (curr.TotalDowntime || 0);
                    return acc;
                }, new Map());

                // 6. เพิ่ม log สำหรับ losstime
                this.log('Losstime data processed:', {
                    totalRecords: losstimeResult.recordset.length,
                    uniqueMachines: new Set(losstimeResult.recordset.map(r => r.MachineCode)).size,
                    dateRange: {
                        first: losstimeResult.recordset[0]?.ProductionDate,
                        last: losstimeResult.recordset[losstimeResult.recordset.length - 1]?.ProductionDate
                    }
                });
    
                console.log('Queries executed successfully');
                console.log('Plan records:', planResult.recordset.length);
                console.log('Actual records:', actualResult.recordset.length);
                console.log('Losstime records:', losstimeResult.recordset.length);  
    
                // เริ่มโค้ดที่แก้ไขตรงนี้ - รวบรวมทุกวันที่มีข้อมูล
                // รวบรวมวันที่ทั้งหมดที่มีข้อมูล
                const allDates = new Set();
    
                // เก็บวันที่จากทุกแหล่งข้อมูล
                planResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    allDates.add(key);
                });
    
                actualResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    allDates.add(key);
                });
    
                workingHoursResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    allDates.add(key);
                });
    
                losstimeResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    allDates.add(key);
                });
    
                // สร้าง maps สำหรับแต่ละประเภทข้อมูล
                const planMap = new Map();
                planResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    planMap.set(key, row);
                });
    
                const actualMap = new Map();
                actualResult.recordset.forEach(row => {
                    const key = `${formatDate(row.ProductionDate)}_${row.MachineCode}`;
                    actualMap.set(key, row);
                });
    
                // สร้าง mergedData ที่รวมข้อมูลทั้งหมด
                const mergedData = Array.from(allDates).map(key => {
                    const [dateStr, machineCode] = key.split('_');
                    const productionDate = new Date(dateStr);
                    
                    // ดึงข้อมูลจาก maps หรือใช้ค่าเริ่มต้น
                    const plan = planMap.get(key) || { PlannedQuantity: 0, BatchCount: 0 };
                    const actual = actualMap.get(key) || { GoodQuantity: 0, NgQuantity: 0, TotalQuantity: 0 };
                    const workingHours = workingHoursMap.get(key) || { working_hours: 0, working_minutes: 0 };
                    
                    // ดึง losstime
                    const dayLosstime = losstimeResult.recordset.filter(loss => 
                        formatDate(loss.ProductionDate) === dateStr && 
                        loss.MachineCode === machineCode
                    );
                    
                    // กลุ่ม losstime ตาม CauseCode
                    const lossCauseMap = new Map();
                    dayLosstime.forEach(loss => {
                        let mapKey;
                        let description;
                        
                        if (loss.CauseCode === null) {
                            mapKey = 'NO_CODE';
                            description = 'เปลี่ยนขนาดใหม่';
                        } else {
                            mapKey = loss.CauseCode;
                            description = `${loss.Cause} (${loss.CauseCode})`;
                        }
    
                        if (!lossCauseMap.has(mapKey)) {
                            lossCauseMap.set(mapKey, {
                                causeCode: loss.CauseCode,
                                description: description,
                                downtime: 0
                            });
                        }
                        const existingCause = lossCauseMap.get(mapKey);
                        existingCause.downtime += Number(loss.Downtime || 0);
                    });
    
                    const lossCauses = Array.from(lossCauseMap.values())
                        .map(cause => ({
                            causeCode: cause.causeCode,
                            description: cause.description,
                            downtime: cause.downtime
                        }));
                    
                    // คำนวณ totalLosstime (ไม่รวม G01)
                    const totalLosstime = lossCauses.reduce((sum, cause) => {
                        if (cause.causeCode === 'G01') return sum;
                        return sum + (cause.downtime || 0);
                    }, 0);
    
                    return {
                        ProductionDate: productionDate,
                        MachineCode: machineCode,
                        WorkingHours: workingHours.working_hours,
                        WorkingMinutes: workingHours.working_minutes,
                        PlannedQuantity: plan.PlannedQuantity || 0,
                        BatchCount: plan.BatchCount || 0,
                        GoodQuantity: actual.GoodQuantity || 0,
                        NgQuantity: actual.NgQuantity || 0,
                        TotalQuantity: actual.TotalQuantity || 0,
                        details: {
                            losstime: lossCauses,
                            totalLosstime: totalLosstime,
                            WorkingMinutes: workingHours.working_minutes,
                            WorkingHours: workingHours.working_hours,
                            actualQty: actual.GoodQuantity || 0,
                            plannedQty: plan.PlannedQuantity || 0,
                            NgQuantity: actual.NgQuantity || 0
                        }
                    };
                });
    
                // เรียงลำดับตามวันที่และ MachineCode
                mergedData.sort((a, b) => {
                    if (a.ProductionDate.getTime() !== b.ProductionDate.getTime()) {
                        return a.ProductionDate.getTime() - b.ProductionDate.getTime();
                    }
                    return a.MachineCode.localeCompare(b.MachineCode);
                });
                // จบโค้ดที่แก้ไข
    
                // 7. เพิ่ม log สำหรับ merged data
                this.log('Data merging completed:', {
                    totalRecords: mergedData.length,
                    uniqueMachines: new Set(mergedData.map(m => m.MachineCode)).size,
                    dateRange: {
                        first: mergedData[0]?.ProductionDate,
                        last: mergedData[mergedData.length - 1]?.ProductionDate
                    }
                });
    
                const result = this.computeOEEMetrics(mergedData);
    
                // 8. เพิ่ม log สำหรับผลลัพธ์สุดท้าย
                this.log('Final OEE calculation result:', {
                    overall: result.overall,
                    totalDays: result.dailyMetrics.length,
                    averageOEE: result.overall.oee
                });
    
                // เก็บข้อมูลใน cache
                this.cache.set(cacheKey, result);
                return { ...result, status: 'Calculated new data' };
    
            } catch (error) {
                // 9. เพิ่ม log สำหรับ error
                this.log('Error in query execution:', {
                    error: error.message,
                    stack: error.stack,
                    parameters: {
                        startDate: formattedStartDate,
                        endDate: formattedEndDate,
                        machineCode
                    }
                });
                throw error;
            }
        } catch (error) {
            this.log('Critical error in OEE calculation:', error);
            throw error;
        }
    }

    async getMachines() {
        try {
            const cacheKey = 'machine_list';
            const cachedMachines = this.cache.get(cacheKey);
            
            if (cachedMachines) {
                console.log('Returning cached machines data');
                return cachedMachines;
            }
    
            const pool = await connectDestSql();
            const result = await pool.request()
                .query(`
                SELECT DISTINCT 
                    CASE 
                        WHEN MachineCode LIKE 'PRO%' THEN
                            MachineCode
                        WHEN MachineCode LIKE 'ANN%' THEN
                            SUBSTRING(MachineCode, 1, 
                                CASE 
                                    WHEN CHARINDEX('-', MachineCode) > 0 
                                    THEN CHARINDEX('-', MachineCode) - 1
                                    ELSE LEN(MachineCode)
                                END
                            )
                        ELSE
                            SUBSTRING(MachineCode, 1, 
                                CASE 
                                    WHEN CHARINDEX('-', MachineCode) > 0 
                                    THEN CHARINDEX('-', MachineCode) - 1
                                    ELSE LEN(MachineCode)
                                END
                            )
                    END as MachineCode 
                FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE MachineCode IS NOT NULL 
                    AND ISNULL(Isdelete, 0) = 0
                    AND ItemType IN ('WIP', 'FG', 'NG')
                GROUP BY 
                    CASE 
                        WHEN MachineCode LIKE 'PRO%' THEN
                            MachineCode
                        WHEN MachineCode LIKE 'ANN%' THEN
                            SUBSTRING(MachineCode, 1, 
                                CASE 
                                    WHEN CHARINDEX('-', MachineCode) > 0 
                                    THEN CHARINDEX('-', MachineCode) - 1
                                    ELSE LEN(MachineCode)
                                END
                            )
                        ELSE
                            SUBSTRING(MachineCode, 1, 
                                CASE 
                                    WHEN CHARINDEX('-', MachineCode) > 0 
                                    THEN CHARINDEX('-', MachineCode) - 1
                                    ELSE LEN(MachineCode)
                                END
                            )
                    END
                ORDER BY MachineCode
            `);
        
        // ยังคงต้องมี cache เพราะช่วยลดการเรียก database บ่อยๆ
        this.cache.set(cacheKey, result.recordset, 7200);
        
        return result.recordset;
    } catch (error) {
        console.error('Error fetching machines:', error);
        throw error;
    }
} 
    
    mergeProductionAndQualityData(production, quality) {
        console.log('Raw production data:', production);  // debug log
        const dataMap = new Map();
        
        production.forEach(p => {
            const key = `${p.ProductionDate}_${p.MachineCode}`;
            const entry = {
                ProductionDate: p.ProductionDate,
                MachineCode: p.MachineCode,
                WorkingHours: p.WorkingHours || 0,
                WorkingMinutes: p.WorkingMinutes || 0,  // ตรวจสอบค่านี้
                TotalWorkHours: p.TotalWorkHours || 0,
                PlannedQuantity: p.PlannedQuantity || 0,
                BatchCount: p.BatchCount || 0,
                GoodQuantity: 0,
                NgQuantity: 0,
                TotalQuantity: 0
            };
            console.log(`Creating entry for ${key}:`, entry);  // debug log
            dataMap.set(key, entry);
        });
    
        quality.forEach(q => {
            const key = `${q.ProductionDate}_${q.MachineCode}`;
            if (dataMap.has(key)) {
                const record = dataMap.get(key);
                record.GoodQuantity = q.GoodQuantity || 0;
                record.NgQuantity = q.NgQuantity || 0;
                record.TotalQuantity = q.TotalQuantity || 0;
            }
        });
    
        return Array.from(dataMap.values());
    }

    computeOEEMetrics(data) {
        if (!data?.length) {
            return this.getEmptyOEEMetrics();
        }
    
        const dailyMetrics = data.map(row => {
            const workMinutes = row.WorkingMinutes || 0;
            let plannedDowntime = 0;
            let availability = 0;
            
            if (workMinutes > 0) {
                if (workMinutes >= 1440) {
                    plannedDowntime = 220;
                } else if (workMinutes >= 960) {
                    plannedDowntime = 160;
                } else if (workMinutes >= 480) {
                    plannedDowntime = 80;
                }
    
                const plannedWorkMinutes = workMinutes - plannedDowntime;
                // รวม downtime ทั้งหมด รวมถึงที่ไม่มี CauseCode
                const actualDowntime = row.details?.totalLosstime || 0;
                const actualAvailableMinutes = plannedWorkMinutes - actualDowntime;
                availability = actualAvailableMinutes / plannedWorkMinutes;
                // availability = Math.min(actualAvailableMinutes / plannedWorkMinutes, 1); //จำกัด % ไว้ที่100
            }
    
            const performance = row.PlannedQuantity > 0 ? 
                row.TotalQuantity / row.PlannedQuantity : 0;
                // Math.min(row.TotalQuantity / row.PlannedQuantity, 1) : 0; //จำกัด % ไว้ที่100
            const quality = row.TotalQuantity > 0 ? 
                row.GoodQuantity / row.TotalQuantity : 0;
                // Math.min(row.GoodQuantity / row.TotalQuantity, 1) : 0; //จำกัด % ไว้ที่100
            
            const oee = workMinutes > 0 ? availability * performance * quality : 0;
    
            return {
                date: row.ProductionDate,
                machineCode: row.MachineCode,
                metrics: {
                    oee: this.formatPercentage(oee),
                    availability: this.formatPercentage(availability),
                    performance: this.formatPercentage(performance),
                    quality: this.formatPercentage(quality)
                },
                details: {
                    WorkingHours: row.WorkingHours || 0,
                    WorkingMinutes: workMinutes,
                    plannedDowntime: plannedDowntime,
                    actualQty: row.GoodQuantity || 0,
                    NgQuantity: row.NgQuantity || 0,
                    TotalQuantity: row.TotalQuantity || 0,
                    plannedQty: row.PlannedQuantity || 0,
                    batchCount: row.BatchCount || 0,
                    losstime: row.details?.losstime || [],
                    totalLosstime: row.details?.totalLosstime || 0
                }
            };
        });
    
        return {
            overall: this.calculateOverallMetrics(dailyMetrics),
            dailyMetrics
        };
    }

    calculateOverallMetrics(dailyMetrics) {
        // รวมข้อมูลทั้งหมด
        const totals = dailyMetrics.reduce((acc, curr) => ({
            totalActual: acc.totalActual + (curr.details.TotalQuantity || 0),
            totalPlanned: acc.totalPlanned + (curr.details.plannedQty || 0),
            totalGood: acc.totalGood + (curr.details.actualQty || 0),
            totalDowntime: acc.totalDowntime + (curr.details.totalLosstime || 0),
            totalWorkingMinutes: acc.totalWorkingMinutes + (curr.details.WorkingMinutes || 0),
            totalPlannedDowntime: acc.totalPlannedDowntime + (curr.details.plannedDowntime || 0)
        }), {
            totalActual: 0,
            totalPlanned: 0,
            totalGood: 0,
            totalDowntime: 0,
            totalWorkingMinutes: 0,
            totalPlannedDowntime: 0
        });
    
        // คำนวณ Metrics รวม
        const actualWorkMinutes = totals.totalWorkingMinutes - totals.totalPlannedDowntime;
        
        // Availability
        const availability = actualWorkMinutes > 0 ? 
            ((actualWorkMinutes - totals.totalDowntime) / actualWorkMinutes) : 0;
    
        // Performance
        const performance = totals.totalPlanned > 0 ? 
            (totals.totalActual / totals.totalPlanned) : 0;
    
        // Quality
        const quality = totals.totalActual > 0 ? 
            (totals.totalGood / totals.totalActual) : 0;
    
        // OEE
        const oee = availability * performance * quality;
    
        // Return formatted results
        return {
            oee: this.formatPercentage(oee),
            availability: this.formatPercentage(availability),
            performance: this.formatPercentage(performance),
            quality: this.formatPercentage(quality)
        };
    }

    formatPercentage(value) {
        return Number((value * 100).toFixed(1));
    }

    getEmptyOEEMetrics() {
        return {
            overall: {
                oee: 0,
                availability: 0,
                performance: 0,
                quality: 0
            },
            dailyMetrics: []
            
        };
    }
}

module.exports = OEEService;