const ProfileRepository = require('../data-access/profile.repository');

class ProfileService {
    constructor() {
        this.repository = new ProfileRepository();
    }

    // 1. Daily Production Data
    async getDailyProduction(date, machineCodePrefix = 'PRO') {
        try {
            console.log('Service: Fetching daily production data for date:', date, 'prefix:', machineCodePrefix);
            
            // Validate input
            if (!date) {
                throw new Error('Date parameter is required');
            }
            
            const data = await this.repository.getDailyProductionData(date, machineCodePrefix);
            
            if (!data || !Array.isArray(data)) {
                console.warn('No data or invalid data format returned from repository');
                return [];
            }
            
            // กรองข้อมูลและเพิ่มข้อมูล Cause
            const causeData = await this.repository.getCauseData(date, machineCodePrefix);
            console.log('Cause data loaded:', Object.keys(causeData).length, 'machine records');
            
            return this.processProductionData(data, causeData);
        } catch (error) {
            console.error('Error in getDailyProduction service:', error);
            throw new Error(`Failed to get daily production data: ${error.message}`);
        }
    }

    // 2.1 Causes Data
    async getCauseData(date, machineCodePrefix) {
        try {
            const data = await this.repository.getCauseData(date, machineCodePrefix);
            console.log(`Service: Fetching cause data for date: ${date}, prefix: ${machineCodePrefix}`);
        
            // Validate input
            if (!date) {
                throw new Error('Date parameter is required');
            }

            // ถ้า reporsitory ส่งข้อมูลที่จัดกลุ่มเป็นแล้วแปลงกลับเป็น array
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const result = [];
                Object.entries(data).forEach(([machineCode, causes]) => {
                    causes.forEach(cause => {
                        result.push({
                            MachineCode: machineCode,
                            Cause: cause.description,
                            Downtime: cause.downtime,
                            notes: cause.notes,
                            breakdownId: cause.breakdownId,
                            ID: cause.id
                        });
                    });
                });
                return result;
            }

            return data;            
        } catch (error) {
            console.error('Error in getCauseData service:', error);
            throw new Error(`Failed to get cause data: ${error.message}`);
        }
    }

    // 2.2 Update Causes
    async updateCauses(date, machineCode, docNo, problems, deletedProblems) {
        try {
            console.log('Service: Updating causes for machine:', machineCode, 'date:', date);

            // Validate input
            if (!date || !machineCode) {
                throw new Error('Date and machine code are required');
            }

            // Validate problems array
            if (problems && !Array.isArray(problems)) {
                throw new Error('Problems must be an array');
            }

            const result = await this.repository.updateCauses(
                date,
                machineCode,
                docNo,
                problems || [],
                deletedProblems || []
            );

            return {
                success: true,
                message: 'Causes update successfully',
                problems: result.updatedProblems || []
            };

        } catch (error) {
            console.error('Error in updateCauses service:', error);
            throw new Error(`Failed to update causes: ${error.message}`);
        }
    }

    // 3. Machine Details
    async getMachineDetails(machineCode, startDate, endDate) {
        try {
            const data = await this.repository.getMachineDetails(startDate, endDate, machineCode);
            
            // เพียงแค่ส่งข้อมูลกลับไปโดยตรง ไม่ต้องแปลงข้อมูลเพิ่มเติม
            return data;
            
            // หรือถ้าต้องการแปลงข้อมูลเล็กน้อย เช่นแปลงตัวเลขให้เป็น number จริงๆ
            // return Array.isArray(data) ? data.map(item => ({
            //     ...item,
            //     printWeight: parseFloat(item.printWeight) || 0,
            //     Plan: parseFloat(item.Plan) || 0,
            //     Downtime: parseFloat(item.Downtime) || 0
            // })) : [];
        } catch (error) {
            throw new Error(`Error in getMachineDetails: ${error.message}`);
        }
    }

    // 3. Chart Data
    async getChartData(startDate, endDate) {
        try {
            console.log('Fetching chart data for:', startDate, 'to', endDate);

            // validate input
            if (!startDate || endDate) {
                throw new Error('start date and end date are required')
            }

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

    // 4.1 Weekly Save All
    async saveWeeklyReportCorrections(data) {
        try {
            const result = await this.repository.saveWeeklyReportCorrections(data);
            return { success: true, data: result };
        } catch (error) {
            throw new Error(`Error saving weekly report corrections: ${error.message}`);
        }
    }

    // 4.2 Weekly Report data
    async getWeeklyReport(startDate, endDate) {
        try {
            const data = await this.repository.getWeeklyReportData(startDate, endDate);
            const savedReport = await this.repository.getSavedWeeklyReport(startDate, endDate);
            return this.processWeeklyReportData(data, savedReport);
        } catch (error) {
            throw new Error(`Error in getWeeklyReport: ${error.message}`);
        }
    }

    // 5.1 Plan Management
    async getPlanData(date, department) {
        try {
            console.log('Service: Fetching plan data for department:', department, 'date:', date);

            // Validate input
            if (!date) {
                throw new Error('Date parameter is required');
            }

            if (!department) {
                console.warn('Department not specified, using default');
                department = 'PRO';
            }

            const data = await this.repository.getPlanData(date, department);
            return data || [];
        } catch (error) {
            console.error('Error in getPlanData service:', error);
            throw new Error(`Failed to get plan data: ${error.message}`);
        }
    }

    // 5.2 Save Plan
    async savePlan(planData) {
        try {
            console.log('Service : Saving plan data:', planData);

            // Validate required
            if (!planData.docNo || !planData.machineCode || !planData.productionQuantity || !planData.date) {
                throw new Error('Missing required plan data fields');
            }


            await this.repository.addNewPlan(planData);
            return { success: true, message: 'Plan save successfully' };
        } catch (error) {
            console.error('Error in savePlan service:', error);
            throw new Error(`Error in savePlan: ${error.message}`);
        }
    }

    // 5.3 Update Plan
    async updatePlan(planNo, planData) {
        try {
            console.log('Service: Updating plan:', planNo, 'with data:', planData);
            
            // Validate required fields
            if (!planNo || !planData.machineCode || !planData.productionQuantity) {
                throw new Error('Missing required plan update fields');
            }
            
            await this.repository.updatePlan(planNo, planData);
            return { success: true, message: 'Plan updated successfully' };
        } catch (error) {
            console.error('Error in updatePlan service:', error);
            throw new Error(`Failed to update plan: ${error.message}`);
        }
    }

    // 5.4 Delete Plan
    async deletePlan(planNo) {
        try {
            console.log('Service: Deleting plan:', planNo);
            
            if (!planNo) {
                throw new Error('Plan number is required');
            }
            
            await this.repository.deletePlan(planNo);
            return { success: true, message: 'Plan deleted successfully' };
        } catch (error) {
            console.error('Error in deletePlan service:', error);
            throw new Error(`Failed to delete plan: ${error.message}`);
        }
    }

    // 6.1 Breakdown Causes data All
    async getBreakdownCauses() {
        try {
            console.log('Service: Fetching breakdown causes');
            const data = await this.repository.getBreakdownCauses();

            return data;
        } catch (error) {
            console.error('Error in getBreakdownCauses service:', error);
            throw new Error(`Failed to get breakdown causes: ${error.message}`);
        }
    }

    // 1. บันทึก causes ทั้งหมด
async saveAllCauses(data) {
    try {
        console.log('Service: Saving all causes, items:', data.length);
        
        // Validate input
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid or empty data provided');
        }
        
        const result = await this.repository.saveAllCauses(data);
        return { 
            success: true, 
            message: 'All Causes saved successfully', 
            data: result 
        };
    } catch (error) {
        console.error('Error in saveAllCauses service:', error);
        throw new Error(`Failed to save all causes: ${error.message}`);
    }
}

// 2. อัพเดทข้อมูล remark
async updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode) {
    try {
        console.log('Service: Updating remark for doc:', docNo, 'RSN:', rsnCode);
        
        // Validate input
        if (!docNo || !rsnCode) {
            throw new Error('DocNo and RSNCode are required');
        }
        
        const result = await this.repository.updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode);
        return result;
    } catch (error) {
        console.error('Error in updateRemark service:', error);
        throw new Error(`Failed to update remark: ${error.message}`);
    }
}

