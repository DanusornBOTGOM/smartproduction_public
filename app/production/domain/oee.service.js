const OeeRepository = require('../data-access/oee.repository');

class OEEService {
    constructor() {
        this.repository = new OeeRepository();
    }

    // 1. Chart Data OEE All
// oee.service.js
async getOverallDepartmentOEE(startDate, endDate, department) {
    try {
        const data = await this.repository.getOverallDepartmentOEE(startDate, endDate, department);
        
        // Format daily metrics
        const dailyMetrics = data.map(item => ({
            MachineCode: item.MachineCode,
            OEE: Number(item.OEE),
            Availability: Number(item.Availability),
            Performance: Number(item.Performance),
            Quality: Number(item.Quality),
            Downtime: item.Downtime || 0
        }));

        // Calculate overall metrics
        const overall = {
            OEE: Number(this.calculateAverage(dailyMetrics, 'OEE')),
            Availability: Number(this.calculateAverage(dailyMetrics, 'Availability')),
            Performance: Number(this.calculateAverage(dailyMetrics, 'Performance')),
            Quality: Number(this.calculateAverage(dailyMetrics, 'Quality'))
        };

        return {
            overall,
            dailyMetrics
        };
    } catch (error) {
        console.error('Error in getOverallDepartmentOEE:', error);
        throw error;
    }
}

    calculateAverage(data, field) {
        if (!data || data.length === 0) return 0;
        const sum = data.reduce((acc, curr) => acc + parseFloat(curr[field] || 0), 0);
        return (sum / data.length).toFixed(2);
    }

    async getMachineDetails(startDate, endDate, department) {
        try {
            const data = await this.repository.getMachinePerformanceDetails(startDate, endDate, department);
            
            return data.map(machine => {
                const availability = this.calculateAvailability(machine.Downtime);
                const performance = this.calculatePerformance(machine.GoodQuantity, machine.PlannedQuantity);
                const quality = this.calculateQuality(machine.GoodQuantity, machine.NgQuantity);
                const oee = (availability * performance * quality) / 10000;
    
                return {
                    machineCode: machine.MachineCode,
                    oee: oee.toFixed(2),
                    availability: availability.toFixed(2),
                    performance: performance.toFixed(2),
                    quality: quality.toFixed(2),
                    downtime: machine.Downtime
                };
            });
        } catch (error) {
            console.error('Error in getMachineDetails:', error);
            throw error;
        }
    }

    async getDepartments() {
        return this.repository.getDepartments();
    }

}

module.exports = OEEService