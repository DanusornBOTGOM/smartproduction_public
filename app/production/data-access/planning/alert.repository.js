// // alert.repository.js
// const sql = require('mssql');
// const { connectDestSql } = require('../../../../config/sqldb_dbconfig');

// class AlertRepository {
//     constructor() {
//         this.dbConnection = null;
//     }

//     async getConnection() {
//         try {
//             if (!this.dbConnection || !this.dbConnection.connected) {
//                 this.dbConnection = await connectDestSql();
//             }
//             return this.dbConnection;
//         } catch (error) {
//             console.error('Database connection error:', error);
//             throw error;
//         }
//     }

//     async getAlerts(status) {
//         try {
//             const db = await this.getConnection();
//             const query = `
//                 SELECT 
//                     a.Id,
//                     a.MfgId,
//                     a.AlertType,
//                     a.Message,
//                     a.SuggestedActions,
//                     a.IsResolved,
//                     a.ResolutionNotes,
//                     a.CreatedAt,
//                     a.UpdatedAt,
//                     o.CustomerName,
//                     o.DeliveryDate,
//                     p.ProductName
//                 FROM 
//                     [Production_Analytics].[dbo].[Alerts] a
//                 JOIN
//                     [Production_Analytics].[dbo].[OrderMaster] o ON a.MfgId = o.MfgId
//                 JOIN
//                     [Production_Analytics].[dbo].[ProductMaster] p ON o.ProductId = p.ProductId
//                 WHERE 
//                     1=1
//                     ${status ? `AND a.IsResolved = ${status === 'resolved' ? '1' : '0'}` : ''}
//                 ORDER BY
//                     a.CreatedAt DESC
//             `;

//             const result = await db.request().query(query);
            
//             // Parse suggested actions if they're stored as JSON
//             const alerts = result.recordset.map(alert => {
//                 try {
//                     if (alert.SuggestedActions) {
//                         alert.SuggestedActions = JSON.parse(alert.SuggestedActions);
//                     } else {
//                         alert.SuggestedActions = [];
//                     }
//                 } catch (e) {
//                     console.error('Error parsing suggested actions:', e);
//                     alert.SuggestedActions = [];
//                 }
//                 return alert;
//             });

//             return alerts;
//         } catch (error) {
//             console.error('Error in getAlerts repository:', error);
//             throw new Error(`Failed to get alerts: ${error.message}`);
//         }
//     }

//     async getAlertById(alertId) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('alertId', sql.Int, alertId)
//                 .query(`
//                     SELECT 
//                         a.Id,
//                         a.MfgId,
//                         a.AlertType,
//                         a.Message,
//                         a.SuggestedActions,
//                         a.IsResolved,
//                         a.ResolutionNotes,
//                         a.CreatedAt,
//                         a.UpdatedAt
//                     FROM 
//                         [Production_Analytics].[dbo].[Alerts] a
//                     WHERE
//                         a.Id = @alertId
//                 `);
            
//             if (result.recordset.length === 0) {
//                 return null;
//             }

//             const alert = result.recordset[0];
//             // Parse suggested actions if stored as JSON
//             try {
//                 if (alert.SuggestedActions) {
//                     alert.SuggestedActions = JSON.parse(alert.SuggestedActions);
//                 } else {
//                     alert.SuggestedActions = [];
//                 }
//             } catch (e) {
//                 console.error('Error parsing suggested actions:', e);
//                 alert.SuggestedActions = [];
//             }
            
//             return alert;
//         } catch (error) {
//             console.error('Error in getAlertById repository:', error);
//             throw new Error(`Failed to get alert by ID: ${error.message}`);
//         }
//     }

//     async createAlert(alertData) {
//         try {
//             const db = await this.getConnection();
//             const suggestedActionsJSON = JSON.stringify(alertData.suggestedActions || []);
            
