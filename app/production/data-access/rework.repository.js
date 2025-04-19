const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class ReworkRepository {
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

    // ดึงข้อมูลจาก RSNCodeRef2 
    async getByRsnCodeRef2(rsnCodeRef2) {
        const db = await this.getConnection();

        try {
            if (!rsnCodeRef2) {
                throw new Error('RSNCodeRef2 is required');
            }

            console.log('Searching for RSNCode:', rsnCodeRef2);

            const result = await db.request()
                .input('RSNCodeRef2', sql.NVarChar(200), rsnCodeRef2)
                .query(`
                    SELECT TOP 1
                    DocNo, PartName, SizeIn, ItemQty, CoilNo, PlateNo,
                    TimeIn, RSNCodeRef2
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    WHERE RSNCodeRef2 = @RSNCodeRef2
                `);
            
            if (result.recordset.length === 0) {
                throw new Error('RSNCode not found');
            }

            console.log('Found data:', result.recordset[0]);
            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching rework data:', error);
            throw error;
        }
    }

    // บันทึกข้อมูล Rework
    async submitFormDataRework(formDataRework) {
        const db = await this.getConnection();
        let transaction;

        try {
            transaction = new sql.Transaction(db);
            await transaction.begin();

            const currentDateTime = new Date(); // วันที่และเวลาปัจจุบัน

            // สร้าง query ที่ไม่มีฟิลด์ RSNCodeRef2 และ PlateNo
            await transaction.request()
                    .input('DocNo', sql.NVarChar(30), formDataRework.DocNo)
                    .input('Grade', sql.NVarChar(30), formDataRework.PartName)
                    .input('SizeIn', sql.NVarChar(30), formDataRework.SizeIn)
                    .input('WeightIn', sql.Float, formDataRework.ItemQty)
                    .input('CoilNo', sql.NVarChar(50), formDataRework.CoilNo || '')
                    .input('TimeIn', sql.DateTime, formDataRework.TimeIn || currentDateTime)
                    .input('CreateDate', sql.DateTime, currentDateTime)
                    .input('StatusRework', sql.Bit, 1) // กำหนดค่าเป็น 1 เสมอ 
                    .input('workcenterId', sql.NVarChar(50), formDataRework.workcenterId || '')
                    .input('SizeOut', sql.NVarChar(30), formDataRework.SizeOut || '')
                    .input('MachineCode', sql.NVarChar(50), formDataRework.MachineCode)
                    .input('Remark', sql.NVarChar(255), formDataRework.Remark || '')
                    .query(`
                        INSERT INTO [Production_Analytics].[dbo].[ReworkRecords]
                            (DocNo, Grade, SizeIn, WeightIn, CoilNo, TimeIn, 
                             CreateDate, StatusRework, workcenterId, SizeOut, MachineCode, Remark)
                        VALUES
                            (@DocNo, @Grade, @SizeIn, @WeightIn, @CoilNo, @TimeIn,
                             @CreateDate, @StatusRework, @workcenterId, @SizeOut, @MachineCode, @Remark)
                    `);

                    await transaction.commit();
                    return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

    // ดึงประวัติ Rework Records
    async getReworkRecords() {
        const db = await this.getConnection();

        try {
            const result = await db.request()
                .query(`
                    SELECT DocNo, Grade, SizeIn, WeightIn, CoilNo, PlateNo, TimeIn, RSNCodeRef2,
                    CreateDate, StatusRework, workcenterId, SizeOut, MachineCode, Remark
                    FROM [Production_Analytics].[dbo].[ReworkRecords]
                    ORDER BY CreateDate DESC
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching Rework records:', error);
            throw error;
        }
    }

    // ดึง WorkMachine
    async getWorkCenters() {
        const db = await this.getConnection();

        try {
            const result = await db.request()
                .query(`
                    SELECT ID, workmachineId, MachineCode, workcenterId, IsActive
                    FROM [Production_Analytics].[dbo].[WorkMachine]
                    WHERE MachineCode LIKE 'PRO%' AND IsActive = 1
                    ORDER BY MachineCode
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching WorkMachine data:', error);
            throw error;
        }
    }

}

module.exports = ReworkRepository;