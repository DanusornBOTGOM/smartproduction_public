// const PlanningRepository = require('../../data-access/planning/planning.repository');

// class PlanningService {
//     constructor() {
//         this.repository = new PlanningRepository();
//     }

//     async getMachineCapacityData(startDate, endDate) {
//         try {
//             console.log(`Fetching machine capacity data from ${startDate} to ${endDate}`);
//             const data = await this.repository.getMachineCapacityData(startDate, endDate);

//             // Process the data to calculate available capacity
//             const processedData = data.map(machine => {
//                 // Calculate total scheduled time
//                 const scheduledTime = machine.scheduledJobs.reduce(
//                     (total, job) => total + job.estimatedHours, 0
//                 );

//                 // Calculate available hours (considering OT)
//                 const regularHours = machine.regularHours || 8;
//                 const overtimeHours = machine.overtimeHours || 0;
//                 const totalAvailableHours = regularHours + overtimeHours;
                
//                 // Calculate utilization percentage
//                 const utilizationPercentage = Math.min(
//                     (scheduledTime / totalAvailableHours) * 100,
//                     100
//                 );

//                 return {
//                     ...machine,
//                     scheduledTime,
//                     totalAvailableHours: totalAvailableHours,
//                     utilizationPercentage
//                 };
//             });

//             return processedData;
//         } catch (error) {
//             console.error('Error in getMachineCapacityData service:', error);
//             throw new Error(`Failed to get machine capacity: ${error.message}`);
//         }
//     }

//     async getHighMarginProducts() {
//         try {
//             return await this.repository.getHighMarginProducts();
//         } catch (error) {
//             console.error('Error in getHighMarginProducts service:', error);
//             throw new Error(`Failed to get high margin products: ${error.message}`);
//         }
//     }

//     async verifyProductionSchedule(mfgId, deliveryDate, machines) {
//         try {
//             // Get current lead time for the MFG
//             const currentLeadTime = await this.repository.getLeadTimeForMfg(mfgId);
            
//             // Get production
//             const productionStatus = await this.repository.getProductionStatus(mfgId);

//             // Calculate estimated completion based on current status
//             const estimatedCompletion = this.calculateEstimated(
//                 productionStatus,
//                 currentLeadTime,
//                 machines
//             );

//             // Compare with delivery date
//             const deliveryDateObj = new Date(deliveryDate);
//             const estimatedCompletionObj = new Date(estimatedCompletion);
            
//             const isOnSchedule = estimatedCompletionObj <= deliveryDateObj;
//             const daysVariance = Math.ceil(
//                 (estimatedCompletionObj - deliveryDateObj) / (1000 * 60 * 60 * 24)
//             );

//             return {
//                 mfgId,
//                 deliveryDate,
//                 estimatedCompletion,
//                 isOnSchedule,
//                 daysVariance,
//                 currentLeadTime,
//                 productionStatus
//             };

//         } catch (error) {
//             console.error('Error in verifyProductionSchedule service:', error);
//             throw new Error(`Failed to verify production schedule: ${error.message}`);
//         }
//     }

//     estimatedCompletion(productionStatus, leadTime, machines) {
//         // Calculate completion time based on production status
//         // This is a simplified version - the actual implementation would be more complex
//         let estimatedDays = leadTime.totalDays;
        
//         // Adjust based on current stage
//         if (productionStatus.currentStage) {
//             // Calculate how much of the lead time has been consumed
//             const completedStages = productionStatus.completedStages || [];
//             const totalStages = leadTime.stages.length;

//             // Find how many stages are completed
//             const completedPercentage = completedStages.length / totalStages;

//             // Adjust estimated days based on completion percentage
//             estimatedDays = leadTime.totalDays * (1 - completedPercentage);

//             // Add extra time if any delays in current stage
//             if (productionStatus.currentStageDelays) {
//                 estimatedDays += productionStatus.currentStageDelays;
//             }
//         }

//         // Account for machine maintenance
//         if (machines && machines.length > 0) {
//             const unavailableMachines = machines.filter(m => 
//                 m.maintenance || m.breakdown
//             );

//             if (unavailableMachines.length > 0) {
//                 // Add delay based on unavailable machines
//                 estimatedDays += Math.max(
//                     ...unavailableMachines.map(m => m.estimatedDowntimeDays || 1)
//                 );
//             }
//         }

//         // Calculate the estimated
//         const currentDate = new Date();
//         const estimatedCompletionDate = new Date(currentDate);
//         estimatedCompletionDate.setDate(currentDate.getDate() + Math.ceil(estimatedDays));

//         return estimatedCompletionDate.toISOString().split('T')[0];
//     }

//     async getMonitoringData() {
//         try {
//             // Get production monitoring data
//             const monitoringData = await this.repository.getProductionMonitoringData();
            
//             // Process data for the monitoring board
//             const processedData = monitoringData.map(item => {
//                 // Determine the status
//                 let status = 'On Schedule';
//                 let alert = null;

//                 if (item.estimatedCompletion > item.deliveryDate) {
//                     const daysDifference = Math.ceil(
//                         (new Date(item.estimatedCompletion) - new Date(item.deliveryDate)) /
//                         (1000 * 60 *60 * 24)
//                     );

//                     status = 'Delayed';
//                     alert = {
//                         severity: daysDifference > 3 ? 'High' : 'Medium',
//                         message: `Estimated ${daysDifference} days delays`,
//                         suggestedActions: this.getSuggestedActions(item, daysDifference)
//                     };
//                 }

//                 // For items not started yet but have tight schedules
//                 if (!item.hasStarted && item.leadTimeDays >= this.calculateRemainingDays(item.deliveryDate)) {
//                     status = 'At Risk';
//                     alert = {
//                         severity: 'Medium',
//                         message: 'Tight schedule, may need priority',
//                         suggestedActions: ['Prioritize this order', 'Check machine availability']
//                     };
//                 }

//                 return {
//                     ...item,
//                     status,
//                     alert
//                 };
//             });

//             return processedData;
//         } catch (error) {
//             console.error('Error in getMonitoringData service:', error);
//             throw new Error(`Failed to get monitoring data: ${error.message}`);
//         }
//     }

//     calculateRemainingDays(deliveryDate) {
//         const today = new Date();
//         const delivery = new Date(deliveryDate);
//         return Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
//     }

//     getSuggestedActions(item, delayDays) {
//         const actions = [];
        
//         // Basic suggestions
//         if (delayDays > 3) {
//             actions.push('Schedule overtime');
//             actions.push('Review production priority');
//             actions.push('Consider re-allocating machines');
//         }
        
//         // Additional suggestions based on margin
//         if (item.isHighMargin) {
//             actions.push('Prioritize over lower margin products');
//         } else {
//             actions.push('Check if low-margin order can be rescheduled');
//         }
        
//         // Machine-specific suggestions
//         if (item.machineUtilization > 90) {
//             actions.push('Check for alternative machines');
//         }
        
//         return actions;
//     }
// }

// module.exports = PlanningService;