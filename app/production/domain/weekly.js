const WeeklyRepository = require('../data-access/weekly');

class WeeklyService {
    constructor() {
        this.repository = new WeeklyRepository();
    }

    async getWeeklyReport(startDate, endDate) {
        try {
            const data = await this.repository.getWeeklyReportData(startDate, endDate);
            const savedReport = await this.repository.getSavedWeeklyReport(startDate, endDate);
            return this.processWeeklyReportData(data, savedReport);
        } catch (error) {
            throw new Error(`Error in getWeeklyReport: ${error.message}`);
        }
    }

    async saveWeeklyReportCorrections(data) {
        try {
            return await this.repository.saveWeeklyReportCorrections(data);
        } catch (error) {
            throw new Error(`Error saving weekly report corrections: ${error.message}`);
        }
    }

    processWeeklyReportData(data, savedReport) {
        // ต้องเช็คว่า data เป็น array หรือไม่
        if (!Array.isArray(data)) {
            // ถ้า data เป็น recordset จาก SQL
            data = data.recordset;
        }
    
        return data
            .filter(item => item.MachineCode.startsWith('PRO'))
            .map(item => {
                const baseMachineCode = item.MachineCode.split('-')[0];
                const saved = savedReport.find(s => s.MachineCode === baseMachineCode);
                
                return {
                    MachineCode: baseMachineCode,
                    Actual: item.TotalWIPWeight,  
                    ProductionQuantity: item.TotalPlan,
                    CumulativePOP: item.CumulativePOP,
                    Issues: item.Issues || 'ไม่มีปัญหา',
                    TotalDowntime: item.TotalDowntime || 0,
                    PreventiveCorrection: saved?.PreventiveCorrection || ''
                };
            })
            .sort((a, b) => {
                const numA = parseInt(a.MachineCode.replace('PRO', ''));  
                const numB = parseInt(b.MachineCode.replace('PRO', '')); 
                return numA - numB;
            });
    }

    calculateCumulativePOP(item) {
        return item.TotalPlan > 0 ? (item.TotalWIPWeight / item.TotalPlan) * 100 : 0;
    }
}

module.exports = WeeklyService;