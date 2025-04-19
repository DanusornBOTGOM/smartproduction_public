const ProductionDailyRepository = require("../data-access/production-daily.repository");
const ApprovalRepository = require("../data-access/approval.repository");

class ProductionDailyService {
    constructor() {
        this.repository = new ProductionDailyRepository();
    }

    // ดึงข้อมูลจาก RSNCode
    async getByRsnCode(rsnCode) {
        try {
            const record = await this.repository.getByRsnCode(rsnCode)
            return record;
        } catch (error) {
            console.error('Error in ProductionService - getByRsnCode:', error);
            throw error; 
        }
    }

    // บันทึกข้อมูลผลิต
    // async submitProductionData(productionData) {
    //     try {
    //         const result = await this.repository.submitProductionData(productionData)
    //         return result;
    //     } catch (error) {
    //         console.error('Error in ProductionService - submitProductionData:', error);
    //         throw error;
    //     }
    // }

    // บันทึกข้อมูลผลิต 2
    async submitProductionData(productionData, user) {
        try {
            // ตรวจสอบว่ามีการ login
            if (!user) {
                throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล')
            }

            const result = await this.repository.submitProductionData(productionData);
            
            // บึกทึกรายงาน
            const approvalRepository = new ApprovalRepository();
            await approvalRepository.approveRecord(
                result.recordId, // ID ของรายการที่เพิ่งบันทึก
                user.ID, // ID ของผู้ใช้
                0, // สถานะ 0 = รออนุมัติ
                'รายงานโดย ' + user.Username
            );
            
            return result;
        } catch (error) {
            console.error('Error in ProductionService - submitProductionData:', error);
            throw error;
        }
    }

    // บนทึกข้อมูลผลิตซ้ำ กรณี ต้มใหม่
    async submitDuplicateProductionData(productionData) {
        try {
            return await this.repository.submitDuplicateProductionData(productionData);
        } catch (error) {
            throw error;
        }
    }

    // ดึงประวัติการผลิต
    async getProductionRecords(date) {
        try {
            // ถ้าไม่ระบุวันที่ให้ใช้วันที่ปัจจุบัน
            if (!date) {
                const today = new Date();
                date = today.toISOString().split('T')[0]; // รูปแบบ YYYY-MM-DD
            }

            return await this.repository.getProductionRecords(date);
        } catch (error) {
            console.error('Error in ProductionService - getProductionRecords:', error);
            throw error;
        }
    }

    async updateTime(id, timeInManual, timeOutManual, timeInForm, timeOutForm) {
        try {
            const result = await this.repository.updateTime(id, timeInManual, timeOutManual, timeInForm, timeOutForm);
            return result;
        } catch (error) {
            console.error('Error in service updateTime:', error);
            throw error;
        }
    }

}

module.exports = ProductionDailyService; 