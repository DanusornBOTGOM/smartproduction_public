// const SensorRepository = require('../data-access/senser.repository');
// const ProfileRepository = require('../data-access/profile.repository');
// const moment = require('moment-timezone');

// class SensorService {
//     constructor() {
//         this.sensorRepository = new SensorRepository();
//         this.profileRepository = new ProfileRepository();
//     }

//     async getMachineStatus(date) {
//         try {
//             return await this.sensorRepository.getMachineStatus(date);
//         } catch (error) {
//             console.error('Error in getMachineStatus:', error);
//             throw new Error(`Error getting machine status: ${error.message}`);
//         }
//     }

//     async getMachineDowntimes(date, machineCode) {
//         try {
//             const downtimes = await this.sensorRepository.getMachineDowntimes(date, machineCode);
            
//             return downtimes.map(downtime => {
//                 // แปลง device_id เป็น MachineCode
//                 const deviceParts = downtime.device_id.split('_');
//                 const machineCode = deviceParts.length > 1 ? deviceParts[1].toUpperCase() : downtime.device_id;
                
//                 // แปลงข้อมูลให้ตรงกับรูปแบบของ Causes ที่ใช้ในระบบปัจจุบัน
//                 return {
//                     description: `Sensor detected downtime`,
//                     downtime: Math.round(downtime.duration_minutes) || 0,
//                     notes: downtime.notes || '',
//                     breakdownId: downtime.id.toString(),
//                     id: null,
//                     source: 'sensor',
//                     machineCode: machineCode,
//                     startTime: downtime.start_time,
//                     endTime: downtime.end_time,
//                     is_active: downtime.is_active
//                 };
//             });
//         } catch (error) {
//             console.error('Error in getMachineDowntimes:', error);
//             throw new Error(`Error getting machine downtimes: ${error.message}`);
//         }
//     }

//     async syncSensorDowntimesToBreakdowns(date) {
//         try {
//             // ดึงข้อมูล downtime จาก sensor ทั้งหมดในวันที่กำหนด
//             const sensorDowntimes = await this.sensorRepository.getMachineDowntimes(date);
            
//             // กรองเฉพาะ downtimes ที่มีระยะเวลาอย่างน้อย 5 นาที
//             const significantDowntimes = sensorDowntimes.filter(
//                 downtime => downtime.duration_minutes >= 5
//             );
            
//             // ดึงข้อมูล breakdowns ที่มีอยู่ในระบบ
//             const existingBreakdowns = await this.profileRepository.getBreakdownsByDate(date);
            
//             // สร้าง array สำหรับเก็บรายการ downtimes ที่ต้องเพิ่มใน breakdowns
//             const downtimesToAdd = [];
            
//             // ตรวจสอบแต่ละ downtime ว่ามีอยู่ใน breakdowns แล้วหรือไม่
//             for (const downtime of significantDowntimes) {
//                 const deviceParts = downtime.device_id.split('_');
//                 if (deviceParts.length <= 1) continue;
                
//                 const machineCode = deviceParts[1].toUpperCase();
//                 const breakdownId = downtime.id.toString();
                
//                 // ตรวจสอบว่ามี breakdown นี้อยู่แล้วหรือไม่
//                 const existingBreakdown = existingBreakdowns.find(
//                     b => b.MachineCode === machineCode && 
//                          b.breakdownId === breakdownId && 
//                          b.SourceType === 'sensor'
//                 );
                
//                 // ถ้ายังไม่มี หรือข้อมูลมีการเปลี่ยนแปลง ให้เพิ่มในรายการที่ต้องอัพเดท
//                 if (!existingBreakdown || 
//                     existingBreakdown.Downtime !== Math.round(downtime.duration_minutes) ||
//                     (existingBreakdown.EndTime !== downtime.end_time && !downtime.is_active)) {
                    
//                     downtimesToAdd.push({
//                         machineCode: machineCode,
//                         breakdownId: breakdownId,
//                         date: date,
//                         description: 'Sensor detected downtime',
//                         downtime: Math.round(downtime.duration_minutes),
//                         notes: downtime.notes || '',
//                         source: 'sensor',
//                         startTime: downtime.start_time,
//                         endTime: downtime.end_time,
//                         is_active: downtime.is_active
//                     });
//                 }
//             }
            
//             // บันทึกข้อมูล downtimes ลงในตาราง BreakdownMaster
//             if (downtimesToAdd.length > 0) {
//                 await this.profileRepository.saveSensorBreakdowns(downtimesToAdd);
//             }
            
//             return {
//                 success: true,
//                 syncedCount: downtimesToAdd.length,
//                 date: date
//             };
//         } catch (error) {
//             console.error('Error syncing sensor downtimes:', error);
//             throw new Error(`Error syncing sensor downtimes: ${error.message}`);
//         }
//     }
// }

// module.exports = SensorService;