const sql = require('mssql');
const bcrypt = require('bcrypts');
const {
    connectSaleSql
} = require('../../config/sqldb_dbconfig');

class AuthService {
    async validateUser(username, password) {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('SELECT * FROM Users WHERE username = @username');

        if (result.recordset.length === 0) {
            return null;
        }

        const user = result.recordset[0];
        const isValid = await bcrypt.compare(password, user.password);

        return isValid ? user : null;
    }

    async createUser(username, password, role) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await connectSaleSql();

        await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('role', sql.NVarChar, role)
            .query('INSERT INTO Users (username, password, role) VALUES (@username, @password, @role)');
    }
}

module.exports = new AuthService();