const sql = require('mssql');
const { connectDestSql } = require('../../../config/sqldb_dbconfig');

class ApprovalRepository {
    constructor() {
        this.dbConnection = null;
    }

    async getConnection() {
        try {
            if (!this.dbConnection || !this.dbConnection.connected) {
                this.dbConnection = await connectDestSql();
            }

            return this.dbConnection;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    // ดึงรายการที่รออนุมัติ
    async getPendingApprovals(date) {
        const db = await this.getConnection();

        try {
            const request = db.request();

            if (date) {
                request.input('date', sql.DateTime, date);
            }

            const query = `
                SELECT p.ID, p.DocNo, p.Grade, p.RSNCode, p.Size, p.TimeInManual, p.TimeOutManual,
                    p.TimeInForm, p.TimeOutForm, p.PrintWeight, p.Remark, p.CreateDate,
                    u.Username as ReporterName, u.ID as ReporterID
                FROM [Production_Analytics].[dbo].[ProductionDailyLogs] p
                LEFT JOIN [Production_Analytics].[dbo].[ProductionApprovals] a
                ON p.ID = a.RecordID
                LEFT JOIN [Production_Analytics].[dbo].[Users] u
                ON a.ReporterID = u.ID
                WHERE (a.ID IS NULL OR a.ApprovalStatus = 0)
                ${date ? "AND CONVERT(date, p.CreateDate) = @date" : ""}
                ORDER BY p.CreateDate DESC
            `;
            
            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
            throw error;
        }
    }

    async createApprovalRecord(recordId, reporterId) {
        const db = await this.getConnection();
        let transaction;
    
        try {
            transaction = new sql.Transaction(db);
            await transaction.begin();
    
            // สร้างรายการอนุมัติ
            await transaction.request()
                .input('RecordID', sql.Int, recordId)
                .input('ReporterID', sql.Int, reporterId)
                .input('ApprovalStatus', sql.Int, 0) // 0 = รออนุมัติ
                .query(`
                    INSERT INTO [Production_Analytics].[dbo].[ProductionApprovals]
                    (RecordID, ReporterID, ApprovalStatus, CreatedAt)
                    VALUES (@RecordID, @ReporterID, @ApprovalStatus, GETDATE())
                `);
    
            await transaction.commit();
            return { success: true, recordId };
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('Error creating approval record:', error);
            throw error;
        }
    }

    // บันทึกการอนุมัติ
    async approveRecord(recordId, approverId, status, comment) {
        const db = await this.getConnection();

        try {
            // ตรวจสอบว่ามีข้อมูลอนุมัติแล้วรึยัง
            const checkExisting = await db.request()
                .input('RecordID', sql.Int, recordId)
                .query(`
                    SELECT COUNT(*) as count
                    FROM [Production_Analytics].[dbo].[ProductionApprovals]
                    WHERE RecordID = @RecordID
                `);

            if (checkExisting.recordset[0].count > 0) {
                return await db.request()
                    .input('RecordID', sql.Int, recordId)
                    .input('ApproverID', sql.Int, approverId)
                    .input('ApprovalStatus', sql.Int, status)
                    .input('ApprovalComment', sql.NVarChar, comment)
                    .input('ApprovalDate', sql.DateTime, new Date())
                    .input('UpdatedAt', sql.DateTime, new Date())
                    .query(`
                        UPDATE [Production_Analytics].[dbo].[ProductionApprovals]
                        SET ApproverID = @ApproverID,
                            ApprovalStatus = @ApprovalStatus,
                            ApprovalComment = @ApprovalComment,
                            ApprovalDate = @ApprovalDate,
                            UpdatedAt = @UpdatedAt
                        WHERE RecordID = @RecordID
                    `);
            } else {
                // ถ้าไม่มีเพิ่มใหม่
                return await db.request()
                    .input('RecordID', sql.Int, recordId)
                    .input('ReporterID', sql.Int, 1) // กำหนดค่าเริ่มต้น
                    .input('ApproverID', sql.Int, approverId)
                    .input('ApprovalStatus', sql.Int, status)
                    .input('ApprovalComment', sql.NVarChar, comment)
                    .input('ApprovalDate', sql.DateTime, new Date())
                    .query(`
                        INSERT INTO [Production_Analytics].[dbo].[ProductionApprovals]
                        (RecordID, ReporterID, ApproverID, ApprovalStatus, ApprovalComment, ApprovalDate, CreatedAt)
                        VALUES (@RecordID, @ReporterID, @ApproverID, @ApprovalStatus, @ApprovalComment, @ApprovalDate, GETDATE())
                    `);
            }
        } catch (error) {
            console.error('Error approving record:', error);
            throw error;
        }
    }

    // ดึงประวัติการอนุมัติ
    async getApprovalHistory(date) {
        const db = await this.getConnection();

        try {
            const request = db.request();

            if (date) {
                request.input('date', sql.DateTime, date);
            }

            const query = `
                SELECT p.ID, p.DocNo, p.Grade, p.RSNCode, p.Size, p.TimeInManual, p.TimeOutManual,
                    p.TimeInForm, p.TimeOutForm, p.PrintWeight, p.Remark, p.CreateDate,
                    a.ApprovalStatus, a.ApprovalComment, a.ApprovalDate,
                    reporter.Username as ReporterName,
                    approver.Username as ApproverName
                FROM [Production_Analytics].[dbo].[ProductionDailyLogs] p
                INNER JOIN [Production_Analytics].[dbo].[ProductionApprovals] a
                ON p.ID = a.RecordID
                LEFT JOIN [Production_Analytics].[dbo].[Users] reporter
                ON a.ReporterID = reporter.ID
                LEFT JOIN [Production_Analytics].[dbo].[Users] approver
                ON a.ApproverID = approver.ID
                WHERE a.ApprovalStatus != 0
                ${date ? "AND CONVERT(date, p.CreateDate) = @date" : ""}
                ORDER BY a.ApprovalDate DESC
            `;

            const result = await request.query(query);

            return result.recordset;
        } catch (error) {
            console.error('Error fetching approval history:', error);
            throw error;
        }
    }
}

module.exports = ApprovalRepository;
