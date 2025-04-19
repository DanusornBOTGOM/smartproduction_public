const session = require('express-session');
const sql = require('mssql');
const { connectSaleSql } = require('./sqldb_dbconfig');

class CustomSessionStore extends session.Store {
    constructor() {
        super();
        this.db = null;
        this.init();
    }

    async init() {
        try {
            this.db = await connectSaleSql();
        } catch (err) {
            console.error('Session store connection error:', err);
        }
    }

    async get(sid, callback) {
        try {
            const result = await this.db.request()
                .input('sessionId', sql.NVarChar, sid)
                .input('now', sql.DateTime, new Date())
                .query(`
                    SELECT SessionToken
                    FROM [Production_Analytics].[dbo].[UserSessions]
                    WHERE SessionToken = @sessionId
                    AND ExpiresAt > @now
                `);
            
            if (!result.recordset[0]) {
                return callback(null, null);
            }
            
            callback(null, JSON.parse(result.recordset[0].SessionToken));
        } catch (err) {
            callback(err);
        }
    }

    async set(sid, session, callback) {
        try {
            const maxAge = session.cookie.maxAge;
            const expiresAt = new Date(Date.now() + maxAge);
            const userId = session.user?.id || 1; // ใส่ default value เป็น 1 หรือค่าที่เหมาะสม
    
            await this.db.request()
                .input('sessionId', sql.NVarChar, sid)
                .input('sessionData', sql.NVarChar, JSON.stringify(session))
                .input('userId', sql.Int, userId)
                .input('expiresAt', sql.DateTime, expiresAt)
                .query(`
                    MERGE [Production_Analytics].[dbo].[UserSessions] AS target
                    USING (SELECT @sessionId AS SessionToken) AS source
                    ON target.SessionToken = source.SessionToken
                    WHEN MATCHED THEN
                        UPDATE SET 
                            UserID = @userId,
                            SessionToken = @sessionData,
                            ExpiresAt = @expiresAt
                    WHEN NOT MATCHED THEN
                        INSERT (UserID, SessionToken, ExpiresAt)
                        VALUES (@userId, @sessionData, @expiresAt);
                `);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    async destroy(sid, callback) {
        try {
            await this.db.request()
                .input('sessionId', sql.NVarChar, sid)
                .query(`
                    DELETE FROM [Production_Analytics].[dbo].[UserSessions]
                    WHERE SessionToken = @sessionId
                `);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = CustomSessionStore;