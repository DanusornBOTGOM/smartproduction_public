const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');
const { request } = require('express');

class ProductionDailyRepository {
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

    // ดึง RSNCode
    async getByRsnCode(rsnCode) {
        const db = await this.getConnection();

        try {
            if (!rsnCode) {
                throw new Error('RSNCode is required');
            }

            const result = await db.request()
                .input('RSNCode', sql.NVarChar(200), rsnCode)
                .query(`
                    SELECT TOP 1
                    DocNo, RSNCode, ItemSize, MachineCode, CoilNo, CurrentStep, PrintTime, PlateNo,
                    PartName, printWeight, TimeIn
                    FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                    WHERE RSNCode = @RSNCode
                    AND MachineCode LIKE 'COA%'
                    AND Isdelete = 0
                `);

                if (result.recordset.length === 0) {
                    throw new Error('RSNCode not found');
                }
    
                return result.recordset[0];
        } catch (error) {
            console.error('Error fetching production data:', error);
            throw error;
        }
    }

    // บันทึกฟอร์มผลิต
    async submitProductionData(productionData) {
        const db = await this.getConnection();
        let transaction;

        try {
            // ตรวขสอบข้อมูลซ้ำ
            const checkExisting = await db.request()
                .input('RSNCode', sql.NVarChar(200), productionData.RSNCode)
                .query(`
                    SELECT COUNT(*) as count
                    FROM [Production_Analytics].[dbo].[ProductionDailyLogs]
                    WHERE RSNCode = @RSNCode
                `);

        if (checkExisting.recordset[0].count > 0) {
            throw new Error('บาร์โค้ดนี้เคยถูกบันทึกไปแล้ว');
        }

        transaction = new sql.Transaction(db);
        await transaction.begin();

        const currentDateTime = new Date(new Date().getTime() + (7*60*60*1000));
        const formTypeID = 2; // Daily

        await transaction.request()
                .input('DocNo', sql.NVarChar(30), productionData.DocNo)
                .input('Grade', sql.NVarChar(30), productionData.PartName)
                .input('RSNCode', sql.NVarChar(200), productionData.RSNCode)
                .input('Size', sql.Float, parseFloat(productionData.ItemSize))
                .input('MachineCode', sql.NVarChar(50), productionData.MachineCode)
                .input('CoilNo', sql.NVarChar(100), productionData.CoilNo)
                .input('CurrentStep', sql.NVarChar(10), productionData.CurrentStep)
                .input('PrintTime', sql.DateTime, productionData.PrintTime)
                .input('PrintWeight', sql.Float, parseFloat(productionData.printWeight))
                .input('TimeIn', sql.DateTime, productionData.TimeIn)
                .input('TimeInManual', sql.DateTime, productionData.TimeInManual)
                .input('TimeOutManual', sql.DateTime, productionData.TimeOutManual)
                .input('SkinStatus', sql.Int, parseFloat(productionData.SkinStatus))
                .input('MaterialType', sql.Int, parseFloat(productionData.MaterialType))
                .input('OvenNumber', sql.Int, parseFloat(productionData.OvenNumber))
                .input('TimeInForm', sql.DateTime, productionData.TimeInForm)
                .input('TimeOutForm', sql.DateTime, productionData.TimeOutForm)
                .input('CreateDate', sql.DateTime, currentDateTime)
                .input('FormTypeID', sql.Int, formTypeID)
                .query(`
                    INSERT INTO [Production_Analytics].[dbo].[ProductionDailyLogs]
                        (DocNo, Grade, RSNCode, Size, MachineCode, CoilNo, CurrentStep, PrintTime, PrintWeight, 
                        TimeIn, TimeInManual, TimeOutManual, SkinStatus, MaterialType, OvenNumber, TimeInForm,
                        TimeOutForm, CreateDate, FormTypeID)
                    VALUES
                        (@DocNo, @Grade, @RSNCode, @Size, @MachineCode, @CoilNo, @CurrentStep, @PrintTime, @PrintWeight, 
                        @TimeIn, @TimeInManual, @TimeOutManual, @SkinStatus, @MaterialType, @OvenNumber, @TimeInForm,
                        @TimeOutForm, @CreateDate, @FormTypeID)
                `);

            await transaction.commit();
            return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

    // ดึงประวัติรายงานผลิตประจำวัน
    async getProductionRecords(date) {
        const db = await this.getConnection();

        try {
            const request = db.request();

            if (date) {
                request.input('date', sql.NVarChar, date);
            }

            const query = `
                SELECT ID, DocNo, Grade, RSNCode, Size, MachineCode, CoilNo, CurrentStep, PrintTime, 
                    OvenNumber, TimeInForm, TimeOutForm, PrintWeight, CreateDate, TimeIn, SkinStatus, MaterialType,
                    TimeInManual, TimeOutManual, Remark
                FROM [Production_Analytics].[dbo].[ProductionDailyLogs]
                WHERE FormTypeID = '2'
                ${date ? "AND CONVERT(date, TimeOutManual) = @date" : ""}
                ORDER BY CreateDate DESC
            `;

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching Production records:', error);
            throw error;
        }
    }

    // แก้ไขฟอร์ม records
    async updateTime(id, timeInManual, timeOutManual, timeInForm, timeOutForm) {
        const db = await this.getConnection();
    
        try {
            // ตรวจสอบว่ามีข้อมูลหรือไม่
            const checkExisting = await db.request()
                .input('ID', sql.Int, id)
                .query(`
                    SELECT COUNT(*) as count
                    FROM [Production_Analytics].[dbo].[ProductionDailyLogs]
                    WHERE ID = @ID
                `);
    
            if (checkExisting.recordset[0].count === 0) {
                throw new Error('ไม่พบข้อมูลที่ต้องการ');
            }
    
            // อัพเดทข้อมูล
            const result = await db.request()
                .input('ID', sql.Int, id)
                .input('TimeInManual', sql.DateTime, new Date(timeInManual))
                .input('TimeOutManual', sql.DateTime, new Date(timeOutManual))
                .input('TimeInForm', sql.DateTime, timeInForm ? new Date(timeInForm) : null)
                .input('TimeOutForm', sql.DateTime, timeOutForm ? new Date(timeOutForm) : null)
                .input('UpdatedAt', sql.DateTime, new Date())
                .query(`
                    UPDATE [Production_Analytics].[dbo].[ProductionDailyLogs]
                    SET TimeInManual = @TimeInManual,
                        TimeOutManual = @TimeOutManual,
                        TimeInForm = @TimeInForm,
                        TimeOutForm = @TimeOutForm,
                        UpdatedAt = @UpdatedAt
                    WHERE ID = @ID
                    AND FormTypeID = 2
                `);
    
            return {
                success: true,
                affectedRows: result.rowsAffected[0],
                id: id
            };
        } catch (error) {
            console.error('Error updating time:', error);
            throw error;
        }
    }

    // บันทึกซ้ำ - เพิ่ม Remark
    async submitDuplicateProductionData(productionData) {
        const db = await this.getConnection();
        let transaction;

        try {
            transaction = new sql.Transaction(db);
            await transaction.begin();

            const currentDateTime = new Date(new Date().getTime() + (7*60*60*1000));
            const formTypeID = 2; // Daily

            await transaction.request()
                .input('DocNo', sql.NVarChar(30), productionData.DocNo)
                .input('Grade', sql.NVarChar(30), productionData.PartName)
                .input('RSNCode', sql.NVarChar(200), productionData.RSNCode)
                .input('Size', sql.Float, parseFloat(productionData.ItemSize))
                .input('MachineCode', sql.NVarChar(50), productionData.MachineCode)
                .input('CoilNo', sql.NVarChar(100), productionData.CoilNo)
                .input('CurrentStep', sql.NVarChar(10), productionData.CurrentStep)
                .input('PrintTime', sql.DateTime, productionData.PrintTime)
                .input('PrintWeight', sql.Float, parseFloat(productionData.printWeight))
                .input('TimeIn', sql.DateTime, productionData.TimeIn)
                .input('TimeInManual', sql.DateTime, productionData.TimeInManual)
                .input('TimeOutManual', sql.DateTime, productionData.TimeOutManual)
                .input('SkinStatus', sql.Int, parseFloat(productionData.SkinStatus))
                .input('MaterialType', sql.Int, parseFloat(productionData.MaterialType))
                .input('OvenNumber', sql.Int, parseFloat(productionData.OvenNumber))
                .input('TimeInForm', sql.DateTime, productionData.TimeInForm)
                .input('TimeOutForm', sql.DateTime, productionData.TimeOutForm)
                .input('CreateDate', sql.DateTime, currentDateTime)
                .input('FormTypeID', sql.Int, formTypeID)
                .input('Remark', sql.NVarChar(200), productionData.Remark)
                .query(`
                    INSERT INTO [Production_Analytics].[dbo].[ProductionDailyLogs]
                        (DocNo, Grade, RSNCode, Size, MachineCode, CoilNo, CurrentStep, PrintTime, PrintWeight,
                        TimeIn, TimeInManual, TimeOutManual, SkinStatus, MaterialType, OvenNumber, TimeInForm,
                        TimeOutForm, CreateDate, FormTypeID, Remark)
                    VALUES
                        (@DocNo, @Grade, @RSNCode, @Size, @MachineCode, @CoilNo, @CurrentStep, @PrintTime, @PrintWeight, 
                        @TimeIn, @TimeInManual, @TimeOutManual, @SkinStatus, @MaterialType, @OvenNumber, @TimeInForm,
                        @TimeOutForm, @CreateDate, @FormTypeID, @Remark)
                `);

            await transaction.commit();
            return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };

        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

}

module.exports = ProductionDailyRepository;