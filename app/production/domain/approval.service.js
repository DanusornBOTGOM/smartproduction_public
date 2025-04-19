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
    async createProductionRecord(date, user) {
        try {
            // ตรวจสอบว่าผู้ใช้มีสิทธิบันทึกข้อมูลหรือไม่
            if (!this.permissionService.checkPermission(user, 'production', 'edit')) {
                throw new Error('ไม่มีสิทธิ์บันทึกข้อมูล');
            }

            return await this.repository.createProductionRecord(data, user.ID);
        } catch (error) {
            console.error('Error in ApprovalService - createProductionRecord:', error);
            throw error;
        }
    } 

    // บันทึกการอนุมัติ
    async approveRecord(recordId, user, status, comment) {
        try {
            // ตรวจสอบว่าผู้ใช้มีสิทธิ์อนุมัติหรือไม่
            if (!this.permissionService.hasApprovalPermission(user)) {
                throw new Error('ไม่มีสิทธิ์อนุมัติข้อมูล');
            }

            return await this.repository.approveRecord(recordId, user.ID, status, comment);
        } catch (error) {
            console.error('Error in ApprovalService - approveRecord:', error);
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