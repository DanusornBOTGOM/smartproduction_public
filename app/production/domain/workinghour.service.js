const WorkingHourRepository = require('../data-access/workinghour.repository');

class WorkingHourService {
    constructor() {
        this.repository = new WorkingHourRepository();
    }

    async getOverallDepartmentWorking(startDate, endDate, department) {
        try {
            const data = await this.repository.getOverallDepartmentWorking(startDate, endDate, department);
            return data;
        } catch (error) {
            console.error('Error in getOverallDepartmentWorking service:', error);
            throw error;
        }
    }

    async getDepartments() {
        return this.repository.getDepartments();
    }

    // 2. workshift Machine
    async getMachines() {
        try {
            const machines = await this.repository.getMachines();

            return machines;
        } catch (error) {
            console.error('Error in getMachines service:', error);
            throw error;
        }
    }

    async getWorkshifts(machineCode, startDate, endDate) {
        try {
            const workshifts = await this.repository.getWorkshifts(machineCode, startDate, endDate);
            
            return workshifts;
        } catch (error) {
            console.error('Error in getWorkshifts service:', error);
            throw error;
        }
    }

    async getWorkshiftCalendarEvents(machineCode, startDate, endDate) {
        try {
            const events = await this.repository.getWorkshiftsCalendarEvents(machineCode, startDate, endDate);
    
            return events
        } catch (error) {
            console.error('Error in getWorkshiftCalendarEvent service:', error);
            throw error;
        }
    }

    async addWorkshift(workshiftData) {
        try {
            // ตรวจสอบข้อมูล
            this.validateWorkshiftData(workshiftData);

            const result = await this.repository.addWorkshift(workshiftData);

            return result;
        } catch (error) {
            console.error('Error in addWorkshift service:', error);
            throw error;
        }
    }

    async updateWorkshift(id, workshiftData) {
        try {
            // ตรวจสอบข้อมูล
            this.validateWorkshiftData(workshiftData);
    
            // ตรวจสอบว่ามีข้อมูลนี้อยู่หรือไม่
            const existingWorkshift = await this.repository.getWorkshiftById(id);
            if (!existingWorkshift) {
                throw new Error('ไม่พบข้อมูลเวลาทำงานที่ต้องการแก้ไข');
            }
    
            const result = await this.repository.updateWorkshift(id, workshiftData);
    
            return result;
        } catch (error) {
            console.error('Error in updateWorkshift service:', error);
            throw error;
        }
    }

    async deleteWorkshift(id) {
        try {
            // ตรวจสอบว่ามีข้อมูลไหม
            const existingWorkshift = await this.repository.getWorkshiftById(id);
            if (!existingWorkshift) {
                throw new Error('ไม่พบข้อมูลเวลาทำงานที่ต้องการลบ')
            }
    
            await this.repository.deleteWorkshift(id);
    
            return { success: true, message: 'ลบข้อมูลเรียบร้อยแล้ว' };
        } catch (error) {
            console.error('Error in deleteWorkshift service:', error);
            throw error;
        }
    }

    async getWorkshiftById(id) {
        try {
            const workshift = await this.repository.getWorkshiftById(id);
            return workshift;
        } catch (error) {
            console.error('Error in getWorkshiftById service:', error);
            throw error;
        }
    }
    
    validateWorkshiftData(data) {
        // ตรวจสอบว่ามีข้อมูลที่จำเป็นครบหรือไม่
        if (!data.machineCode) {
            throw new Error('กรุณาระบุรหัสประจำเครื่องจักร');
        }

        if (!data.workdate) {
            throw new Error('กรุณาระบุวันที่ทำงาน');
        }

        if (!data.shst || !data.shen) {
            throw new Error('กรุณาระบุเวลาเริ่มต้นและเวลาสิ้นสุด');
        }

        // ตรวจสอบว่าเวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น
        const shstDate = new Date(data.shst);
        const shenDate = new Date(data.shen);

        if (shenDate <= shstDate) {
            throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
        }
    }

}

module.exports = WorkingHourService;