const sql = require('mssql/msnodesqlv8');
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

async getDepartments() {
    return [
        'Drawing',
        'Profile',
        'BAR2',
        'BAR1',
        'CGM'
    ];
}
}

module.exports = WorkingHourRepository;