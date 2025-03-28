const express = require('express');
const router = express.Router();
const SaleService = require('../services/sale.service');
const permissionService = require('../../auth/services/permission.service');

const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Bangkok");
const {
    requireSalesAuth,
    requireAdminAuth
} = require('../../auth/middleware/auth.middleware');


// สร้าง instance เดียวใช้ร่วมกัน
const saleService = new SaleService();

// View sale customers 
router.get('/view_sale_customer/:id', requireSalesAuth, async (req, res) => {
    try {
        // ใช้ saleService แทน service
        const customerId = req.params.id;
        const customer = await saleService.getCustomerById(customerId);

        if (!customer) {
            req.flash('error', 'Customer not found');
            return res.redirect('/backend/sales/sale_new_customers');
        }

        const [salesReps, marketSegments] = await Promise.all([
            saleService.getSalesReps(),
            saleService.getMarketSegments()
        ]);

        res.render('pages/backend/view_sale_customer', {
            title: 'View Special Customer',
            heading: 'View Special Customer',
            layout: './layouts/backend',
            showNavbar: true,
            customer,
            salesReps,
            marketSegments,
            moment
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error', 'Failed to load customer details');
        res.redirect('/backend/sales/sale_new_customers');
    }
});

// Sale New Customers List
router.get('/sale_new_customers', requireSalesAuth, async (req, res) => {
    try {
        const customers = await saleService.getCustomers();
        const marketSegments = await saleService.getMarketSegments();

        const segmentsMap = marketSegments.reduce((acc, segment) => {
            acc[segment.SegmentId] = segment.SegmentName;
            return acc;
        }, {});

        res.render('pages/backend/sale_new_customers', {
            title: 'Special Customers',
            heading: 'Special Customers',
            layout: './layouts/backend',
            showNavbar: true,
            data: customers,
            marketSegments: segmentsMap,
            moment
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error', 'Failed to load customers list');
        res.redirect('/backend');
    }
});

// Create New Customer Form
router.get('/create_sale_new_customers', async (req, res) => {
    try {
        const [salesReps, marketSegments] = await Promise.all([
            saleService.getSalesReps(),
            saleService.getMarketSegments()
        ]);

        res.render('pages/backend/create_sale_new_customers', {
            title: 'Create New Special Customer',
            heading: 'Create New Special Customer',
            layout: './layouts/backend',
            showNavbar: true,
            salesReps,
            marketSegments,
            moment
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error', 'Failed to load create customer form');
        res.redirect('/backend/sales/sale_new_customers');
    }
});

// Create New Customer POST
router.post('/sale_new_customers', async (req, res) => {
    try {
        await saleService.createCustomer(req.body);
        req.flash('success', 'New customer added successfully');
        res.redirect('/backend/sales/sale_new_customers');
    } catch (error) {
        console.error('Error:', error);
        if (error.number === 2627 || error.number === 2601) {
            req.flash('error', 'A customer with this information already exists.');
        } else {
            req.flash('error', 'Failed to add new customer: ' + error.message);
        }
        res.redirect('/backend/sales/create_sale_new_customers');
    }
});

// Update Customer
router.post('/update_sale_customer/:id', async (req, res) => {
    try {
        await saleService.updateCustomer(req.params.id, req.body);
        req.flash('success', 'Customer updated successfully');
        res.redirect('/backend/sales/sale_new_customers');
    } catch (error) {
        console.error('Error:', error);
        req.flash('error', 'Failed to update customer: ' + error.message);
        res.redirect(`/backend/sales/view_sale_customer/${req.params.id}`);
    }
});

// Delete Customer
router.get('/delete_sale_customer/:id', async (req, res) => {
    try {
        const hasPermission = permissionService.checkPermission(
            req.session.user,
            'sales',
            'delete'
        );

        if (!hasPermission) {
            return res.json({
                success: false,
                message: 'คุณไม่มีสิทธิ์ในการลบข้อมูล'
            });
        }

        await saleService.deleteCustomer(req.params.id);
        return res.json({
            success: true,
            message: 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete error:', error);
        return res.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล'
        });
    }
});

router.get('/admin_test', requireAdminAuth, async (req, res) => {
    res.render('pages/backend/admin_test', {
        title: 'Admin Test',
        heading: 'Admin Test',
        layout: './layouts/backend',
        showNavbar: true
    });
});

router.get('/admin_settings', requireAdminAuth, async (req, res) => {
    try {
        const [marketSegments, salesReps, users] = await Promise.all([
            saleService.getMarketSegments(),
            saleService.getSalesReps(),
            saleService.getUsers()
        ]);

        const processedUsers = users.map(user => {
            let permissions = {};
            if (user.Permissions) {
                try {
                    // ทำความสะอาด string ก่อน parse
                    const cleanPermissions = user.Permissions
                        .replace(/\r\n/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    permissions = JSON.parse(cleanPermissions);
                } catch (e) {
                    console.log('Invalid permissions for user:', user.Username);
                    permissions = {
                        sales: {
                            view: false,
                            edit: false,
                            delete: false
                        },
                        production: {
                            view: false,
                            edit: false,
                            delete: false
                        }
                    };
                }
            }
            return {
                ...user,
                permissions
            };
        });

        res.render('pages/backend/admin_settings', {
            title: 'Admin Settings',
            heading: 'Admin Settings',
            layout: './layouts/backend',
            showNavbar: true,
            marketSegments,
            salesReps,
            users: processedUsers
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// Admin Settings
// เพิ่ม Market Segment
router.post('/add_market_segment', requireAdminAuth, async (req, res) => {
    try {
        await saleService.addMarketSegment(req.body.segmentName);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// ลบ Market Segment
router.get('/delete_market_segment/:id', requireAdminAuth, async (req, res) => {
    try {
        await saleService.deleteMarketSegment(req.params.id);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// เพิ่ม Sales Rep
router.post('/add_sales_rep', requireAdminAuth, async (req, res) => {
    try {
        await saleService.addSalesRep(req.body);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// ลบ Sales Rep
router.get('/delete_sales_rep/:id', requireAdminAuth, async (req, res) => {
    try {
        await saleService.deleteSalesRep(req.params.id);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// Edit Sales Rep
router.post('/edit_sales_rep', requireAdminAuth, async (req, res) => {
    try {
        await saleService.updateSaleRep(req.body.salesRepId, req.body);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error(500).send('Server Error');
    }
});

// เพิ่ม USER
router.post('/add_user', requireAdminAuth, async (req, res) => {
    try {
        await saleService.addUser(req.body);
        res.redirect('/backend/sales/admin_settings');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('Error adding user');
    }
});

// ลบ USER ส่งแบบ JSON response
router.get('/delete_user/:id', requireAdminAuth, async (req, res) => {
    try {
        // ดึง ID จาก params แทนการใช้ req.body
        const userId = req.params.id;
        await saleService.deleteUser(userId);

        return res.json({
            success: true,
            message: 'User deleting successfully'
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        return res.json({
            success: false,
            message: error.message
        });
    }
});

// แก้ไขสิทธิ์ User
router.post('/update_permissions', requireAdminAuth, async (req, res) => {
    try {
        const { userId, permissions } = req.body;
        await saleService.updateUserPermissions(userId, permissions);
        res.json({ 
            success: true,
            message: 'User update permissions successfully'
         });
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Sales route error:', error);
    req.flash('error', error.message || 'An unexpected error occurred');
    res.redirect('/backend/sales/sale_new_customers');
});

module.exports = router;