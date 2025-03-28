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
}

module.exports = new PermissionService();