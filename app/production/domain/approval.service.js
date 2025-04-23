const ApprovalRepository = require("../data-access/approval.repository");
const PermissionService = require("../../auth/services/permission.service");

class ApprovalService {
    constructor() {
        this.repository = new ApprovalRepository();
        this.permissionService = PermissionService;
    }

    // ดึงรายการที่รออนุมัติ
    async getPendingApprovals(date) {
        try {
            return await this.repository.getPendingApprovals(date);

        } catch (error) {
            console.error('Error in ApprovalService - getPendingApprovals:', error);
            throw error;
        }
    }

    // บันทึกรายงานการผลิต
    async createProductionRecord(productionData, user) {
        try {
            // ตรวจสอบว่าผู้ใช้มีสิทธิบันทึกข้อมูลหรือไม่
            if (!this.permissionService.checkPermission(user, 'production', 'edit')) {
                throw new Error('ไม่มีสิทธิ์บันทึกข้อมูล');
            }

            return await this.repository.createProductionRecord(productionData, user.ID);
        } catch (error) {
            console.error('Error in ApprovalService - createProductionRecord:', error);
            throw error;
        }
    } 

    // บันทึกการอนุมัติ
    async approveRecord(recordId, user, status, comment) {
        try {
            // ตรวจสอบสิทธิ์ผ่าน middleware แล้ว
            // แยก userId จาก user object
            const userId = user.id;
            
            // ตรวจสอบว่า userId มีค่า
            if (!userId) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }
    
            // ส่งเฉพาะ userId (ไม่ใช่ object ทั้งก้อน) ไปยัง repository
            return await this.repository.approveRecord(recordId, userId, status, comment);
        } catch (error) {
            console.error('Error in ApprovalService - approveRecord:', error);
            throw error;
        }
    }

    // อนุมัติรายการทั้งหมดของวันที่ระบุ
    async approveAllRecords(date, approveId, status, comment) {
        try {
            const pendingRecords = await this.repository.getPendingApprovals(date);

            if (pendingRecords.length === 0) {
                return { count: 0 };
            }

            // อนุมัติทีละรายการ
            let successCount = 0;
            for (const record of pendingRecords) {
                try {
                    await this.repository.approveRecord(recordId, approvalId, status, comment);
                    successCount++;

                } catch (error) {
                    console.error(`Error approving record ${record.ID}:`, error);
                    // ดำเนินการต่อกับรายการถัดไป
                }
            }

            return { count: successCount }
        } catch (error) {
            console.error('Error in ApprovalService - approveAllRecord:', error);
            throw error;
        }
    }

    // ดึงประวัติการอนุมัติ
    async getApprovalHistory(date) {
        try {
            return await this.repository.getApprovalHistory(date);

        } catch (error) {
            console.error('Error in ApprovalService - getApprovalHistory:', error);
            throw error;
        }
    }
}

module.exports = ApprovalService;