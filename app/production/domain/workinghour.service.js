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
}

module.exports = WorkingHourService;