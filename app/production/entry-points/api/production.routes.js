// app/production/api/production.routes.js
const express = require('express');
const router = express.Router();

// Import Service
const WeeklyService = require('../../domain/weekly');
const ProfileService = require('../../domain/profile.service');
const OEEService = require('../../domain/oee.service');
const WorkingHourService = require('../../domain/workinghour.service')
const ReworkService = require('../../domain/rework.service');
const ProductionDailyService = require('../../domain/production-daily.service');
const ApprovalService = require('../../domain/approval.service');

const { tr } = require('date-fns/locale');
// Sensor
// const SensorService = require('../../domain/senser.service')

// instances ของ service
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

// ============ Working Hour Routes ============
// 1. OEE Department Working Hour
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

// 2. API สำหรับข้อมูล WorkingHour
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

// ============ Workshift Routes (Working Hour) ============
// 3. แสดงหน้าปฏิทินเวลาทำงานของเครื่องจักร
router.get('/workshift/calendar', async (req, res) => {
    try {
        // ดึงรายการเครื่องจักรสำหรับแสดงใน dropdown
        const workingHourService = new WorkingHourService();
        const machines = await workingHourService.getMachines();
        
        res.render('pages/backend/production/working-hour/workshift/calendar', { // แก้ไข path
            title: 'เวลาทำงานของเครื่องจักร',
            heading: 'เวลาทำงานของเครื่องจักร',
            layout: './layouts/backend',
            showNavbar: true,
            machines: machines
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// 4. API ดึงข้อมูลปฎิทิน
router.get('/workshift/calendar-data', async (req, res) => {
    try {
        const { machineCode, startDate, endDate } = req.query;
        
        if (!machineCode || !startDate || !endDate) {
            return res.status(400).json(['01', 'กรุณาระบุรหัสเครื่องจักรและช่วงเวลา', []]);
        }
        
        const workingHourService = new WorkingHourService();
        // ใช้ฟังก์ชันที่เหมาะสม
        const events = await workingHourService.getWorkshiftCalendarEvents(machineCode, startDate, endDate);
        
        // ตอบกลับในรูปแบบที่กำหนด
        res.json(['00', 'success', events]);
    } catch (error) {
        console.error('Error in calendar-data API:', error);
        res.status(500).json(['01', 'เกิดข้อผิดพลาดในการดึงข้อมูลปฏิทิน: ' + error.message, []]);
    }
});

// 5. หน้าฟอร์มเพิ่มเวลาทำงาน
router.get('/workshift/add', async (req, res) => {
    try {
        const workingHourService = new WorkingHourService();
        const machines = await workingHourService.getMachines();
        
        // รับค่า parameters จาก URL (ถ้ามี)
        const { machineCode, workdate } = req.query;
        
        // สร้างวัตถุสำหรับเก็บค่าเริ่มต้น
        let initialData = {
            machineCode: machineCode || (machines.length > 0 ? machines[0].MachineCode : ''),
            workdate: workdate || new Date().toISOString().split('T')[0]
        };
        
        // สร้างเวลาเริ่มต้น/สิ้นสุดเริ่มต้น (เวลาปัจจุบันและปัดเป็นชั่วโมงถัดไป)
        if (workdate) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            // ถ้าเป็นวันนี้ ใช้เวลาปัจจุบัน
            if (workdate === today) {
                // ปัดเวลาให้เป็นชั่วโมงถัดไป
                const hours = now.getHours();
                const shstTime = `${workdate}T${hours.toString().padStart(2, '0')}:00`;
                const shenTime = `${workdate}T${(hours + 8).toString().padStart(2, '0')}:00`;
                
                initialData.shst = shstTime;
                initialData.shen = shenTime;
            } 
            // ถ้าไม่ใช่วันนี้ ใช้เวลาที่กำหนด (เช่น 8:00 - 16:00)
            else {
                initialData.shst = `${workdate}T08:00`;
                initialData.shen = `${workdate}T16:00`;
            }
        }
        
        res.render('pages/backend/production/working-hour/workshift/form', { // แก้ไข path
            title: 'เพิ่มเวลาทำงานของเครื่องจักร',
            heading: 'เพิ่มเวลาทำงานของเครื่องจักร',
            layout: './layouts/backend',
            showNavbar: true,
            machines: machines,
            workshift: initialData, // ส่งค่าเริ่มต้น
            actionUrl: '/api/production/workshift/add'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// 5-1 API บันทึกข้อมูลเวลาทำงานใหม่
router.post('/workshift/add', async (req, res) => {
    try {
        const workingHourService = new WorkingHourService();
        const result = await workingHourService.addWorkshift(req.body);
        
        req.flash('success', 'บันทึกข้อมูลเวลาทำงานเรียบร้อยแล้ว');
        res.redirect('/api/production/workshift/list');
    } catch (error) {
        console.error('Error adding workshift:', error);
        req.flash('error', `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message}`);
        res.redirect('/api/production/workshift/add');
    }
});

// 6. หน้าฟอร์มแก้ไขเวลาทำงาน
router.get('/workshift/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workingHourService = new WorkingHourService();
        const machines = await workingHourService.getMachines();
        const workshift = await workingHourService.getWorkshiftById(parseInt(id));
        
        if (!workshift) {
            req.flash('error', 'ไม่พบข้อมูลเวลาทำงานที่ต้องการแก้ไข');
            return res.redirect('/api/production/workshift/list');
        }
        
        res.render('pages/backend/production/working-hour/workshift/form', { // แก้ไข path
            title: 'แก้ไขเวลาทำงานของเครื่องจักร',
            heading: 'แก้ไขเวลาทำงานของเครื่องจักร',
            layout: './layouts/backend',
            showNavbar: true,
            machines: machines,
            workshift: workshift,
            actionUrl: `/api/production/workshift/edit/${id}`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// 6-1 API หน้าฟอร์มแก้ไขเวลาทำงาน
router.post('/workshift/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workingHourService = new WorkingHourService();
        await workingHourService.updateWorkshift(parseInt(id), req.body);
        
        req.flash('success', 'แก้ไขข้อมูลเวลาทำงานเรียบร้อยแล้ว');
        res.redirect('/api/production/workshift/list');
    } catch (error) {
        console.error(`Error updating workshift ${req.params.id}:`, error);
        req.flash('error', `เกิดข้อผิดพลาดในการแก้ไขข้อมูล: ${error.message}`);
        res.redirect(`/api/production/workshift/edit/${req.params.id}`);
    }
});

// 6-2 API ลบข้อมูลเวลาทำงาน
router.post('/workshift/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workingHourService = new WorkingHourService();
        await workingHourService.deleteWorkshift(parseInt(id));
        
        req.flash('success', 'ลบข้อมูลเวลาทำงานเรียบร้อยแล้ว');
        res.redirect('/api/production/workshift/list');
    } catch (error) {
        console.error(`Error deleting workshift ${req.params.id}:`, error);
        req.flash('error', `เกิดข้อผิดพลาดในการลบข้อมูล: ${error.message}`);
        res.redirect('/api/production/workshift/list');
    }
});

// 7. API ดึงข้อมูลเครื่องจักรทั้งหมด
router.get('/workshift/machines', async (req, res) => {
    try {
        const workingHourService = new WorkingHourService();
        const machines = await workingHourService.getMachines();
        res.json(machines);
    } catch (error) {
        console.error('Error in GET /workshift/machines:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเครื่องจักร', error: error.message });
    }
});

// 8. API ดึงข้อมูลเวลาทำงานตามเงื่อนไข
router.get('/workshift/data', async (req, res) => {
    try {
        const { machineCode, startDate, endDate } = req.query;
        
        if (!machineCode || !startDate || !endDate) {
            return res.status(400).json({ message: 'กรุณาระบุรหัสเครื่องจักรและช่วงเวลา' });
        }
        
        const workingHourService = new WorkingHourService();
        const workshifts = await workingHourService.getWorkshifts(machineCode, startDate, endDate);
        res.json(workshifts);
    } catch (error) {
        console.error('Error in GET /workshift/data:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเวลาทำงาน', error: error.message });
    }
});

// 9. หน้ารายการเวลาทำงาน
router.get('/workshift/list', async (req, res) => {
    try {
        const workingHourService = new WorkingHourService();
        const machines = await workingHourService.getMachines();
        
        // ดึงข้อมูลเวลาทำงานล่าสุด 100 รายการ (ถ้าไม่มีการระบุเงื่อนไขในการค้นหา)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const startDate = req.query.startDate || thirtyDaysAgo.toISOString().split('T')[0];
        const endDate = req.query.endDate || today.toISOString().split('T')[0];
        const machineCode = req.query.machineCode || (machines.length > 0 ? machines[0].MachineCode : '');
        
        let workshifts = [];
        if (machineCode) {
            workshifts = await workingHourService.getWorkshifts(machineCode, startDate, endDate);
        }
        
        res.render('pages/backend/production/working-hour/workshift/list', { // แก้ไข path
            title: 'รายการเวลาทำงานของเครื่องจักร',
            heading: 'รายการเวลาทำงานของเครื่องจักร',
            layout: './layouts/backend',
            showNavbar: true,
            machines: machines,
            workshifts: workshifts,
            selectedMachine: machineCode,
            startDate: startDate,
            endDate: endDate
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// ============ Profile Department Routes ============
// 1. Profile Dashboard
router.get('/profile/dashboard', async (req, res) => {
    try {
        // ส่ง response เป็น HTML หน้า dashboard
        res.render('pages/backend/production/profile/index', {
            title: 'Profile Production Dashboard',
            heading: 'Profile Production Dashboard',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error rendering Profile dashboard:', error);
        res.status(500).send(`Server Error: ${error.message}`);
    }
});

// 2. API 1: Daily Production data
router.get('/profile/daily', async (req, res) => {
    try {
        const { date, machineCodePrefix = 'PRO' } = req.query;

        // Validate required parameters
        if (!date) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Date parameter is required'
            });
        }

        console.log(`API: Fetching daily data for date: ${date}, prefix: ${machineCodePrefix}`);
        const data = await profileService.getDailyProduction(date, machineCodePrefix);
        
        console.log(`API: Returning ${data.length} records for daily production`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /profile/daily:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 3. API 2: Chart data
router.get('/profile/chart', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validate required parameters
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Start date and end date are required' 
            });
        }

        console.log(`API: Fetching chart data from ${startDate} to ${endDate}`);
        const data = await profileService.getChartData(startDate, endDate);
        
        console.log(`API: Returning ${data.length} records for chart data`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /profile/chart:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 4. API 3: Machine Details
router.get('/profile/machine-details', async (req, res) => {
    try {
        const { machineCode, startDate, endDate } = req.query;
        
        // Validate required parameters
        if (!machineCode || !startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Machine code, start date, and end date are required' 
            });
        }
        
        console.log(`API: Fetching machine details for ${machineCode} from ${startDate} to ${endDate}`);
        const data = await profileService.getMachineDetails(machineCode, startDate, endDate);
        
        console.log(`API: Returning machine details with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /profile/machine-details:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 5. API 4: Plan Data
router.get('/profile/plan', async (req, res) => {
    try {
        const { date, department = 'PRO' } = req.query;
        
        // Validate required parameters
        if (!date) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Date parameter is required' 
            });
        }
        
        console.log(`API: Fetching plan data for department ${department} on ${date}`);
        const data = await profileService.getPlanData(date, department);
        
        console.log(`API: Returning plan data with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /profile/plan:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 6. API 5: Create New Plan
router.post('/profile/plan', async (req, res) => {
    try {
        // ตรวจสอบข้อมูลที่จำเป็น
        const { docNo, machineCode, productionQuantity, step, date, department } = req.body;
        
        if (!docNo || !machineCode || !productionQuantity || !date || !department) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: docNo, machineCode, productionQuantity, date, and department are required'
            });
        }
        
        console.log(`API: Creating new plan for ${machineCode}, doc ${docNo}`);
        const result = await profileService.savePlan(req.body);
        
        console.log('API: Plan created successfully');
        res.status(201).json(result);
    } catch (error) {
        console.error('API Error in POST /profile/plan:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 7. API 6: Update Plan
router.put('/profile/plan/:planNo', async (req, res) => {
    try {
        const { planNo } = req.params;
        const { machineCode, productionQuantity, step } = req.body;
        
        if (!planNo || !machineCode || productionQuantity === undefined || step === undefined) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: machineCode, productionQuantity, and step are required'
            });
        }
        
        console.log(`API: Updating plan ${planNo}`);
        const result = await profileService.updatePlan(planNo, req.body);
        
        console.log(`API: Plan ${planNo} updated successfully`);
        res.json(result);
    } catch (error) {
        console.error(`API Error in PUT /profile/plan/${req.params.planNo}:`, error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 8. API 7: Delete Plan
router.delete('/profile/plan/:planNo', async (req, res) => {
    try {
        const { planNo } = req.params;
        
        if (!planNo) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Plan number is required'
            });
        }
        
        console.log(`API: Deleting plan ${planNo}`);
        const result = await profileService.deletePlan(planNo);
        
        console.log(`API: Plan ${planNo} deleted successfully`);
        res.json(result);
    } catch (error) {
        console.error(`API Error in DELETE /profile/plan/${req.params.planNo}:`, error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});


// 1. บันทึก cause ทั้งหมด
router.post('/saveAllCause', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Invalid or empty data provided' 
            });
        }
        
        console.log(`API: Saving ${data.length} causes`);
        const result = await profileService.saveAllCauses(data);
        
        console.log('API: Causes saved successfully');
        res.json(result);
    } catch (error) {
        console.error('API Error in /saveAllCause:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 2. ดึงข้อมูล Breakdown Causes
router.get('/breakdown-causes', async (req, res) => {
    try {
        console.log('API: Fetching breakdown causes');
        const data = await profileService.getBreakdownCauses();
        
        console.log(`API: Returning ${data.length} breakdown causes`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /breakdown-causes:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 3. ดึงข้อมูล cause ทั้งหมด
router.get('/getCausesMswAll', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Date parameter is required'
            });
        }
        
        console.log(`API: Fetching causes for date ${date}`);
        const data = await profileService.getCauseData(date);
        
        console.log(`API: Returning cause data`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /getCausesMswAll:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 4. อัพเดทข้อมูล causes
router.post('/updateCausesMswAll', async (req, res) => {
    try {
        const { date, machineCode, docNo, problems, deletedProblems } = req.body;
        
        if (!date || !machineCode) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Date and machineCode are required'
            });
        }
        
        console.log(`API: Updating causes for machine ${machineCode} on ${date}`);
        const result = await profileService.updateCauses(
            date, 
            machineCode, 
            docNo, 
            problems, 
            deletedProblems
        );
        
        console.log('API: Causes updated successfully');
        res.json(result);
    } catch (error) {
        console.error('API Error in /updateCausesMswAll:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 5. อัพเดทข้อมูล remark
router.post('/updateRemark', async (req, res) => {
    try {
        const { docNo, rsnCode, remark, currentMachineCode, newMachineCode } = req.body;
        
        if (!docNo || !rsnCode) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'docNo and rsnCode are required'
            });
        }
        
        console.log(`API: Updating remark for doc ${docNo}, RSN ${rsnCode}`);
        const result = await profileService.updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode);
        
        console.log(`API: Remark updated successfully for doc ${docNo}`);
        res.json({
            success: true,
            message: 'Remark updated successfully',
            data: result
        });
    } catch (error) {
        console.error('API Error in /updateRemark:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 6. ดึงข้อมูลแผนการผลิต
router.get('/getPlanData', async (req, res) => {
    try {
        const { date, department = 'PRO' } = req.query;
        
        if (!date) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Date parameter is required' 
            });
        }
        
        console.log(`API: Fetching plan data for department ${department} on ${date}`);
        const data = await profileService.getPlanData(date, department);
        
        console.log(`API: Returning plan data with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /getPlanData:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 7. เพิ่มข้อมูลแผนการผลิตใหม่
router.post('/addNewPlan', async (req, res) => {
    try {
        // ตรวจสอบข้อมูลที่จำเป็น
        const { docNo, machineCode, productionQuantity, date, department } = req.body;
        
        if (!docNo || !machineCode || !productionQuantity || !date || !department) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: docNo, machineCode, productionQuantity, date, and department are required'
            });
        }
        
        console.log(`API: Creating new plan for ${machineCode}, doc ${docNo}`);
        const result = await profileService.savePlan(req.body);
        
        console.log('API: Plan created successfully');
        res.status(201).json(result);
    } catch (error) {
        console.error('API Error in /addNewPlan:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 8. ลบข้อมูลแผนการผลิต
router.post('/deletePlan', async (req, res) => {
    try {
        const { No } = req.body;
        
        if (!No) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Plan number is required'
            });
        }
        
        console.log(`API: Deleting plan ${No}`);
        const result = await profileService.deletePlan(No);
        
        console.log(`API: Plan ${No} deleted successfully`);
        res.json(result);
    } catch (error) {
        console.error('API Error in /deletePlan:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 9. อัพเดทข้อมูลแผนการผลิต
router.post('/updatePlan', async (req, res) => {
    try {
        const { No, machineCode, productionQuantity, step } = req.body;
        
        if (!No || !machineCode || productionQuantity === undefined) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: No, machineCode, and productionQuantity are required'
            });
        }
        
        console.log(`API: Updating plan ${No}`);
        const result = await profileService.updatePlan(No, {
            machineCode,
            productionQuantity,
            step
        });
        
        console.log(`API: Plan ${No} updated successfully`);
        res.json(result);
    } catch (error) {
        console.error('API Error in /updatePlan:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 10. ดึงข้อมูลรายละเอียดเครื่องจักร
router.get('/machineDetailsExtended', async (req, res) => {
    try {
        const { startDate, endDate, machineCode, type } = req.query;
        
        if (!startDate || !endDate || !machineCode) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'startDate, endDate, and machineCode are required parameters'
            });
        }
        
        console.log(`API: Fetching machine details for ${machineCode} from ${startDate} to ${endDate}, type: ${type || 'default'}`);
        const data = await profileService.getMachineDetails(machineCode, startDate, endDate);
        
        console.log(`API: Returning machine details with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('API Error in /machineDetailsExtended:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 9. API 8: Update Causes
router.post('/profile/update-causes', async (req, res) => {
    try {
        const { date, machineCode, docNo, problems, deletedProblems } = req.body;
        
        if (!date || !machineCode) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Date and machineCode are required'
            });
        }
        
        console.log(`API: Updating causes for machine ${machineCode} on ${date}`);
        const result = await profileService.updateCauses(
            date, 
            machineCode, 
            docNo, 
            problems, 
            deletedProblems
        );
        
        console.log('API: Causes updated successfully');
        res.json(result);
    } catch (error) {
        console.error('API Error in POST /profile/update-causes:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 10. API 9: Get Causes
router.get('/profile/causes', async (req, res) => {
    try {
        const { date, machineCodePrefix = 'PRO' } = req.query;
        
        if (!date) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Date parameter is required'
            });
        }
        
        console.log(`API: Fetching causes for date ${date}, prefix ${machineCodePrefix}`);
        const data = await profileService.getCauseData(date, machineCodePrefix);
        
        console.log(`API: Returning causes data for ${Object.keys(data).length} machines`);
        res.json(data);
    } catch (error) {
        console.error('API Error in GET /profile/causes:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 11. API 11: Get Breakdown-Causes All
router.get('/breakdown-causes', async (req, res) => {
    try {
        const data = await profileService.getBreakdownCauses();

        res.json(data);
    } catch (error) {
        console.error('Error in breakdown-causes:', error);
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: error.message 
        });
      }
});

// 12. API 10: Update Remark
router.post('/profile/update-remark', async (req, res) => {
    try {
        const { docNo, rsnCode, remark, newMachineCode } = req.body;
        
        if (!docNo || !rsnCode) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'docNo and rsnCode are required'
            });
        }
        
        console.log(`API: Updating remark for doc ${docNo}, RSN ${rsnCode}`);
        const result = await profileService.updateRemark(docNo, rsnCode, remark, newMachineCode);
        
        console.log(`API: Remark updated successfully for doc ${docNo}`);
        res.json({
            success: true,
            message: 'Remark updated successfully',
            data: result
        });
    } catch (error) {
        console.error('API Error in POST /profile/update-remark:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 12. API 11: Weekly Report
router.get('/profile/weekly-report', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Start date and end date are required'
            });
        }
        
        console.log(`API: Fetching weekly report from ${startDate} to ${endDate}`);
        const data = await profileService.getWeeklyReport(startDate, endDate);
        
        console.log(`API: Returning weekly report with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('API Error in GET /profile/weekly-report:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});

// 13. API 12: Save Weekly Report Corrections
router.post('/profile/weekly-report/corrections', async (req, res) => {
    try {
        const data = req.body;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid data format. Expected non-empty array'
            });
        }
        
        console.log(`API: Saving weekly report corrections for ${data.length} items`);
        const result = await profileService.saveWeeklyReportCorrections(data);
        
        console.log('API: Weekly report corrections saved successfully');
        res.json(result);
    } catch (error) {
        console.error('API Error in POST /profile/weekly-report/corrections:', error);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message 
        });
    }
});


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
        const { id, timeInManual, timeOutManual, timeInForm, timeOutForm } = req.body;
        console.log('Received update request:', { id, timeInManual, timeOutManual, timeInForm, timeOutForm });

        const productionDailyService = new ProductionDailyService();
        const result = await productionDailyService.updateTime(id, timeInManual, timeOutManual, timeInForm, timeOutForm);

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

// 7. API รออนุมัติ
router.get('/reports/pending-approvals', async (req, res) => {
    try {
        // ตรวจสอบว่า user login แล้วหรือไม่
        if (!req.session.user) {
            return res.status(401).json({ error: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบ' });
        }

        const { date } = req.query;
        const approvalService = new ApprovalService();
        const records = await approvalService.getPendingApprovals(date);

        res.json(records);
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ error: error.message });
    }
});

// 8. API สำหรับอนุมัติ
router.post('/reports/approve', async (req, res) => {
    try {
        // ตรวจสอบว่า user login แล้วหรือไม่
        if (!req.session.user) {
            return res.status(401).json({ error: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบ' });
        }
        
        const { recordId, status, comment } = req.body;
        const user = req.session.user;

        const approvalService = new ApprovalService();
        const result = await approvalService.approveRecord(recordId, user, status, comment);
        
        res.json({
            success: true,
            message: 'บันทึกการอนุมัติสำเร็จ',
            data: result
        });
    } catch (error) {
        console.error('Error approving record:', error);
        res.status(500).json({ error: error.message });
    }
})

// 9. API ประวัติการอนุมัติ
router.get('/reports/approval-history', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบ' })
        }

        const { date } = req.query;
        const approvalService = new ApprovalService();
        const records = await approvalService.getApprovalHistory(date);
        
        res.json(records);
    } catch (error) {
        console.error('Error fetching approval history:', error);
        res.status(500).json({ error: error.message });
    }
});

// 10. สำหรับการอนุมัติ
router.get('/reports/approval', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login?redirect=/production/reports/approval');
        }
        
        res.render('pages/backend/production/reports/approval-page', {
            title: 'Production Approval',
            heading: 'Production Approval',
            layout: './layouts/backend',
            showNavbar: true,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
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