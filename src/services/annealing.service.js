const sql = require('mssql/msnodesqlv8');
const { connectDestSql } = require('../../config/sqldb_dbconfig');

class AnnealingService {
    async getInitialData() {
        const pool = await connectDestSql();
        const result = await pool.request()
            .query(`
                SELECT 
                    DocNo, PartName, SizeIn, SizeOut, ItemQty,
                    CoilNo, CurrentStep, PrintTime, printWeight,
                    PlateNo, ItemType, ItemStatus, MachineCode,
                    RSNCode, TimeIn
                FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE Isdelete = 0 
                AND ItemType = 'WIP'
                AND MachineCode LIKE 'CLE%'
                ORDER BY PrintTime DESC   
            `);
        return result.recordset;
    }

    async getByRSNCode(rsnCode) {
        const pool = await connectDestSql();
        const result = await pool.request()
            .input('RSNCode', sql.NVarChar(200), rsnCode)
            .query(`
                SELECT
                    DocNo, PartName, SizeIn, ItemQty, CoilNo, 
                    CurrentStep, printWeight, RSNCode, PlateNo, 
                    PrintTime, TimeIn
                FROM [Production_Analytics].[dbo].[ProductionTrackingMaster]
                WHERE RSNCode = @RSNCode
                AND Isdelete = 0
                AND ItemType = 'WIP'
                AND MachineCode LIKE 'CLE%'
            `);

        if (result.recordset.length === 0) {
            throw new Error('RSNCode not found');
        }

        return result.recordset[0];
    }

    async getAnnealingRecords() {
        const pool = await connectDestSql();
        const result = await pool.request()
            .query(`
                SELECT 
                    DocNo, Grade, Size, WeightInput, CoilNo,
                    LabelNumber, CurrentStep, WashingPound,
                    CleanLiness, WireWound, Rust, Bend,
                    HeadPump, EntryStatus, PrintWeight,
                    PlateNo, CreateDate, TimeIn, PrintTime
                FROM [Production_Analytics].[dbo].[Annealing_Form]
                ORDER BY CreateDate DESC
            `);
        return result.recordset;
    }

    async submitFormData(formData) {
        const pool = await connectDestSql();
        let transaction;
        try {
            const checkExisting = await pool.request()
                .input('RSNCode', sql.NVarChar(50), formData.RSNCode)
                .query(`
                    SELECT COUNT(*) as count
                    FROM [Production_Analytics].[dbo].[Annealing_Form]
                    WHERE RSNCode = @RSNCode    
                `);

            if (checkExisting.recordset[0].count > 0) {
                throw new Error('Code นี้เคยถูกบันทึกไปแล้ว');
            }

            transaction = new sql.Transaction(pool);
            await transaction.begin();

            await transaction.request()
                    .input('RSNCode', sql.NVarChar(50), formData.RSNCode)
                    .input('DocNo', sql.NVarChar(30), formData.docNo)
                    .input('Grade', sql.NVarChar(30), formData.PartName)
                    .input('Size', sql.NVarChar(30), formData.SizeIn)
                    .input('WeightInput', sql.Float, formData.ItemQty)
                    .input('CoilNo', sql.NVarChar(100), formData.CoilNo)
                    .input('CurrentStep', sql.NVarChar(10), formData.CurrentStep)
                    .input('LabelNumber', sql.NVarChar(50), formData.labelNumber)
                    .input('WashingPound', sql.Int, parseInt(formData.WashingPound))
                    .input('CleanLiness', sql.NVarChar(10), parseInt(formData.CleanLiness))
                    .input('WireWound', sql.NVarChar(10), parseInt(formData.wireWound))
                    .input('Rust', sql.NVarChar(10), parseInt(formData.rust))
                    .input('Bend', sql.NVarChar(10), parseInt(formData.bend))
                    .input('HeadPump', sql.NVarChar(10), parseInt(formData.headPump))
                    .input('EntryStatus', sql.NVarChar(10), formData.entryStatus)
                    .input('PrintWeight', sql.Float, formData.printWeight)
                    .input('PlateNo', sql.NVarChar(50), formData.PlateNo)
                    .query(`
                        INSERT INTO [Production_Analytics].[dbo].[Annealing_Form]
                            (DocNo, Grade, Size, WeightInput, CoilNo, CurrentStep, 
                             LabelNumber, PrintTime, TimeIn, WashingPound, 
                             CleanLiness, WireWound, Rust, Bend, HeadPump, 
                             EntryStatus, PrintWeight, PlateNo, RSNCode)
                        SELECT 
                            @DocNo, @Grade, @Size, @WeightInput, @CoilNo, 
                            @CurrentStep, @LabelNumber, ptm.PrintTime, ptm.TimeIn,
                            @WashingPound, @CleanLiness, @WireWound, @Rust, 
                            @Bend, @HeadPump, @EntryStatus, @PrintWeight, 
                            @PlateNo, @RSNCode
                        FROM [Production_Analytics].[dbo].[ProductionTrackingMaster] ptm
                        WHERE ptm.RSNCode = @RSNCode
                    `);

                    await transaction.commit();
                    return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
                } catch (error) {
                    if (transaction) await transaction.rollback();
                    throw error;
                }
            }
        }

module.exports = AnnealingService;