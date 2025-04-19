// const { pool } = require('pg');
// const moment = require('moment-timezone');

// class SensorRepository {
//     constructor() {
//         this.pgPool = new Pool({
//             user: 'postgres',
//             host: '192.168.1.173',
//             database: 'sensor_data',
//             password: 'password',
//             port: 5433,
//         });
//     }

//     async getMachineStatus(date) {
//         try {
//             // คำนวนช่วงเวลา
//             const startTime = moment.tz(date, 'Asia/Bangkok').set({hour: 8, minute: 0, second: 0});
//             const endTime = moment.tz(date, 'Asia/Bangkok').add(1, 'days').set({hour: 8, minute: 0, second: 0});

//             // ดึงข้อมูลล่าสุดสำหรับแต่ละอุปกรณ์
//             const query = `
//                 WITH latest_readings AS (
//                     SELECT DISTINCT ON (device_id)
//                         device_id,
//                         time,
//                         value,
//                         payload
//                     FROM sensor_data
//                 WHERE
//                     time >= $1
//                     AND time <= $2
//                     AND device_id LIKE 'device_%'
//                 ORDER BY
//                     device_id, time DESC
//                 )
//                 SELECT * FROM latest_readings
//             `;

//             const result = await this.pgPool.query(query, [startTime.toISOString(), endTime.toISOString()]);

//             // แปลงข้อมูลเป็นรูปแบบที่ใช้งานง่าย
//             const sensorStatus = {};
//             result.rows.forEach(row => {
//                 // แปลง device_id (เช่น device_pro003) เป็น MachineCode (เช่น PRO003)
//                 const deviceParts = row.device_id.split('_');
//                 if (deviceParts.length > 1) {
//                     const machineCode = deviceParts[1].toUpperCase();
//                     sensorStatus[machineCode] = {
//                         time: row.time,
//                         value: row.value,
//                         payload: row.payload
//                     };
//                 }
//             });

//             return sensorStatus;
//         } catch (error) {
//             console.error('Error fetching machine status:', error);
//             throw error;
//         }
//     }

//     async getMachineDowntimes(date, machineCode = null) {
//         try {
//             // คำนวณช่วงเวลา
//             const startTime = moment.tz(date, 'Asia/Bangkok').set({hour: 8, minute: 0, second: 0});
//             const endTime = moment.tz(date, 'Asia/Bangkok').add(1, 'days').set({hour: 8, minute: 0, second: 0});
           
//             // สร้างเงื่อนไขในการกรอง device_id
//             let deviceFilter = '';
//             if (machineCode) {
//                 const deviceId = `device_${machineCode.toLowerCase()}`;
//                 deviceFilter = `AND device_id = '${deviceId}'`;
//             }

//             // ดึงข้อมูลเวลาเครื่องหยุดทำงาน
//             const query = `
//                 SELECT
//                     id,
//                     device_id,
//                     start_time,
//                     CASE
//                         WHEN end_time IS NULL THEN LEAST(NOW(), $2::timestamp)
//                         ELSE end_time
//                     END AS end_time,
//                     CASE
//                         WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (LEAST(NOW(), $2::timestamp) - start_time)) / 60
//                         ELSE duration_minutes
//                     END AS duration_minutes,
//                     is_active,
//                     cause,
//                     notes
//                 FROM 
//                     machine_downtime_tracking
//                 WHERE 
//                     start_time >= $1
//                     AND (end_time <= $2 OR end_time IS NULL)
//                     ${deviceFilter}
//                 ORDER BY 
//                     start_time ASC
//             `;

//             const result = await this.pgPool.query(query, [startTime.toISOString(), endTime.toISOString()]);
            
//             return result.rows;
//         } catch (error) {
//             console.error('Error fetching machine downtimes:', error);
//             throw error;
//         }
//     }
// }

// module.exports = SensorRepository;