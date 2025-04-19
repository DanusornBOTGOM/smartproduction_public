const sql = require('mssql');
const { connectSaleSql } = require('../../../config/sqldb_dbconfig');
const EventEmitter = require('events');

class SessionStore extends EventEmitter {
    constructor() {
        super();
    }

    async get(sid, callback) {
        try {
            const pool = await connectSaleSql();
            const result = await pool.request()
                .input('sid', sql.NVarChar, sid)
                .query('SELECT Data FROM [Production_Analytics].[dbo].[UserSessions] WHERE SessionToken = @sid AND ExpiresAt > GETDATE()');
            
            console.log('Session get result:', result.recordset[0]); // เพิ่ม log
            const session = result.recordset[0]?.Data ? JSON.parse(result.recordset[0].Data) : null;
            console.log('Parsed session:', session); // เพิ่ม log
            
            callback(null, session);
        } catch (error) {
            console.error('Session get error:', error);
            callback(error);
        }
    }

    async set(sid, session, callback) {
        try {
            console.log('Setting session:', { sid, session }); // เพิ่ม log
            const pool = await connectSaleSql();
            // ดึง UserID จาก session
            const userId = session?.user?.id || 1; // กำหนดค่า default เป็น 1 หรือค่าที่เหมาะสม

            await pool.request()
                .input('sid', sql.NVarChar, sid)
                .input('data', sql.NVarChar, JSON.stringify(session))
                .input('expires', sql.DateTime, new Date(Date.now() + 3600000))
                .input('userId', sql.Int, userId)
                .query(`
                    MERGE [Production_Analytics].[dbo].[UserSessions] AS target
                    USING (SELECT @sid as SessionToken) AS source
                    ON target.SessionToken = source.SessionToken
                    WHEN MATCHED THEN
                        UPDATE SET 
                            Data = @data, 
                            ExpiresAt = @expires,
                            UserID = @userId
                    WHEN NOT MATCHED THEN
                        INSERT (SessionToken, Data, ExpiresAt, UserID)
                        VALUES (@sid, @data, @expires, @userId);
                `);
            callback(null);
        } catch (error) {
            console.error('Session set error:', error);
            callback(error);
        }
    }

    async destroy(sid, callback) {
        try {
            const pool = await connectSaleSql();
            await pool.request()
                .input('sid', sql.NVarChar, sid)
                .query('DELETE FROM [Production_Analytics].[dbo].[UserSessions] WHERE SessionToken = @sid');
            callback(null);
        } catch (error) {
            console.error('Session destroy error:', error);
            callback(error);
        }
    }

    touch(sid, session, callback) {
        this.set(sid, session, callback);
    }
}

module.exports = new SessionStore();