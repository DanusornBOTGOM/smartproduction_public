const express = require('express');
const router = express.Router();
const Bar1Service = require('../../src/services/bar1.service');
// const AnnealingService = require('../../src/services/annealing.service')
const moment = require('moment')
moment.tz.setDefault("Asia/Bangkok")

router.get('/bar1-v2', async (req, res) => {
    try {
        const currentDate = moment().format('YYYY-MM-DD');
        const service = new Bar1Service(req.app.locals.db);
        const data = await service.getTableData(currentDate);

        res.render('pages/backend/production/bar1-v2', {  // ระบุ path เต็ม
            title: 'BAR1-V2',
            heading: 'BAR1-V2',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment,
            data: data
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`
            <div class="alert alert-danger">
                <h4>เกิดข้อผิดพลาด</h4>
                <p>${error.message}</p>
                <button onclick="history.back()" class="btn btn-primary">กลับ</button>
            </div>
        `);
    }
});

// router.get('/annealing/form', async (req, res) => {
//     try {
//         const service = new AnnealingService(req.app.locals.db)
//         const initialData = await service.getInitialData()

//         res.render('pages/backend/production/forms/annealing-form', {
//             title: 'Annealing Form',
//             heading: 'Annealing Production Report',
//             layout: './layouts/backend',
//             showNavbar: true,
//             data: initialData
//         })
//     } catch (error) {
//         console.error('Error:', error)
//         res.status(500).send(`
//             <div class="alert alert-danger">
//                 <h4>เกิดข้อผิดพลาด</h4>
//                 <p>${error.message}</p>
//                 <button onclick="history.back()" class="btn btn-primary">กลับ</button>
//             </div>    
//         `)
//     }
// })

// router.post('/annealing/submit', async (req, res) => {
//     try {
//         const service = new AnnealingService(req.app.locals.db)
//         const result = await service.submitFormData(req.body)

//         res.json(result)
//     } catch (error) {
//         console.error('Error:', error)
//         res.status(500).json({
//             success: false,
//             error: error.message
//         })
//     }
// })

module.exports = router;