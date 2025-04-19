const sql = require('mssql');
// const { connectDestSql } = require('../config/sqldb_dbconfig.js');

let db;

// async function initializeDatabase() {
//     try {
//         db = await connectDestSql();
//         if (db) {
//             console.log('Connected to MSSQL and MSW-Barcode API');
//         } else {
//             console.error('Failed to connect MSSQL and MSW-Barcode API');
//         }
//     } catch (err) {
//         console.error('Error initializing database connection:', err);
//     }
// }

class QuotationService {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection is required');
        }
        this.db = db;
    }

    async saveQuotation(data) {
        try {
            console.log('Saving quotation data:', data);
    
            // เริ่ม transaction
            const transaction = new sql.Transaction(this.db);
            await transaction.begin();
    
            try {
                // 1. บันทึกลง ProfileCalculations ก่อน
                const profileResult = await transaction.request()
                .input('CustomerName', sql.NVarChar, data.customerName)
                .input('Size', sql.Decimal(10,2), data.size)
                .input('MaterialGradeId', sql.Int, data.materialGradeId)
                .input('ShapeId', sql.Int, data.shapeId)
                .input('Quantity', sql.Int, data.quantity)
                .input('Width', sql.Decimal(10,2), data.width)
                .input('Height', sql.Decimal(10,2), data.height)
                .input('Radius', sql.Decimal(10,2), data.radius || 0)
                .input('Tolerance', sql.Decimal(10,4), data.tolerance)
                .input('GrindingLapOD', sql.Bit, data.grindingLapOD)
                .input('HasCutting', sql.Bit, data.hasCutting)
                .input('TotalPrice', sql.Decimal(10,2), data.totalPrice)
                .input('RequiresCarbide', sql.Bit, data.materialId === 2)
                .input('CalculationDate', sql.DateTime, new Date())
                .input('RollerType', sql.NVarChar, data.rollerType)
                .input('CRDType', sql.NVarChar, data.crdType)
                .input('RollerPrice', sql.Decimal(10,2), data.rollerPrice)
                .input('CRDPrice', sql.Decimal(10,2), data.crdPrice)
                .input('ShapePrice', sql.Decimal(10,2), data.shapePrice)
                .input('CuttingPrice', sql.Decimal(10,2), data.cuttingPrice)
                .input('BendingPrice', sql.Decimal(10,2), data.bendingPrice)
                // เพิ่มฟิลด์ที่จำเป็น
                .input('SurfaceEmphasis', sql.NVarChar, data.surfaceEmphasis)
                .input('WireTypeId', sql.Int, data.wireTypeId)
                .input('ShapeMethod', sql.NVarChar, data.shapeMethod)
                .query(`
                    INSERT INTO ProfileCalculations (
                        CustomerName, Size, MaterialGradeId, ShapeId, 
                        Quantity, Width, Height, Radius, Tolerance,
                        GrindingLapOD, HasCutting, TotalPrice, 
                        RequiresCarbide, CalculationDate,
                        RollerType, CRDType, RollerPrice, CRDPrice,
                        ShapePrice, CuttingPrice, BendingPrice,
                        SurfaceEmphasis, WireTypeId, ShapeMethod
                    )
                    VALUES (
                        @CustomerName, @Size, @MaterialGradeId, @ShapeId,
                        @Quantity, @Width, @Height, @Radius, @Tolerance,
                        @GrindingLapOD, @HasCutting, @TotalPrice,
                        @RequiresCarbide, @CalculationDate,
                        @RollerType, @CRDType, @RollerPrice, @CRDPrice,
                        @ShapePrice, @CuttingPrice, @BendingPrice,
                        @SurfaceEmphasis, @WireTypeId, @ShapeMethod
                    );
                    SELECT SCOPE_IDENTITY() AS Id;
                `);
    
                const profileCalculationId = profileResult.recordset[0].Id;
    
                // 2. บันทึกลง QuotationHistory
                const quotationResult = await transaction.request()
                    .input('QuotationNo', sql.NVarChar, this.generateQuotationNo())
                    .input('ProfileCalculationId', sql.Int, profileCalculationId)
                    .input('CustomerName', sql.NVarChar, data.customerName)
                    .input('MaterialGradeId', sql.Int, data.materialGradeId)
                    .input('ShapeId', sql.Int, data.shapeId)
                    .input('Size', sql.Decimal(10,2), data.size)
                    .input('Width', sql.Decimal(10,2), data.width)
                    .input('Height', sql.Decimal(10,2), data.height)
                    .input('Quantity', sql.Int, data.quantity)
                    .input('RollerPrice', sql.Decimal(10,2), data.rollerPrice)
                    .input('CRDPrice', sql.Decimal(10,2), data.crdPrice)
                    .input('ShapePrice', sql.Decimal(10,2), data.shapePrice)
                    .input('CuttingPrice', sql.Decimal(10,2), data.cuttingPrice)
                    .input('BendingPrice', sql.Decimal(10,2), data.bendingPrice)
                    .input('TotalPrice', sql.Decimal(10,2), data.totalPrice)
                    .input('CreatedBy', sql.NVarChar, data.createdBy)
                    .input('Status', sql.NVarChar, 'Draft')
                    .query(`
                        INSERT INTO QuotationHistory (
                            QuotationNo, ProfileCalculationId, CustomerName,
                            MaterialGradeId, ShapeId, Size, Width, Height, Quantity,
                            RollerPrice, CRDPrice, ShapePrice, CuttingPrice, BendingPrice,
                            TotalPrice, CreatedBy, Status
                        )
                        VALUES (
                            @QuotationNo, @ProfileCalculationId, @CustomerName,
                            @MaterialGradeId, @ShapeId, @Size, @Width, @Height, @Quantity,
                            @RollerPrice, @CRDPrice, @ShapePrice, @CuttingPrice, @BendingPrice,
                            @TotalPrice, @CreatedBy, @Status
                        );
                        SELECT SCOPE_IDENTITY() AS Id;
                    `);
    
                // Commit transaction ถ้าทุกอย่างสำเร็จ
                await transaction.commit();
                return quotationResult;
    
            } catch (error) {
                // Rollback ถ้าเกิดข้อผิดพลาด
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error in saveQuotation:', error);
            throw error;
        }
    }

    async getQuotationHistory(filters = {}) {
        try {
            let query = `
                SELECT 
                    qh.*,
                    mg.GradeName,
                    s.ShapeName
                FROM QuotationHistory qh
                LEFT JOIN MaterialGrades mg ON qh.MaterialGradeId = mg.Id
                LEFT JOIN Shapes s ON qh.ShapeId = s.Id
                WHERE 1=1
            `;

            const queryParams = [];

            if (filters.customerName) {
                query += ` AND qh.CustomerName LIKE @CustomerName`;
                queryParams.push(['CustomerName', sql.NVarChar, `%${filters.customerName}%`]);
            }

            if (filters.status) {
                query += ` AND qh.Status = @Status`;
                queryParams.push(['Status', sql.NVarChar, filters.status]);
            }

            query += ` ORDER BY qh.QuotationDate DESC`;

            const request = this.db.request();
            queryParams.forEach(param => request.input(param[0], param[1], param[2]));

            return await request.query(query);
        } catch (error) {
            throw error;
        }
    }

    generateQuotationNo() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `QT${year}${month}-${random}`;
    }
}

module.exports = QuotationService;