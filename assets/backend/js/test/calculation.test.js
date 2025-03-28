const { expect } = require('chai');
const CalculationService = require('../services/calculation.service');

describe('CalculationService', () => {
    let calculationService;
    let mockDb;

    beforeEach(() => {
        mockDb = {
            request: () => ({
                input: () => mockDb.request(),
                query: async (sql) => {
                    // Mock response ตามแต่ละ query
                    return {
                        recordset: [{
                            OfferPrice: 1000,
                            GrindingLapODPrice: 500,
                            RollerType: 'Turkhead 180'
                        }]
                    };
                }
            })
        };
        calculationService = new CalculationService(mockDb);
    });

    describe('calculateRollerPrice', () => {
        it('should calculate correct roller price with grinding', async () => {
            const result = await calculationService.calculateRollerPrice(2, 3.5, true);
            expect(result.basePrice).to.equal(1000);
            expect(result.grindingPrice).to.equal(500);
            expect(result.rollerType).to.equal('Turkhead 180');
        });
    });

    // เพิ่ม test cases อื่นๆ ตามต้องการ
});