// // leadtime.service.js
// const LeadTimeRepository = require('../../data-access/planning/planning.repository');

// class LeadTimeService {
//     constructor() {
//         this.repository = new LeadTimeRepository();
//     }

//     async getLeadTimeForMfg(mfgId) {
//         try {
//             // Get the basic lead time data for this MFG
//             const leadTimeData = await this.repository.getLeadTimeForMfg(mfgId);
            
//             if (!leadTimeData) {
//                 throw new Error(`No lead time data found for MFG: ${mfgId}`);
//             }
            
//             // Get product details to factor in product-specific adjustments
//             const productDetails = await this.repository.getProductDetails(leadTimeData.productId);
            
//             // Calculate the adjusted lead time
//             const adjustedLeadTime = this.calculateAdjustedLeadTime(leadTimeData, productDetails);
            
//             return adjustedLeadTime;
//         } catch (error) {
//             console.error('Error in getLeadTimeForMfg service:', error);
//             throw new Error(`Failed to get lead time for MFG: ${error.message}`);
//         }
//     }

//     async calculateLeadTime(mfgId, productId, grade, size) {
//         try {
//             // Get base lead time data
//             const baseLeadTime = await this.repository.getBaseLeadTime(productId);
            
//             if (!baseLeadTime) {
//                 throw new Error(`No base lead time found for product: ${productId}`);
//             }
            
//             // Get machine configurations
//             const machineConfigs = await this.repository.getMachineConfigurations();
            
//             // Get product-specific factors
//             const productFactors = await this.repository.getProductFactors(productId, grade, size);
            
//             // Calculate lead time for each production stage
//             const stages = baseLeadTime.stages.map(stage => {
//                 // Find the machine for this stage
//                 const machine = machineConfigs.find(m => m.stationCode === stage.stationCode);
                
//                 // Calculate adjusted processing time
//                 let processingTime = stage.baseProcessingTime;
                
//                 // Apply grade and size adjustments if available
//                 if (productFactors && productFactors.gradeFactors) {
//                     processingTime *= productFactors.gradeFactors[grade] || 1;
//                 }
                
//                 if (productFactors && productFactors.sizeFactors) {
//                     const sizeNumber = parseFloat(size);
                    
//                     // Apply size adjustments based on ranges
//                     for (const range of productFactors.sizeFactors) {
//                         if (sizeNumber >= range.min && sizeNumber <= range.max) {
//                             processingTime *= range.factor;
//                             break;
//                         }
//                     }
//                 }
                
//                 // Consider machine-specific adjustments
//                 if (machine && machine.efficiencyFactor) {
//                     processingTime /= machine.efficiencyFactor;
//                 }
                
//                 return {
//                     ...stage,
//                     adjustedProcessingTime: processingTime
//                 };
//             });
            
//             // Calculate total lead time in days
//             const totalDays = stages.reduce((total, stage) => total + stage.adjustedProcessingTime, 0);
            
//             // Save the calculated lead time
//             await this.repository.saveLeadTime(mfgId, productId, {
//                 stages,
//                 totalDays: Math.ceil(totalDays),
//                 grade,
//                 size
//             });
            
//             return {
//                 mfgId,
//                 productId,
//                 grade,
//                 size,
//                 stages,
//                 totalDays: Math.ceil(totalDays)
//             };
//         } catch (error) {
//             console.error('Error in calculateLeadTime service:', error);
//             throw new Error(`Failed to calculate lead time: ${error.message}`);
//         }
//     }

//     calculateAdjustedLeadTime(leadTimeData, productDetails) {
//         // Start with the base lead time
//         let adjustedLeadTime = { ...leadTimeData };
        
//         // Factor in current workload
//         if (productDetails.currentWorkload > 0) {
//             const workloadFactor = 1 + (productDetails.currentWorkload / 100);
//             adjustedLeadTime.totalDays *= workloadFactor;
//         }
        
//         // Apply priority adjustments
//         if (productDetails.priority === 'high') {
//             adjustedLeadTime.totalDays *= 0.9; // 10% reduction for high priority
//         } else if (productDetails.priority === 'low') {
//             adjustedLeadTime.totalDays *= 1.1; // 10% increase for low priority
//         }
        
//         // Consider complexity
//         if (productDetails.complexity === 'high') {
//             adjustedLeadTime.totalDays *= 1.2; // 20% increase for high complexity
//         } else if (productDetails.complexity === 'low') {
//             adjustedLeadTime.totalDays *= 0.9; // 10% reduction for low complexity
//         }
        
//         // Ensure we round up to whole days
//         adjustedLeadTime.totalDays = Math.ceil(adjustedLeadTime.totalDays);
        
//         return adjustedLeadTime;
//     }
// }

// module.exports = LeadTimeService;