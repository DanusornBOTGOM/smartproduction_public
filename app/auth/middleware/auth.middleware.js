const ApprovalService = require('../../production/domain/approval.service.js');

const requireSalesAuth = (req, res, next) => {
    console.log('Session in middleware:', req.session); // เพิ่ม log
    console.log('User in session:', req.session?.user); // เพิ่ม log

    if (!req.session?.user) {
        console.log('No user in session, redirecting to login'); // เพิ่ม log
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    if (req.session.user.role !== 'sales' && req.session.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Access denied'
        });
    }

    console.log('Auth check passed'); // เพิ่ม log
    next();
};

const requireApprovePermission = (req, res, next) => {
    if (!req.session?.user) {
        return res.redirect('/auth/login');
    }

    const approvalService = new ApprovalService();
    if (!approvalService.permissionService.hasApprovalPermission(req.session.user)) {
        return res.status(403).send(`
            <div style="text-align: center; margin-top: 50px;">
                <h2>ข้อผิดพลาด: ไม่มีสิทธิ์เข้าถึง</h2>
                <p>คุณไม่มีสิทธิ์อนุมัติรายการ</p>
                <a href="/backend" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">กลับสู่หน้าหลัก</a>
            </div>   
        `);
    }

    next();
}

const requireAdminAuth = (req, res, next) => {
    if (!req.session?.user) {
        return res.redirect('/auth/login');
    }

    // ตรวจสอบว่าเป็น admin
    if (req.session.user.role !== 'admin' && req.session.user.role !== 'super_admin') {
        return res.status(403).json({
            message: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'
        });
    }

    next();
};

module.exports = { 
    requireSalesAuth,
    requireAdminAuth,
    requireApprovePermission
};