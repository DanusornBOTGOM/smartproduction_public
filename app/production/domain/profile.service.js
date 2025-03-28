const ProfileRepository = require('../data-access/profile.repository');

class ProfileService {
    constructor() {
        this.repository = new ProfileRepository();
    }

    // 1. Daily Production Data
    async getDailyProduction(date, machineCodePrefix) {
        try {
            console.log('Fetching data for date:', date, 'prefix:', machineCodePrefix);
            const data = await this.repository.getDailyProductionData(date, machineCodePrefix);
            const causeData = await this.repository.getCauseData(date);
            
            console.log('Raw data:', data);  // debug log
            console.log('Cause data:', causeData);  // debug log
    
            if (!Array.isArray(data)) {
                console.error('Data is not an array:', data);
                return [];
            }
    
            return this.processProductionData(data, causeData);
        } catch (error) {
            console.error('Error in getDailyProduction:', error);
            throw new Error(`Error in getDailyProduction: ${error.message}`);
        }
    }

    // 2. Machine Details
    async getMachineDetails(machineCode, startDate, endDate) {
        try {
            const data = await this.repository.getMachineDetails(startDate, endDate, machineCode);
            return this.processMachineDetails(data);
        } catch (error) {
            throw new Error(`Error in getMachineDetails: ${error.message}`);
        }
    }

    // 3. Chart Data
    async getChartData(startDate, endDate) {
        try {
            console.log('Fetching chart data for:', startDate, 'to', endDate);
            const data = await this.repository.getChartData(startDate, endDate);
            
            console.log('Raw chart data:', data);  // debug log
    
            if (!Array.isArray(data)) {
                console.error('Chart data is not an array:', data);
                return [];
            }
    
            return this.processChartData(data);
        } catch (error) {
            console.error('Error in getChartData:', error);
            throw new Error(`Error in getChartData: ${error.message}`);
        }
    }

    async saveWeeklyReportCorrections(data) {
        try {
            const result = await this.repository.saveWeeklyReportCorrections(data);
            return { success: true, data: result };
        } catch (error) {
            throw new Error(`Error saving weekly report corrections: ${error.message}`);
        }
    }

    // 4. Weekly Report
    async getWeeklyReport(startDate, endDate) {
        try {
            const data = await this.repository.getWeeklyReportData(startDate, endDate);
            const savedReport = await this.repository.getSavedWeeklyReport(startDate, endDate);
            return this.processWeeklyReportData(data, savedReport);
        } catch (error) {
            throw new Error(`Error in getWeeklyReport: ${error.message}`);
        }
    }

    // 5. Plan Management
    async getPlanData(date, department) {
        try {
            return await this.repository.getPlanData(date, department);
        } catch (error) {
            throw new Error(`Error in getPlanData: ${error.message}`);
        }
    }

    async savePlan(planData) {
        try {
            const result = await this.repository.addNewPlan(planData);
            return { success: true, data: result };
        } catch (error) {
            throw new Error(`Error in savePlan: ${error.message}`);
        }
    }

    async updatePlan(planNo, planData) {
        try {
            await this.repository.updatePlan(planNo, planData);
            return { success: true };
        } catch (error) {
            throw new Error(`Error in updatePlan: ${error.message}`);
        }
    }

    async deletePlan(planNo) {
        try {
            await this.repository.deletePlan(planNo);
            return { success: true };
        } catch (error) {
            throw new Error(`Error in deletePlan: ${error.message}`);
        }
    }

    // Helper Methods
    processProductionData(data, causeData) {
        return data.map(item => {
            const baseMachineCode = item.MachineCode.split('-')[0];
            const causes = causeData[baseMachineCode] || [];
            
            return {
                ...item,
                MachineCode: baseMachineCode,
                Actual: parseFloat(item.Actual) || 0,
                Plan: parseFloat(item.Plan) || 0,
                Causes: causes,
                TotalDowntime: causes.reduce((sum, c) => sum + (parseFloat(c.downtime) || 0), 0)
            };
        });
    }

    processMachineDetails(data) {
        return data.map(item => ({
            ...item,
            printWeight: parseFloat(item.printWeight) || 0,
            Plan: parseFloat(item.Plan) || 0,
            Downtime: parseFloat(item.Downtime) || 0
        }));
    }

    processChartData(data) {
        return data.map(item => ({
            ...item,
            PlanQuantity: parseFloat(item.PlanQuantity) || 0,
            ActualQuantity: parseFloat(item.ActualQuantity) || 0,
            Percentage: this.calculatePercentage(item.ActualQuantity, item.PlanQuantity)
        }));
    }

    processWeeklyReportData(data, savedReport) {
        return data.map(item => ({
            ...item,
            PreventiveCorrection: savedReport.find(s => s.MachineCode === item.MachineCode)?.PreventiveCorrection || '',
            CumulativePOP: this.calculatePercentage(item.TotalWIPWeight, item.TotalPlan)
        }));
    }

    calculatePercentage(actual, plan) {
        return plan > 0 ? (actual / plan) * 100 : 0;
    }
}

module.exports = ProfileService;