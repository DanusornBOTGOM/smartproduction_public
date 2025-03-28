const express = require('express');
const router = express.Router();
const Bar1Service = require('../../src/services/bar1.service');
const AnnealingService = require('../../src/services/annealing.service')
const { formatDateThai, DATE_FORMAT } = require('../../src/utils/dateUtils'); 

// GET /production/annealing/form
router.get('/form', async (req, res) => {
    try {
        const service = new AnnealingService()  // ไม่ต้องส่ง db แล้ว
        const initialData = await service.getInitialData()


        res.render('pages/backend/production/forms/annealing-form', {
            title: 'Annealing Form',
            heading: 'Annealing Production Report',
            layout: './layouts/backend',
            showNavbar: true,
            data: initialData
        })
    } catch (error) {
        console.error('Error:', error)
        res.status(500).send(`
            <div class="alert alert-danger">
                <h4>เกิดข้อผิดพลาด</h4>
                <p>${error.message}</p>
                <button onclick="history.back()" class="btn btn-primary">กลับ</button>
            </div>    
        `)
    }
})

// GET เช็คข้อมูลซ้ำ
router.get('/records', async (req, res) => {
    try {
        const service = new AnnealingService();  // ไม่ต้องส่ง db
        const records = await service.getAnnealingRecords();
        
        
        res.render('pages/backend/production/tables/annealing-records', {
            title: 'Annealing Records',
            heading: 'Annealing Production Records',
            layout: './layouts/backend',
            showNavbar: true,
            records: records,
            formatDateThai: formatDateThai
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /production/annealing/submit
router.post('/submit', async (req, res) => {
    try {
        const service = new AnnealingService()  // ไม่ต้องส่ง db
        const result = await service.submitFormData(req.body)


        res.json(result)
    } catch (error) {
        console.error('Error:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

module.exports = router;