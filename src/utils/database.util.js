const sql = require('mssql');
const { connectDestSql } = require('../../config/sqldb_dbconfig'); // ปรับ path

class DatabaseConnection {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            if (!this.pool) {
                this.pool = await connectDestSql();
                console.log('Database connected successfully');
            }
            return this.pool;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseConnection();