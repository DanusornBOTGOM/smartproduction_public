const express = require('express');
const router = express.Router();
const Bar1Service = require('../../src/services/bar1.service')
// const moment = require('../../src/utils/dateUtils')
const moment = require('moment')
// moment.tz.setDefault("Asia/Bangkok")

router.get('/pop', async (req, res) => {
    try {
        const currentDate = moment().format('YYYY-MM-DD');
        const service = new Bar1Service(req.app.locals.db);
        const data = await service.getTableData(currentDate);

        res.render('pages/backend/production/dashboard/bar1-pop', {  
            title: 'BAR1 ProductionOnPlan',
            heading: 'BAR1 ProductionOnPlan Report',
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


module.exports = router;