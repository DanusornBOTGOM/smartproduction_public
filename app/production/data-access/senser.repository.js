// const sql = require('mssql');
// const { connectDestSql } = require('../../../config/sqldb_dbconfig');

// class SenserRepository {
//     constructor() {
//         this.dbConnection = null;
//     }

//     async getConnection() {
//         try {
//             if (!this.dbConnection || !this.dbConnection.connected) {
//                 this.dbConnection = await connectDestSql;
//             }
//             return this.dbConnection;
//         } catch (error) {
//             console.error('Database connection error:', error);
//             throw error;
//         }
//     }

//     async fetchSensorDataFromAPI(apiUrl) {
//         try {
//             const response = await fetch.get(apiUrl);
//             console.log('Fetching data from API:', response.data);

//             return response.data;
//         } catch (error) {
//             console.error('Error fetching data from API:', error)
//             throw error;
//         }
//     }

//     async saveSensorData(sensorData) {
//         const db = await this.getConnection();
//         const transaction = new sql.Transaction(db);

//         try {
//             await transaction.begin();

//             for (const data of senserData) {
//                 await transaction.request()
//                     .input('SensorId', sql.Int, data.id)
//                     .input('SensorName', sql.NVarChar(50), data.name)
//                     .input('SensorValue', sql.Float, data.value)
//                     .input('Timestamp', sql.DateTime, new Date(data.timestamp))
//                     .query(`
//                         INSERT INTO [Production_Analytics].[dbo].[SensorData]
//                         (SensorId, SensorName, SensorValue, Timestamp)
//                         VALUES (@SensorId, @SensorName, @SenSorValue, Timestamp)
//                     `);
//             }

//             await transaction.commit();
//             console.log('Sensor data saved successfully');
//         } catch (error) {
//             await transaction.rollback();
//             console.error('Error saving sensor data:', error);
//             throw error;
//         }
//     }

// }

// module.exports = SensorRepository;