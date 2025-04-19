const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectSaleSql } = require('../config/sqldb_dbconfig');

router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Login',
        heading: 'Login',
        layout: './layouts/backend',
        messages: req.flash(),
        showNavbar: false
    });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const pool = await connectSaleSql();
        
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .query('SELECT * FROM [Production_Analytics].[dbo].[Users] WHERE Username = @username AND Password = @password');

        const user = result.recordset[0];
        
        if (!user) {
            req.flash('error', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            return res.redirect('/auth/login');
        }

        req.session.user = {
            id: user.ID,
            username: user.Username,
            role: user.Role,
            permissions: user.Permissions, // เพิ่มส่วนนี้
            loginTime: new Date()
        };
        
        const returnTo = req.session.returnTo || '/backend/sales/sale_new_customers';
        delete req.session.returnTo;
        res.redirect(returnTo);

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        res.redirect('/auth/login');
    }
});

router.get('/logout', (req, res) => {
    // ลบข้อมูล session
    req.session = null;
    // เด้งกลับไปหน้า login
    res.redirect('/auth/login');
});

module.exports = router;