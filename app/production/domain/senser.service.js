// const SensorRepository = require('./data-access/senser.repository');

// class SensorService {
//     constructor() {
//         this.repository = new SensorRepository();
//     }

//     // ดึงข้อมูลจาก API และบันทึกลงฐานข้อมูล
//     async fetchAndSaveSensorData(apiUrl) {
//         try {
//             // ดึงข้อมูลจาก API
//             const sensorData = await this.repository.fetchSensorDataFromAPI(apiUrl);

//             // ตรวจสอบข้อมูลก่อนบันทึก
//             if (!Array.isArray(sensorData) || sensorData.length === 0) {
//                 throw new Error('No sensor data found from API');
//             }

//             // บันทึกข้อมูล
//             await this.repository.saveSensorData(sensorData);

//             console.log('Sensor data fetched and saved successfully');
//             return { success: true, message: 'Sensor data saved successfully' };
//         } catch (error) {
//             console.error('Error in SensorService - fetchAndSaveSensorData:', error);
//             throw error;
//         }
//     }

//     // ดึงข้อมูล Sensor
//     async getSensorDataById(sensorId) {
//         try {
//             const data = await this.repository.getSensorDataById(sensorId);
//             if (!data) {
//                 throw new Error(`Sensor data with ID ${sensorId} not found`);
//             }
//             return data;
//         } catch (error) {
//             console.error('Error in SensorService - getSensorDataById:', error);
//             throw error;
//         }
//     }

// }

// module.exports = SensorService;
