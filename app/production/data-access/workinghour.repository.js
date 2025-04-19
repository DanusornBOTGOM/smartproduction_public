const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class WorkingHourRepository {
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

    // 1. Chart Data OEE All
// app/production/data-access/oee.repository.js

    async getOverallDepartmentWorking(startDate, endDate, department) {
        const db = await this.getConnection();
        
        try {
            console.log('Executing query with params:', { startDate, endDate, department });

            let deptPrefixes = [];
            let specificMachines = [];
            let excludeMachines = [];

            switch(department) {
                case 'Drawing':
                    deptPrefixes = ['DRA'];
                    excludeMachines = ['DRA022'];  // เพิ่มเครื่องที่ต้องการยกเว้น
                    break;
                case 'Profile':
                    deptPrefixes = ['PRO'];
                    break;
                case 'BAR2':
                    deptPrefixes = ['CUT', 'PAP', 'CO2'];
                    specificMachines = ['DRA022'];
                    break;
                case 'BAR1':
                    deptPrefixes = ['COM'];
                    specificMachines = ['CUT22', 'STN004', 'TWR001'];
                    break;
                case 'CGM':
                    deptPrefixes = ['CGM'];
                    break;            
                default:
                    deptPrefixes = [department];
            }

            // แปลง array ของ prefixes เป็น string สำหรับ SQL IN clause
            const prefixList = deptPrefixes.map(p => `'${p}%'`).join(' OR MachineCode LIKE ');
            const specificMachinesList = specificMachines.map(m => `'${m}'`).join(',');
            const excludeMachinesList = excludeMachines.map(m => `'${m}'`).join(',');
            
            let whereClause = 'WHERE (';
            // เพิ่มเงื่อนไข prefix patterns
            whereClause += `MachineCode LIKE ${prefixList}`;
            
            // เพิ่มเงื่อนไขเครื่องจักรเฉพาะ (ถ้ามี)
            if (specificMachines.length > 0) {
                whereClause += ` OR MachineCode IN (${specificMachinesList})`;
            }
            whereClause += ')';
            
            // เพิ่มเงื่อนไขยกเว้นเครื่องจักร (ถ้ามี)
            if (excludeMachines.length > 0) {
                whereClause += ` AND MachineCode NOT IN (${excludeMachinesList})`;
            }

            const result = await db.request()
                .input('startDate', sql.DateTime, new Date(startDate))
                .input('endDate', sql.DateTime, new Date(endDate))
                .query(`
                    WITH CleanedMachineCode AS (
                        SELECT 
                            [ID],
                            SUBSTRING(MachineCode, 1, CHARINDEX('-', MachineCode + '-') - 1) AS BaseMachineCode,
                            workdate,
                            working_hours
                        FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                        ${whereClause}
                        AND [workdate] >= @startDate
                        AND [workdate] <= @endDate
                        AND IsDeleted = 0
                    ),
                    WeeklyHours AS (
                        SELECT
                            BaseMachineCode,
                            SUM(CASE
                                WHEN DAY(workdate) BETWEEN 1 AND 6 THEN working_hours
                                ELSE 0 
                            END) AS [1-6],
                            SUM(CASE
                                WHEN DAY(workdate) BETWEEN 7 AND 13 THEN working_hours
                                ELSE 0
                            END) AS [7-13],
                            SUM(CASE
                                WHEN DAY(workdate) BETWEEN 14 AND 20 THEN working_hours
                                ELSE 0
                            END) AS [14-20],
                            SUM(CASE
                                WHEN DAY(workdate) BETWEEN 21 AND 27 THEN working_hours
                                ELSE 0
                            END) AS [21-27],
                            SUM(CASE
                                WHEN DAY(workdate) BETWEEN 28 AND 31 THEN working_hours
                                ELSE 0
                            END) AS [28-31],
                            SUM(working_hours) AS Total
                        FROM CleanedMachineCode
                        GROUP BY BaseMachineCode
                    )
                    SELECT
                        BaseMachineCode,
                        [1-6],
                        [7-13],
                        [14-20],
                        [21-27],
                        [28-31],
                        Total
                    FROM WeeklyHours
                    ORDER BY BaseMachineCode
                `);

            console.log('Query result:', result.recordset);
            return result.recordset || [];
            
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    }

        // เว็บชั่วโมงการทำงาน วิศวกรรม
        async getDepartments() {
            return [
                'Drawing',
                'Profile',
                'BAR2',
                'BAR1',
                'CGM'
            ];
        }

    // 2. workshift !
    async getMachines() {
        const db = await this.getConnection();
 
        try {
            // ทดลองใช้คำสั่ง SQL ที่ง่ายกว่า
            const result = await db.request()
                .query(`
                    SELECT DISTINCT MachineCode
                    FROM [Production_Analytics].[dbo].[WorkMachine]
                    ORDER BY MachineCode
                `);
            
            // แปลงผลลัพธ์ให้มีรูปแบบตามที่ต้องการ
            return result.recordset.map(item => ({
                MachineCode: item.MachineCode,
                MachineName: `${item.MachineCode}`
            }));
 
        } catch (error) {
            console.error('Error retrieving machines:', error);
            throw error;
        }
    }

    async getWorkshifts(machineCode, startDate, endDate) {
        const db = await this.getConnection();

        try {
            const result = await db.request()
                .input('machineCode', sql.NVarChar, machineCode)
                .input('startDate', sql.Date, startDate)
                .input('endDate', sql.Date, endDate)
                .query(`
                    SELECT 
                        ID,
                        workshift_id,
                        MachineCode,
                        CONVERT(varchar, workdate, 23) AS workdate,
                        CONVERT(varchar, shst, 120) AS shst,
                        CONVERT(varchar, shen, 120) AS shen,
                        working_hours,
                        working_minutes
                    FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    WHERE MachineCode = @machineCode
                    AND workdate BETWEEN @startDate AND @endDate
                    AND IsDeleted = 0
                    ORDER BY workdate, shst
                `);

            return result.recordset;
        } catch (error) {
            console.error('Error fetching workshifts:', error);
            throw error;
        }
    }

    async addWorkshift(workshiftData) {
        const db = await this.getConnection();

        try {
            // คำนวณเวลาทำงานเป็นชั่วโมงและนาที
            const shstDate = new Date(workshiftData.shst);
            const shenDate = new Date(workshiftData.shen);
            const diffMs = shenDate - shstDate;
            const diffMinutes = Math.floor(diffMs / 60000);
            const workingHours = Math.floor(diffMinutes / 60);
            const workingMinutes = diffMinutes;

            const result = await db.request()
                .input('MachineCode', sql.NVarChar, workshiftData.machineCode)
                .input('workdate', sql.Date, workshiftData.workdate)
                .input('shst', sql.DateTime, workshiftData.shst)
                .input('shen', sql.DateTime,  workshiftData.shen)
                .input('lastupdate', sql.DateTime, new Date())
                .input('SourceDB', sql.NVarChar, 2)
                .input('working_hours', sql.Int, workingHours)
                .input('working_minutes', sql.Int, workingMinutes)
                .query(`
                    INSERT INTO [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    (MachineCode, workdate, shst, shen, lastupdate, SourceDB, working_hours, working_minutes)
                    VALUES
                    (@MachineCode, @workdate, @shst, @shen, @lastupdate, @SourceDB, @working_hours, @working_minutes);
                    
                    SELECT SCOPE_IDENTITY() AS ID;
                `);

            const id = result.recordset[0].ID;
            return { id, ...workshiftData, working_hours: workingHours, working_minutes: workingMinutes };
        } catch (error) {
            console.error('Error adding workshift:', error);
            throw error;
        }
    }

    async updateWorkshift(id, workshiftData) {
        const db = await this.getConnection();

        try {
            // คำนวณเวลาทำงานเป็นชั่วโมงและนาที
            const shstDate = new Date(workshiftData.shst);
            const shenDate = new Date(workshiftData.shen);
            const diffMs = shenDate - shstDate;
            const diffMinutes = Math.floor(diffMs / 60000);
            const workingHours = Math.floor(diffMinutes / 60);
            const workingMinutes = diffMinutes;

            const result = await db.request()
                .input('id', sql.Int, id)
                .input('MachineCode', sql.NVarChar, workshiftData.machineCode)
                .input('workdate', sql.Date, workshiftData.workdate)
                .input('shst', sql.DateTime, workshiftData.shst)
                .input('shen', sql.DateTime, workshiftData.shen)
                .input('lastupdate', sql.DateTime, new Date())
                .input('working_hours', sql.Int, workingHours)
                .input('working_minutes', sql.Int, workingMinutes)
                .query(`
                    UPDATE [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    SET
                        MachineCode = @MachineCode,
                        workdate = @workdate,
                        shst = @shst,
                        shen = @shen,
                        lastupdate = @lastupdate,
                        working_hours = @working_hours,
                        working_minutes = @working_minutes
                    WHERE ID = @id  
                `);
                
                return { id, ...workshiftData, working_hours: workingHours, working_minutes: workingMinutes };
            } catch (error) {
                console.error('Error updating workshift:', error);
                throw error;
            }
    }

    // soft delete เอาเนื่องจากดึงข้อมูลมา
    async deleteWorkshift(id) {
        const db = await this.getConnection();

        try {
            await db.request()
                .input('id', sql.Int, id)
                .query(`
                    UPDATE [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    SET IsDeleted = 1
                    WHERE ID = @id
                `)

            return true;
        } catch (error) {
            console.error('Error deleting workshift:', error);
            throw error;
        }
    }

    async getWorkshiftById(id) {
        const db = await this.getConnection();

        try {
            const result = await db.request()
                .input('id', sql.Int, id)
                .query(`
                    SELECT 
                        ID,
                        workshift_id,
                        MachineCode,
                        CONVERT(varchar, workdate, 23) AS workdate,
                        CONVERT(varchar, shst, 120) AS shst,
                        CONVERT(varchar, shen, 120) AS shen,
                        working_hours,
                        working_minutes
                    FROM [Production_Analytics].[dbo].[DailyWorkShiftMswAll]
                    WHERE ID = @id
                    AND IsDeleted = 0
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching workshift by ID:', error);
            throw error;
        }
    }

    async getWorkshiftsCalendarEvents(machineCode, startDate, endDate) {
        const db = await this.getConnection();

        try {
            const workshifts = await this.getWorkshifts(machineCode, startDate, endDate)

            // แปลงข้อมูลให้เป็นรูปแบบที่ใช้กับปฎิทิน
            const events = workshifts.map(shift => {
                return {
                    title: `${shift.MachineCode} (${shift.working_hours} ชม.)`,
                    start: shift.shst,
                    end: shift.shen,
                    id: shift.ID,
                    location: `${shift.working_hours} ชั่วโมง ${shift.working_minutes} นาที`
                };
            });

            return events;
        } catch (error) {
            console.error('Error', error);
            throw error
        }

    }

}

module.exports = WorkingHourRepository;