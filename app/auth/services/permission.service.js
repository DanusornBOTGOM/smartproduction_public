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

        // ตรวจสอบว่าเป็น supervisor หรือ admin
        if (user.Role === 'supervisor' || user.Role === 'admin') {
            return true;
        }

        // ตรวจสอบจาก permissions
        if (user.Permissions) {
            try {
                const permissions = typeof user.Permissions === 'string'
                    ? JSON.parse(user.Permissions)
                    : user.Permissions;

                return permissions?.production?.approve || false;
            } catch (error) {
                console.error('Permission check error:', error);
                return false;
            }
        }

        return false;
    }
}

module.exports = new PermissionService();