// app/production/api/production.routes.js
const express = require('express');
const router = express.Router();

// Service
const WeeklyService = require('../../domain/weekly');
const ProfileService = require('../../domain/profile.service');
const OEEService = require('../../domain/oee.service');
const WorkingHourService = require('../../domain/workinghour.service')
// ReworkData
const ReworkService = require('../../domain/rework.service');
// DailyReports
const ProductionDailyService = require('../../domain/production-daily.service')
// Sensor
// const SensorService = require('../../domain/senser.service')

const weeklyService = new WeeklyService();
const profileService = new ProfileService();
const oeeService = new OEEService();
const workingHourService = new WorkingHourService();
//const sensorService = new SensorService();


// ============ Routes Share ============
// Weekly Report routes
router.get('/weekly-report', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await weeklyService.getWeeklyReport(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/weekly-report/corrections', async (req, res) => {
    try {
        const result = await weeklyService.saveWeeklyReportCorrections(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ OEE All Department Routes ============
// OEE Department Dashboard
router.get('/oee/dashboard', async (req, res) => {
    try {
        const departments = await oeeService.getDepartments();
        res.render('pages/backend/production/oee/index', {
            title: 'OEE Department Dashboard',
            heading: 'OEE Department Overview',
            layout: './layouts/backend',
            showNavbar: true,
            departments
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// API สำหรับข้อมูล OEE Department
router.get('/oee/dashboard/data', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        console.log('Received request with params:', { startDate, endDate, department });

        const oeeService = new OEEService();
        const data = await oeeService.getOverallDepartmentOEE(startDate, endDate, department);
        
        console.log('Service returned data:', data);
        res.json(data);
    } catch (error) {
        console.error('Error in OEE dashboard route:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
});

router.get('/oee/departments', async (req, res) => {
    try {
        const oeeService = new OEEService();
        const departments = await oeeService.getDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/oee/machine-details', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        const oeeService = new OEEService();
        const details = await oeeService.getMachineDetails(startDate, endDate, department);
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// OEE Department Working Hour
router.get('/working-hour', async (req, res) => {
    try {
        res.render('pages/backend/production/working-hour/index', {
            title: 'WorkingHour',
            heading: 'WorkingHour',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// API สำหรับข้อมูล WorkingHour
router.get('/working-hour/data', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        console.log('Received params:', { startDate, endDate, department });

        const workingHourService = new WorkingHourService();
        const data = await workingHourService.getOverallDepartmentWorking(startDate, endDate, department);
        
        // ส่งข้อมูลกลับในรูปแบบ array
        res.json(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error('Error in working-hour data API:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
});


// ============ Profile Department Routes ============
// Profile Dashboard
router.get('/profile/dashboard', async (req, res) => {
    try {
        res.render('pages/backend/production/profile/index', {
            title: 'Profile Production Dashboard',
            heading: 'Profile Production Dashboard',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// API สำหรับข้อมูล Daily Production
router.get('/profile/daily', async (req, res) => {
    try {
        const { date, machineCodePrefix } = req.query;
        const data = await profileService.getDailyProduction(date, machineCodePrefix);
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับข้อมูล Chart
router.get('/profile/chart', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await profileService.getChartData(startDate, endDate);
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับข้อมูล Machine Details
router.get('/profile/machine-details', async (req, res) => {
    try {
        const { machineCode, startDate, endDate } = req.query;
        const data = await profileService.getMachineDetails(machineCode, startDate, endDate);
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับ Plan Management
router.get('/profile/plan', async (req, res) => {
    try {
        const { date, department } = req.query;
        const data = await profileService.getPlanData(date, department);
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับบันทึก Plan
router.post('/profile/plan', async (req, res) => {
    try {
        const result = await profileService.savePlan(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับอัพเดต Plan
router.put('/profile/plan/:planNo', async (req, res) => {
    try {
        const result = await profileService.updatePlan(req.params.planNo, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับลบ Plan
router.delete('/profile/plan/:planNo', async (req, res) => {
    try {
        const result = await profileService.deletePlan(req.params.planNo);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// // ============ BAR2 Department Routes ============
// // BAR2 Dashboard
// router.get('/bar2/dashboard', async (req, res) => {
//     try {
//         res.render('pages/backend/production/bar2/index', {
//             title: 'BAR2 Production Dashboard',
//             heading: 'BAR2 Production Dashboard',
//             layout: './layouts/backend',
//             showNavbar: true
//         });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).send('Server Error');
//     }
// })

// // API สำหรับข้อมูล Daily Production
// router.get('/bar2/daily', async (req, res) => {
//     try {
//         const { date, machineCodePrefix } = req.query;
//         const data = await bar2Service.getDailyProduction(date, machineCodePrefix);
//         res.json(data);
//     } catch (error) {
//         console.error('Error', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับข้อมูล Chart
// router.get('/bar2/chart', async (req, res) => {
//     try {
//         const { startDate, endDate } = req.query;
//         const data = await bar2Service.getChartData(startDate, endDate);
//         res.json(data);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับข้อมูล Machine Details
// router.get('/bar2/machine-details', async (req, res) => {
//     try {
//         const { machineCode, startDate, endDate } = req.query;
//         const data = await bar2Service.getMachineDetails(machineCode, startDate, endDate);
//         res.json(data);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับ Plan Management
// router.get('/bar2/plan', async (req, res) => {
//     try {
//         const { date, department } = req.query;
//         const data = await bar2Service.getPlanData(date, department);
//         res.json(data);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับบันทึก Plan
// router.post('/bar2/plan', async (req, res) => {
//     try {
//         const result = await bar2Service.savePlan(req.body);
//         res.json(result);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับอัพเดท Plan
// router.put('/bar2/plan/:planNo', async (req, res) => {
//     try {
//         const result = await bar2Service.updatePlan(req.params.planNo, req.body);
//         res.json(result);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // API สำหรับลบ Plan
// router.delete('/bar2/plan/:planNo', async (req, res) => {
//     try {
//         const result = await bar2Service.deletePlan(req.params.planNo);
//         res.json(result);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// ============ Routes ProductionTracking ============
// 1. แสดงหน้าฟอร์มบันทึกการผลิต
router.get('/reports/daily', async (req, res) => {
    try {
        res.render('pages/backend/production/reports/daily-form', {
            title: 'Form Production',
            heading: 'Form Production',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
})

// 2. API ดึงข้อมูลจาก RSNCode
router.get('/reports/data-daily', async (req, res) => {
    try {
        const { rsnCode } = req.query;
        console.log('Received request with params:', rsnCode);

        const productionDailyService = new ProductionDailyService();
        const records = await productionDailyService.getByRsnCode(rsnCode);

        res.json(records);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
})

// 3. API บันทึกข้อมูล
router.post('/reports/daily-submit', async (req, res) => {
    try {
        const productionDailyService = new ProductionDailyService();

        const result = await productionDailyService.submitProductionData(req.body)

        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
})

// 3.2 API บันทึกข้อมูลซ้ำ กรณี ต้มซ้ำ
router.post('/reports/daily-submit-duplicate', async (req, res) => {
    try {
        const productionDailyService = new ProductionDailyService();
        const result = await productionDailyService.submitDuplicateProductionData(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
})

// 4. แสดงหน้าตารางบันทึกข้อมูล
router.get('/reports/records', async (req, res) => {
    try {
        res.render('pages/backend/production/reports/daily-records', {
            title: 'Production Report',
            heading: 'Coating Report',
            layout: './layouts/backend',
            showNavbar: true
        })
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
})

// 5. API ดึงข้อมูลแสดงหน้า Production Report
router.get('/reports/coa-records', async (req, res) => {
    try {
        const { date } = req.query; // รับพารามิเตอร์วันที่
        
        const productionDailyService = new ProductionDailyService();
        const records = await productionDailyService.getProductionRecords(date);

        if (!records) {
            throw new Error('No records found');
        }

        res.json(records);
    } catch (error) {
        console.error('Error fetching COA records:', error);
        res.status(500).json({ error: error.message });
    }
});

// 6. อัพเดทเวลาเพื่อแก้ไข records
router.post('/reports/update-time', async (req, res) => {
    try {
        const { id, timeInManual, timeOutManual } = req.body;
        console.log('Received update request:', { id, timeInManual, timeOutManual });

        const productionDailyService = new ProductionDailyService();
        const result = await productionDailyService.updateTime(id, timeInManual, timeOutManual);

        if (!result) {
            throw new Error('No records found');
        }

        res.json({
            success: true,
            message: 'อัพเดทเวลาบ่อต้มสำเร็จ',
            data: result
        });
    } catch (error) { // เพิ่ม parameter error ที่ขาดไป
        console.error('Error updating time:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ Routes Rework ============
// 1. แสดงหน้าฟอร์ม Rework
router.get('/rework/form-record', async (req, res) => {
    try {
        res.render('pages/backend/production/rework/rework-form', {
            title: 'Form ReworkData Record',
            heading: 'Form ReworkData Record',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// 2. API ดึงข้อมูลจาก RSNCodeRef2
router.get('/rework/data-form-record', async (req, res) => {
    try {
        const { rsnCodeRef2 } = req.query;
        console.log('Received request with params:', rsnCodeRef2);

        const reworkService = new ReworkService();
        const record = await reworkService.getByRsnCodeRef2(rsnCodeRef2);

        res.json(record);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. API บันทึกข้อมูล Rework
router.post('/rework/submit', async (req, res) => {
    try {
        const reworkService = new ReworkService();
        const result = await reworkService.submitFormDataRework(req.body);

        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. แสดงหน้าตารางบันทึกข้อมูล rework
router.get('/rework/records', async (req, res) => {
    try {
        res.render('pages/backend/production/rework/records', {
            title: 'ReworkData Record',
            heading: 'ReworkData Record',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
})

// 5. API ดึงข้อมูลมาแสดงเป็นตารางในหน้า records rework
router.get('/rework/data-records', async (req, res) => {
    try {
        const reworkService = new ReworkService();
        const records = await reworkService.getReworkRecords();

        if (!records) {
            throw new Error('No records found');
        }
        
        // ส่งข้อมูลดิบไปให้ client จัดการเอง
        res.json(records);
    } catch (error) {
        console.error('Error fetching rework records:', error);
        res.status(500).json({ error: error.message });
    }
});

// 6. API ดึง workcenter 
router.get('/rework/data-workcenters', async (req, res) => {
    try {
        const reworkService = new ReworkService();
        const records = await reworkService.getWorkCenters();

        if (!records) {
            throw new Error('No records found');
        }

        res.json(records);        
    } catch (error) {
        console.error('Error fetching workcenters:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==== Router Sensor ====
// 1. API ดึงข้อมูล Sensor และบันทึก
// router.post('/sensor/fetch-and-save', async (req, res) => {
//     try {
//         const { apiUrl } = req.body;
//         const url = apiUrl || 'http://192.168.1.18:1880/api/sensors';

//     const result = await sensorService.fetchAndSaveSensorData(url);
//     res.json(result);
//     } catch {
//         console.error('Error fetching and saving sensor data:', error);
//         res.status(500).json({ error: error.message });
//     }
// })

// 1. API ดึงข้อมูล Sensor ตาม ID
// router.get('/sensor/:id', async (req, res) => {
//     try {
//         const sensorId = req.params.id;
//         const data = await sensorService.getSensorDataById(sensorId);
        
//         res.json(data);
//     } catch (error) {
//         console.error('Error fetching sensor data by ID:', error);
//         res.status(404).json({ error: error.message });
//     }
// });

// // 2. API ดึงข้อมูล Sensor ตามช่วง
// router.get('/sensor/:id/timerange', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { startTime, endTime } = req.query;
        
//         if (!startTime || !endTime) {
//             return res.status(400).json({ error: 'startTime and endTime are required' });
//         }
        
//         const data = await sensorService.getSensorDataByTimeRange(id, startTime, endTime);
//         res.json(data);
//     } catch (error) {
//         console.error('Error fetching sensor data by time range:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // 3. API ดูสถานะของ scheduler
// router.get('/sensor/scheduler/status', async (req, res) => {
//     try {
//         const status = sensorService.getSchedulerStatus();
//         res.json(status);
//     } catch (error) {
//         console.error('Error getting scheduler status:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // 4. API manual ใช้งาน scheduler 
// router.post('/sensor/scheduler/interval', async (req, res) => {
//     try {
//         const { minutes } = req.body;
        
//         if (!minutes || minutes < 1) {
//             return res.status(400).json({ error: 'Valid minutes value is required (minimum: 1)' });
//         }
        
//         const result = sensorService.updateScheduleInterval(parseInt(minutes));
//         res.json(result);
//     } catch (error) {
//         console.error('Error updating scheduler interval:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // 5. API อัพเดทช่วงเวลาการทำงานของ scheduler
// router.put('/sensor/scheduler/interval', async (req, res) => {
//     try {
//         const { minutes } = req.body;
        
//         if (!minutes || minutes < 1) {
//             return res.status(400).json({ error: 'Valid minutes value is required (minimum: 1)' });
//         }
        
//         const result = sensorService.updateScheduleInterval(parseInt(minutes));
//         res.json(result);
//     } catch (error) {
//         console.error('Error updating scheduler interval:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // 6. API เริ่มการทำงานของ scheduler (กรณีที่หยุดไว้)
// router.post('/sensor/scheduler/start', async (req, res) => {
//     try {
//         if (sensorService.scheduler.isRunning) {
//             return res.json({ success: true, message: 'Scheduler is already running', status: sensorService.getSchedulerStatus() });
//         }
        
//         sensorService.scheduler.start();
//         res.json({ success: true, message: 'Scheduler started', status: sensorService.getSchedulerStatus() });
//     } catch (error) {
//         console.error('Error starting scheduler:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // 7. API หยุดการทำงานของ scheduler
// router.post('/sensor/scheduler/stop', async (req, res) => {
//     try {
//         if (!sensorService.scheduler.isRunning) {
//             return res.json({ success: true, message: 'Scheduler is already stopped', status: sensorService.getSchedulerStatus() });
//         }
        
//         sensorService.scheduler.stop();
//         res.json({ success: true, message: 'Scheduler stopped', status: sensorService.getSchedulerStatus() });
//     } catch (error) {
//         console.error('Error stopping scheduler:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

module.exports = router;