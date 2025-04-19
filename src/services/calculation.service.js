const sql = require('mssql');
// const { connectDestSql } = require('../config/sqldb_dbconfig');

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

class CalculationService {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection is required');
        }
        this.db = db;
    }

    async getMaterialCategories() {
        try {
            const result = await this.db.request()
                .query('SELECT * FROM MaterialCategories ORDER BY CategoryName');
            return result.recordset;
        } catch (error) {
            throw new Error(`Error fetching material categories: ${error.message}`);
        }
    }

    async getMaterialGrades(categoryId) {
        try {
            const result = await this.db.request()
                .input('CategoryId', sql.Int, categoryId)
                .query(`
                    SELECT mg.*, mc.CategoryName
                    FROM MaterialGrades mg
                    JOIN MaterialCategories mc ON mg.CategoryId = mc.Id
                    WHERE mg.CategoryId = @CategoryId
                    ORDER BY mg.GradeName
                `);
            return result.recordset;
        } catch (error) {
            throw new Error(`Error fetching material grades: ${error.message}`);
        }
    }

    async getShapes() {
        try {
            const result = await this.db.request()
                .query('SELECT * FROM Shapes ORDER BY ShapeName');
            return result.recordset;
        } catch (error) {
            throw new Error(`Error fetching shapes: ${error.message}`);
        }
    }

    async getWireTypes() {
        try {
            const result = await this.db.request()
                .query('SELECT * FROM WireTypes ORDER BY WireTypeName');
            return result.recordset;
        } catch (error) {
            throw new Error(`Error fetching wire types: ${error.message}`);
        }
    }

    async getSurfaceEmphasis() {
        try {
            const result = await this.db.request()
                .query(`
                    SELECT 
                        Id,
                        EmphasisType,
                        RequiresCarbide,
                        Description
                    FROM SurfaceEmphasis 
                    ORDER BY Id
                `);
            
            // เพิ่ม logging เพื่อดูข้อมูลที่ได้
            console.log('Surface emphasis data:', result.recordset);
            
            // ตรวจสอบว่ามีข้อมูลหรือไม่
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error('No surface emphasis data found');
            }
            
            return result.recordset;
        } catch (error) {
            console.error('Database error in getSurfaceEmphasis:', error);
            throw error;
        }
    }

    async determineMaterial(materialGradeId, tolerance, surfaceEmphasis, wireTypeId) {
        try {
            const materialGrade = await this.db.request()
                .input('Id', sql.Int, materialGradeId)
                .query('SELECT RequiresCarbide FROM MaterialGrades WHERE Id = @Id');

            if (materialGrade.recordset[0]?.RequiresCarbide) {
                return 2; // Carbide
            }

            if (tolerance >= 0 && tolerance <= 0.05) {
                return 2;
            }

            const surfaceResult = await this.db.request()
                .input('EmphasisType', sql.NVarChar, surfaceEmphasis)
                .query('SELECT RequiresCarbide FROM SurfaceEmphasis WHERE EmphasisType = @EmphasisType');

            if (surfaceResult.recordset[0]?.RequiresCarbide) {
                return 2;
            }

            const wireResult = await this.db.request()
                .input('Id', sql.Int, wireTypeId)
                .query('SELECT RequiresCarbide FROM WireTypes WHERE Id = @Id');

            if (wireResult.recordset[0]?.RequiresCarbide) {
                return 2;
            }

            return 1; // SKD11
        } catch (error) {
            throw new Error(`Error determining material: ${error.message}`);
        }
    }

    async calculateRollerPrice(materialId, size, grindingLapOD) {
        try {
            const result = await this.db.request()
                .input('MaterialId', sql.Int, materialId)
                .input('Size', sql.Decimal(10, 2), size)
                .query(`
                    SELECT rp.OfferPrice, rp.ActualPrice, rp.GrindingLapODPrice, 
                           rs.RollerType, rs.MinSize, rs.MaxSize
                    FROM RollerPrices rp
                    JOIN RollerSizes rs ON rp.RollerSizeId = rs.Id
                    WHERE rp.MaterialId = @MaterialId
                    AND @Size BETWEEN rs.MinSize AND rs.MaxSize
                `);
    
            const rollerData = result.recordset[0];
            const details = rollerData ? 
                `${rollerData.RollerType} (${rollerData.MinSize}-${rollerData.MaxSize}mm): ${rollerData.OfferPrice.toLocaleString()} บาท` : 
                'ไม่พบข้อมูลสำหรับขนาดนี้';
    
            return {
                basePrice: rollerData?.OfferPrice || 0,
                actualPrice: rollerData?.ActualPrice || 0,
                grindingPrice: grindingLapOD ? (rollerData?.GrindingLapODPrice || 0) : 0,
                rollerType: rollerData?.RollerType,
                details
            };
        } catch (error) {
            throw error;
        }
    }

    async calculateCRDPrice(materialId, width, height, grindingLapOD) {
        try {
            const result = await this.db.request()
                .input('MaterialId', sql.Int, materialId)
                .input('Width', sql.Decimal(10, 2), width)
                .input('Height', sql.Decimal(10, 2), height)
                .query(`
                    SELECT cp.OfferPrice, cp.GrindingLapODPrice, cs.CRDType
                    FROM CRDPrices cp
                    JOIN CRDSizes cs ON cp.CRDSizeId = cs.Id
                    WHERE cp.MaterialId = @MaterialId
                    AND @Width BETWEEN cs.MinWidth AND cs.MaxWidth
                    AND @Height BETWEEN cs.MinHeight AND cs.MaxHeight
                    ORDER BY cs.Priority DESC
                `);

            const crdData = result.recordset[0];
            return {
                basePrice: crdData?.OfferPrice || 0,
                grindingPrice: grindingLapOD ? (crdData?.GrindingLapODPrice || 0) : 0,
                crdType: crdData?.CRDType
            };
        } catch (error) {
            throw new Error(`Error calculating CRD price: ${error.message}`);
        }
    }

    async calculateShapePrice(materialId, shapeId, shapeMethod) {
        try {
            const result = await this.db.request()
                .input('MaterialId', sql.Int, materialId)
                .input('ShapeId', sql.Int, shapeId)
                .query(`
                    SELECT sp.NormalShapePrice, sp.SpecialShapeMaxPrice,
                           s.ShapeName, s.IsSpecial
                    FROM ShapePrices sp
                    JOIN Shapes s ON sp.ShapeId = s.Id
                    WHERE sp.MaterialId = @MaterialId AND sp.ShapeId = @ShapeId
                `);
    
            const shapeData = result.recordset[0];
            if (!shapeData) {
                return {
                    basePrice: 0,
                    details: 'ไม่พบข้อมูลราคาสำหรับรูปทรงนี้'
                };
            }
    
            const basePrice = shapeData.IsSpecial ? 
                shapeData.SpecialShapeMaxPrice : 
                shapeData.NormalShapePrice;
    
            const finalPrice = shapeMethod === 'inhouse' ? basePrice / 2 : basePrice;
    
            const details = `${shapeData.ShapeName} (${shapeData.IsSpecial ? 'Special' : 'Normal'}): ` +
                (shapeMethod === 'inhouse' ? 
                    `${basePrice.toLocaleString()} ÷ 2 = ${finalPrice.toLocaleString()} บาท (Inhouse)` :
                    `${finalPrice.toLocaleString()} บาท`);
    
            return { basePrice: finalPrice, details };
        } catch (error) {
            throw error;
        }
    }

    async calculateCuttingPrice(hasCutting) {
        try {
            if (!hasCutting) return { total: 0, details: 'ไม่มีการตัด' };
    
            const result = await this.db.request()
                .query(`
                    SELECT ToolType, OfferPrice
                    FROM CuttingToolPrices
                `);
    
            // แยกราคาตามประเภท
            const prices = result.recordset.reduce((acc, item) => {
                if (item.ToolType.includes('บูทตัด')) {
                    acc.boot = (acc.boot || 0) + item.OfferPrice;
                } else if (item.ToolType.includes('มีดตัด')) {
                    acc.knife = (acc.knife || 0) + item.OfferPrice;
                }
                return acc;
            }, {});
    
            const total = (prices.boot || 0) + (prices.knife || 0);
            const details = `บูทตัด: ${prices.boot?.toLocaleString()} + มีดตัด: ${prices.knife?.toLocaleString()} = ${total.toLocaleString()} บาท`;
    
            return { total, details };
        } catch (error) {
            throw error;
        }
    }

    async calculateBendingPrice(size) {
        try {
            const result = await this.db.request()
                .input('Size', sql.Decimal(10, 2), size)
                .query(`
                    SELECT ToolType, OfferPrice, MinSize, MaxSize
                    FROM BendingToolPrices
                    WHERE @Size BETWEEN MinSize AND MaxSize
                `);
    
            const bendingData = result.recordset[0];
            const price = bendingData?.OfferPrice || 0;
            const details = bendingData ? 
                `${bendingData.ToolType} (ขนาด ${bendingData.MinSize}-${bendingData.MaxSize}mm): ${price.toLocaleString()} บาท` :
                'ไม่พบราคาที่เหมาะสมสำหรับขนาดนี้';
    
            return { price, details };
        } catch (error) {
            throw error;
        }
    }

    async calculateTotalPrice(data) {
        try {
            // log ข้อมูลที่รับมา
            console.log('Input data:', data);

            const materialId = await this.determineMaterial(
                data.materialGradeId,
                data.tolerance,
                data.surfaceEmphasis,
                data.wireTypeId
            );

            // ทำ Promise.all เพื่อคำนวณราคาพร้อมกัน
            const [rollerPriceData, crdPriceData, shapePriceData] = await Promise.all([
                this.calculateRollerPrice(materialId, data.size, data.grindingLapOD),
                this.calculateCRDPrice(materialId, data.width, data.height, data.grindingLapOD),
                this.calculateShapePrice(materialId, data.shapeId, data.shapeMethod)
            ]);

            // คำนวณราคา cutting และ bending
            const cuttingPrice = await this.calculateCuttingPrice(data.hasCutting);
            const bendingPrice = await this.calculateBendingPrice(data.size);

            // เก็บรายละเอียดการคำนวณ
            const calculations = {
                roller: `ราคาพื้นฐาน: ${rollerPriceData.basePrice.toLocaleString()} บาท`,
                rollerGrinding: `${rollerPriceData.grindingPrice > 0 ? 
                    `Grinding price: ${rollerPriceData.grindingPrice.toLocaleString()} บาท` : 
                    'ไม่มี Grinding'}`,
                crd: `CRD ${crdPriceData.crdType}: ${(crdPriceData.basePrice/4).toLocaleString()} × 4 = ${crdPriceData.basePrice.toLocaleString()} บาท`,
                crdGrinding: `${crdPriceData.grindingPrice > 0 ? 
                    `Grinding price: ${crdPriceData.grindingPrice.toLocaleString()} บาท` : 
                    'ไม่มี Grinding'}`,
                shape: `Shape ${data.shapeMethod === 'inhouse' ? '(Inhouse)' : ''}: ${shapePriceData.basePrice.toLocaleString()} บาท`,
                cutting: `${data.hasCutting ? 
                    `Cutting tools: ${cuttingPrice.toLocaleString()} บาท` : 
                    'ไม่มีการตัด'}`,
                bending: `Bending (size: ${data.size}mm): ${bendingPrice.toLocaleString()} บาท`
            };

            const totalPrice = 
            rollerPriceData.basePrice +
            rollerPriceData.grindingPrice +
            crdPriceData.basePrice +
            crdPriceData.grindingPrice +
            shapePriceData.basePrice +
            cuttingPrice.total + // แก้จาก cuttingPrice เป็น cuttingPrice.total
            bendingPrice.price;  // แก้จาก bendingPrice เป็น bendingPrice.price

            // log ผลลัพธ์
            console.log('Calculation results:', {
                totalPrice,
                details: {
                    materialId,
                    calculations,
                    prices: {
                        roller: rollerPriceData.basePrice,
                        rollerGrinding: rollerPriceData.grindingPrice,
                        crd: crdPriceData.basePrice,
                        crdGrinding: crdPriceData.grindingPrice,
                        shape: shapePriceData.basePrice,
                        cutting: cuttingPrice,
                        bending: bendingPrice
                    }
                }
            });

            return {
                totalPrice,
                details: {
                    materialId,
                    rollerType: rollerPriceData.rollerType,
                    crdType: crdPriceData.crdType,
                    calculations: {
                        roller: rollerPriceData.details,
                        rollerGrinding: `Grinding Roller: ${rollerPriceData.grindingPrice.toLocaleString()} บาท`,
                        crd: `${crdPriceData.crdType}: ${(crdPriceData.basePrice/4).toLocaleString()} × 4 ชิ้น = ${crdPriceData.basePrice.toLocaleString()} บาท`,
                        crdGrinding: `Grinding CRD: ${crdPriceData.grindingPrice.toLocaleString()} บาท`,
                        shape: shapePriceData.details,
                        cutting: cuttingPrice.details,
                        bending: bendingPrice.details
                    },
                    prices: {
                        roller: rollerPriceData.basePrice,
                        rollerGrinding: rollerPriceData.grindingPrice,
                        crd: crdPriceData.basePrice,
                        crdGrinding: crdPriceData.grindingPrice,
                        shape: shapePriceData.basePrice,
                        cutting: cuttingPrice.total,
                        bending: bendingPrice.price
                    }
                }
            };
        } catch (error) {
            console.error('Error in calculateTotalPrice:', error);
            throw error;
        }
    }
}

module.exports = CalculationService;