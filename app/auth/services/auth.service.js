// app/auth/services/auth.service.js
const bcrypt = require('bcrypt');
const sql = require('mssql/msnodesqlv8');

class AuthService {
    constructor(db) {
        this.db = db;
    }

    async validateUser(username, password) {
        try {
            const result = await this.db.request()
                .input('username', sql.VarChar, username)
                .query('SELECT * FROM Users WHERE Username = @username');

            const user = result.recordset[0];
            
            if (!user) {
                return null;
            }

            // ถ้าเป็นรหัสผ่านที่ hash ไว้
            if (user.Password.startsWith('$2a$')) {
                const isValid = await bcrypt.compare(password, user.Password);
                if (!isValid) return null;
            } 
            // ถ้าเป็นรหัสผ่านธรรมดา (ควรเปลี่ยนเป็น hash ในอนาคต)
            else if (password !== user.Password) {
                return null;
            }

            // ไม่ส่ง password กลับไป
            delete user.Password;
            return user;
        } catch (error) {
            console.error('Auth service error:', error);
            throw error;
        }
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }
}

module.exports = AuthService;