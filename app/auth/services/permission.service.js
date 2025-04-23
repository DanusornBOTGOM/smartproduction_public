const { tr } = require("date-fns/locale");

class PermissionService {
    checkPermission(user, module, action) {
        if (!user?.permissions) return false;
        
        try {
            const permissions = JSON.parse(user.permissions);
            return permissions?.[module]?.[action] || false;
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    // เช็คสิทธิ์อนุมัติ
    hasApprovalPermission(user) {
        if (!user) return false;
        
        try {
            let permissions;
            
            // ตรวจสอบ permissions
            if (user.Permissions || user.permissions) {
                const permString = user.Permissions || user.permissions;
                if (typeof permString === 'string') {
                    permissions = JSON.parse(permString);
                } else {
                    permissions = permString;
                }
                
                // ตรวจสอบสิทธิ์ approve โดยตรง
                if (permissions?.production?.approve === true) {
                    return true;
                }
            }
            
            // ถ้าไม่มีสิทธิ์ในรูปแบบ JSON ให้ตรวจสอบ role
            const role = (user.Role || user.role || '').toLowerCase();
            return role === 'admin' || role === 'super_admin';
            
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }
}

module.exports = new PermissionService();