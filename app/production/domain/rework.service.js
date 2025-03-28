const ReworkRepository = require('../data-access/rework.repository');

class ReworkService {
    constructor() {
        this.repository = new ReworkRepository();
    }

    // ดึงข้อมูลจาก RSNCodeRef2
    async getByRsnCodeRef2(rsnCodeRef2) {
        try {
            const record = await this.repository.getByRsnCodeRef2(rsnCodeRef2);
            return record;
        } catch (error) {
            console.error('Error in ReworkService - getByRsnCodeRef2:', error);
            throw error;
        }
    }

    // บันทึกข้อมูล Rework
    async submitFormDataRework(formDataRework) {
        try {
            const result = await this.repository.submitFormDataRework(formDataRework);
            return result
        } catch (error) {
            console.error('Error in ReworkService - submitFormDataRework:', error);
            throw error;
        }
    }

    // ดึงประวัติ Rework Records
    async getReworkRecords() {
        try {
            const records = await this.repository.getReworkRecords();
            return records;
        } catch (error) {
            console.error('Error in ReworkService - getReworkRecords:', error);
            throw error;
        }
    }
    
    // ดึงข้อมูล WorkMachine
    async getWorkCenters() {
        try {
            const machines = await this.repository.getWorkCenters();
            return machines;
        } catch (error) {
            console.error('Error in ReworkService - getWorkCenters:', error);
            throw error;
        }
    }
}

module.exports = ReworkService;