const AdminSettings = {
    // Market Segment Functions
    deleteSegment: function (id) {
        if (confirm('Are you sure you want to delete this segment?')) {
            window.location.href = `/backend/sales/delete_market_segment/${id}`;
        }
    },

    // Sales Rep Functions
    deleteSalesRep: function (id) {
        if (confirm('Are you sure you want to delete this sales representative?')) {
            window.location.href = `/backend/sales/delete_sales_rep/${id}`;
        }
    },

    // deleteUser 
    deleteUser: function (id) {
        if (confirm('Are you sure you want to delete this user?')) {
            // ใช้ fetch แทนการ redirect
            fetch(`/backend/sales/delete_user/${id}`).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('User deleted successfully')
                        // รีโหลดหน้าหลังจากลบสำเร็จ
                        window.location.reload();
                    } else {
                        alert(data.message || 'Failed to deleted user');
                    }
                }).catch(error => {
                    console.error('Error:', error);
                    alert('Error deleting user');
                });
        }
    },

    updatePermissions: async function (userId) {
        const permissions = {
            sales: {},
            production: {}
        };

        // รวบรวมค่าจาก checkboxes
        document.querySelectorAll(`input[data-user-id="${userId}"]`).forEach(checkbox => {
            const module = checkbox.dataset.module;
            const action = checkbox.dataset.action;
            permissions[module][action] = checkbox.checked;
        });

        try {
            const response = await fetch('/backend/sales/update_permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    permissions: permissions
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Permissions updated successfully');
            } else {
                alert(result.message || 'Failed to update permissions');
            }
        } catch (error) {
            console.error('Error updating permissions:', error);
            alert('Error updating permissions');
        }
    },

    init: function () {
        // สำหรับบันทึก Permissions 
        document.querySelectorAll('.save-permissions').forEach(button => {
            button.addEventListener('click', () => {
                const userId = button.dataset.userId;
                this.updatePermissions(userId);
            });
        });
    }
};

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    AdminSettings.init();
});