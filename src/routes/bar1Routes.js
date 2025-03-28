// routes/bar1Routes.js
const express = require('express');
const router = express.Router();
const Bar1Service = require('../services/bar1.service'); 
const { connectDestSql } = require('../../config/sqldb_dbconfig')

let bar1Service;
let dbSQL

// เพิ่มฟังก์ชันเชื่อมต่อ database
async function initializeDatabase() {
    try {
        if (!dbSQL) {
            dbSQL = await connectDestSql();
            console.log('Database connected in bar1Routes');
        }
        return dbSQL;
    } catch (err) {
        console.error('Error initializing database connection:', err);
        throw err;
    }
}

async function getBar1Service() {
    if (!bar1Service) {
        const db = await initializeDatabase();
        bar1Service = new Bar1Service(db);
    }
    return bar1Service;
}

router.get('/bar1TableDaily', async (req, res) => {
    try {
        const { date } = req.query;
        const service = await getBar1Service();
        const data = await service.getTableData(date);
        res.json({
            success: true,
            data,
            logs: service.getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: getBar1Service().getLogs()
        });
    }
});


router.post('/updateRemark', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { docNo, rsnCode, remark, currentMachineCode, newMachineCode } = req.body;
        const result = await service.updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        // แก้ไขตรงนี้
        res.status(500).json({
            success: false,
            error: error.message,
            logs: (await getBar1Service()).getLogs() // เพิ่ม await
        });
    }
});


router.get('/machineDetails', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { machineCode, date } = req.query;
        const data = await service.getMachineDetails(machineCode, date);
        res.json({
            success: true,
            data,
            logs: service.getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: getBar1Service().getLogs()
        });
    }
});

router.get('/weeklyReport', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { startDate, endDate } = req.query;

        if (!startDate && !endDate) {
            return res.status(400).json({
                success: false,
                error: 'StartDate and endDate are require',
                logs: (await getBar1Service()).getLogs()
            });
        }

        const data = await service.getWeeklyReport(startDate, endDate);
        res.json({
            success: true,
            data,
            logs: (await getBar1Service()).getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: (await getBar1Service()).getLogs()
        });
    }
});

router.post('/saveCause', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { data } = req.body;
        const result = await service.saveCause(data);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: (await getBar1Service()).getLogs() // เพิ่ม await
        });
    }
});

router.get('/monthlyData', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                error: 'Month and year are required',
                logs: (await getBar1Service()).getLogs()
            });
        }

        const data = await service.getMonthlyData(month, year);
        res.json({
            success: true,
            data,
            logs: (await getBar1Service()).getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: (await getBar1Service()).getLogs()
        });
    }
});

 router.get('/wasteChartData', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { startDate, endDate, machineCodePrefix } = req.query;
        const data = await service.getWasteChartData(startDate, endDate, machineCodePrefix);
        res.json({
            success: true,
            data,
            logs: service.getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: getBar1Service().getLogs()
        });
    }
 });

 router.post('/updateMultipleMachineCodes', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { docNo, newMachineCode, currentDate } = req.body;
        const result = await service.updateMultipleMachineCodes(docNo, newMachineCode, currentDate);
        res.json({
            success: true,
            data: result,
            logs: service.getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: getBar1Service().getLogs()
        });
    }
 });

 router.get('/causeData', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { date } = req.query;
        const data = await service.getCauseData(date);
        res.json({
            success: true,
            data,
            logs: service.getLogs()
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: getBar1Service().getLogs()
        });
    }
 });

 router.post('/updateCauses', async (req, res) => {
    try {
        const service = await getBar1Service();
        const { date, machineCode, docNo, problems } = req.body;
        const result = await service.updateCauses(date, machineCode, docNo, problems);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            logs: (await getBar1Service()).getLogs() // เพิ่ม await
        });
    }
});

 module.exports = router;