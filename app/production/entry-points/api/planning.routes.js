// const express = require('express');
// const router = express.Router();

// // Import services
// const PlanningService = require('../../domain/planning/planning.service');
// const LeadTimeService = require('../../domain/planning/leadtime.service');
// const AlertService = require('../../domain/planning/alert.service');
// const MachineConfigService = require('../../domain/planning/machineconfig.service');
// const sql = require('mssql');

// // Create service instances
// const planningService = new PlanningService();
// const leadTimeService = new LeadTimeService();
// const alertService = new AlertService();
// const machineConfigService = new MachineConfigService();

// // ============ Planning Dashboard ============
// router.get('/dashboard', async (req, res) => {
//     try {
//         res.render('pages/backend/planning/dashboard', {
//             title: 'Planning Dashboard',
//             heading: 'Production Planning Dashboard',
//             layout: './layouts/backend',
//             showNavbar: true
//         });
//     } catch (error) {
//         console.error('Error rendering dashboard:', error);
//         res.status(500).send('Server Error');
//     }
// });

// // ============ Machine Planning Data ============
// router.get('/machine-capacity', async (req, res) => {
//     try {
//         const { startDate, endDate } = req.query;
        
//         if (!startDate || !endDate) {
//             return res.status(400).json({ 
//                 error: 'Bad Request', 
//                 message: 'Start and end dates are required' 
//             });
//         }
        
//         const data = await planningService.getMachineCapacityData(startDate, endDate);
//         res.json(data);
//     } catch (error) {
//         console.error('Error in machine capacity API:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // ============ Lead Time Management ============
// router.get('/lead-time/:mfgId', async (req, res) => {
//     try {
//         const { mfgId } = req.params;
//         const leadTime = await leadTimeService.getLeadTimeForMfg(mfgId);
//         res.json(leadTime);
//     } catch (error) {
//         console.error('Error fetching lead time:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// router.post('/lead-time/calculate', async (req, res) => {
//     try {
//         const { mfgId, productId, grade, size } = req.body;
        
//         if (!mfgId || !productId) {
//             return res.status(400).json({ 
//                 error: 'Bad Request', 
//                 message: 'MFG ID and Product ID are required' 
//             });
//         }
        
//         const leadTime = await leadTimeService.calculateLeadTime(mfgId, productId, grade, size);
//         res.json(leadTime);
//     } catch (error) {
//         console.error('Error calculating lead time:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // ============ Alert System ============
// router.get('/alerts', async (req, res) => {
//     try {
//         const { status } = req.query;
//         const alerts = await alertService.getAlerts(status);
//         res.json(alerts);
//     } catch (error) {
//         console.error('Error fetching alerts:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// router.post('/alerts/acknowledge/:alertId', async (req, res) => {
//     try {
//         const { alertId } = req.params;
//         const { action, notes } = req.body;
        
//         if (!action) {
//             return res.status(400).json({ 
//                 error: 'Bad Request', 
//                 message: 'Action is required' 
//             });
//         }
        
//         const result = await alertService.acknowledgeAlert(alertId, action, notes);
//         res.json(result);
//     } catch (error) {
//         console.error('Error acknowledging alert:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // ============ Configuration ============
// // OT Configuration
// router.get('/config/overtime', async (req, res) => {
//     try {
//         const { startDate, endDate } = req.query;
//         const overtime = await machineConfigService.getOvertimeSchedule(startDate, endDate);
//         res.json(overtime);
//     } catch (error) {
//         console.error('Error fetching overtime:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// router.post('/config/overtime', async (req, res) => {
//     try {
//         const { date, machineCode, hours } = req.body;
        
//         if (!date || !machineCode || hours === undefined) {
//             return res.status(400).json({ 
//                 error: 'Bad Request', 
//                 message: 'Date, machine code, and hours are required' 
//             });
//         }
        
//         const result = await machineConfigService.scheduleOvertime(date, machineCode, hours);
//         res.json(result);
//     } catch (error) {
//         console.error('Error scheduling overtime:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // ============ Monitoring Board ============
// router.get('/monitor', async (req, res) => {
//     try {
//         res.render('pages/backend/planning/monitor', {
//             title: 'Production Monitor Board',
//             heading: 'Production Status Board',
//             layout: './layouts/backend',
//             showNavbar: true
//         });
//     } catch (error) {
//         console.error('Error rendering monitor board:', error);
//         res.status(500).send('Server Error');
//     }
// });

// router.get('/monitor/data', async (req, res) => {
//     try {
//         const monitorData = await planningService.getMonitoringData();
//         res.json(monitorData);
//     } catch (error) {
//         console.error('Error fetching monitoring data:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// module.exports = router;