// 3. ลบแผนการผลิต
async deletePlan(planNo) {
    try {
        console.log('Service: Deleting plan:', planNo);
        
        if (!planNo) {
            throw new Error('Plan number is required');
        }
        
        await this.repository.deletePlan(planNo);
        return { success: true, message: 'Plan deleted successfully' };
    } catch (error) {
        console.error('Error in deletePlan service:', error);
        throw new Error(`Failed to delete plan: ${error.message}`);
    }
}

// 4. อัพเดทแผนการผลิต
async updatePlan(planNo, planData) {
    try {
        console.log('Service: Updating plan:', planNo, 'with data:', planData);
        
        // Validate required fields
        if (!planNo || !planData.machineCode || !planData.productionQuantity) {
            throw new Error('Missing required plan update fields');
        }
        
        await this.repository.updatePlan(planNo, planData);
        return { success: true, message: 'Plan updated successfully' };
    } catch (error) {
        console.error('Error in updatePlan service:', error);
        throw new Error(`Failed to update plan: ${error.message}`);
    }
}

    // Helper Methods
    processProductionData(data, causeData) {
        console.log('Processing production data, items:', data.length);
        
        return data.map(item => {
            // Standardize machine code format (remove suffixes like "-1")
            const baseMachineCode = item.MachineCode.split('-')[0];
            
            // Get causes for this machine
            const causes = causeData[baseMachineCode] || [];
            
            // Calculate total downtime
            const totalDowntime = causes.reduce(
                (sum, c) => sum + (parseFloat(c.downtime) || 0), 
                0
            );
            
            // Format and return the processed item
            return {
                ...item,
                MachineCode: baseMachineCode,
                Actual: parseFloat(item.Actual) || 0,
                Plan: parseFloat(item.Plan) || 0,
                Causes: causes,
                TotalDowntime: totalDowntime,
                PerformanceRatio: item.Plan > 0 ? 
                    ((parseFloat(item.Actual) || 0) / item.Plan) : 0
            };
        });
    }

    // processMachineDetails(data) {
    //     if (!Array.isArray(data)) {
    //         console.warn('Data is not an array:', data);
    //         return [];
    //     }
        
    //     return data.map(item => ({
    //         ...item,
    //         printWeight: parseFloat(item.printWeight) || 0,
    //         Plan: parseFloat(item.Plan) || 0,
    //         Downtime: parseFloat(item.Downtime) || 0
    //     }));
    // }

    processChartData(data) {
        console.log('Processing chart data, items:', data.length);
        
        return data.map(item => {
            const planQty = parseFloat(item.PlanQuantity) || 0;
            const actualQty = parseFloat(item.ActualQuantity) || 0;
            
            return {
                ...item,
                PlanQuantity: planQty,
                ActualQuantity: actualQty,
                Percentage: planQty > 0 ? (actualQty / planQty) * 100 : 0,
                MachineName: this.getMachineName(item.MachineCode)
            };
        });
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