//             const result = await db.request()
//                 .input('MfgId', sql.NVarChar, alertData.mfgId)
//                 .input('AlertType', sql.NVarChar, alertData.type)
//                 .input('Message', sql.NVarChar, alertData.message)
//                 .input('SuggestedActions', sql.NVarChar(sql.MAX), suggestedActionsJSON)
//                 .query(`
//                     INSERT INTO [Production_Analytics].[dbo].[Alerts]
//                     (MfgId, AlertType, Message, SuggestedActions, IsResolved, CreatedAt)
//                     VALUES (@MfgId, @AlertType, @Message, @SuggestedActions, 0, GETDATE());
                    
//                     SELECT SCOPE_IDENTITY() AS AlertId;
//                 `);
            
//             const alertId = result.recordset[0].AlertId;
            
//             return {
//                 id: alertId,
//                 ...alertData
//             };
//         } catch (error) {
//             console.error('Error in createAlert repository:', error);
//             throw new Error(`Failed to create alert: ${error.message}`);
//         }
//     }

//     async updateAlertStatus(alertId, action, notes) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('AlertId', sql.Int, alertId)
//                 .input('ResolutionNotes', sql.NVarChar, notes || '')
//                 .input('IsResolved', sql.Big, action)
//                 .query(`
//                     UPDATE [Production_Analytics].[dbo].[Alerts]
//                     SET IsResolved = @IsResolved,
//                         ResolutionNotes = @ResolutionNotes,
//                         UpdatedAt = GETDATE()
//                     WHERE Id = @AlertId;

//                     SELECT @@ROWCOUNT AS AffectedRows;

//                     SELECT 
//                         Id, MfgId, AlertType, Message, SuggestedActions, 
//                         IsResolved, ResolutionNotes, CreatedAt, UpdatedAt
//                     FROM 
//                         [Production_Analytics].[dbo].[Alerts]
//                     WHERE 
//                         Id = @AlertId;
//                 `);

//             if (result.recordset[0].AffectedRows === 0) {
//                 throw new Error(`Alert with ID ${alertId} not found`);
//             }

//             const updatedAlert = result.recordsets[1][0];
//             // Parse suggested actions if stored as JSON
//             try {
//                 if (updatedAlert.SuggestedActions) {
//                     updatedAlert.SuggestedActions = JSON.parse(updatedAlert.SuggestedActions);
//                 } else {
//                     updatedAlert.SuggestedActions = [];
//                 }
//             } catch (e) {
//                 console.error('Error parsing suggested actions:', e);
//                 updatedAlert.SuggestedActions = [];
//             }
            
//             return updatedAlert;
//         } catch (error) {
//             console.error('Error in updateAlertStatus repository:', error);
//             throw new Error(`Failed to update alert status: ${error.message}`);
//         }
//     }

//     async countActiveAlertsByType() {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .query(`
//                     SELECT
//                         AlertType,
//                         COUNT(*) AS AlertCount
//                     FROM 
//                         [Production_Analytics].[dbo].[Alerts]
//                     WHERE 
//                         IsResolved = 0
//                     GROUP BY
//                         AlertType
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in countActiveAlertsByType repository:', error);
//             throw new Error(`Failed to count active alerts by type: ${error.message}`);
//         }
//     }

//     async getRecentAlerts(limit = 10) {
//         try {
//             const db = await this.getConnection();
//             const result = await db.request()
//                 .input('Limit', sql.Int, limit)
//                 .query(`
//                     SELECT TOP (@Limit)
//                         a.Id,
//                         a.MfgId,
//                         a.AlertType,
//                         a.Message,
//                         a.IsResolved,
//                         a.CreatedAt,
//                         o.CustomerName,
//                         p.ProductName
//                     FROM
//                         [Production_Analytics].[dbo].[Alerts] a
//                     JOIN
//                         [Production_Analytics].[dbo].[OrderMaster] o ON a.MfgId = o.MfgId 
//                     JOIN
//                         [Production_Analytics].[dbo].[ProductMaster] p ON o.ProductId = p.ProductId
//                     ORDER BY
//                         a.CreatedAt DESC
//                 `);
            
//             return result.recordset;
//         } catch (error) {
//             console.error('Error in getRecentAlerts repository:', error);
//             throw new Error(`Failed to get recent alerts: ${error.message}`);
//         }
//     }



// }