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
    requireAdminAuth  // เพิ่ม export
};