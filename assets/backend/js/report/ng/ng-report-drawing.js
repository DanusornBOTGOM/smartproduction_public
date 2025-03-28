// function calculateCumulativePOP(data) {
//     const groupedData = data.reduce((acc, item) => {
//       if (item.MachineCode.startsWith('D') && !item.MachineCode.startsWith('DW')) {
//         if (!acc[item.MachineCode]) {
//           acc[item.MachineCode] = { ActualQuantity: 0 };
//         }
//         acc[item.MachineCode].ActualQuantity += item.NgWeight || 0;
//       }
//       return acc;
//     }, {});
  
//     return Object.entries(groupedData)
//       .map(([machineCode, data]) => ({
//         MachineCode: machineCode,
//         ActualQuantity: data.ActualQuantity,
//       }))
//       .sort((a, b) => {
//         const numA = parseInt(a.MachineCode.replace('D', ''));
//         const numB = parseInt(b.MachineCode.replace('D', ''));
//         return numA - numB;
//       });
//   }
  
//   async function fetchDailyProductionData(startDateNg, endDateNg) {
//     try {
//       const url = new URL('http://192.168.1.214:5000/api/combinedDashboard');
//       url.searchParams.append('date', formatDate(startDateNg)); 
//       url.searchParams.append('section', '');
  
//       console.log('Fetching data with URL:', url.toString());
  
//       const response = await fetch(url);
      
//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error('Error response:', errorText);
//         throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
//       }
      
//       const data = await response.json();
//       console.log('Raw data from API:', data);
  
//       return data.filter(item => 
//         item.MachineCode && 
//         item.MachineCode.startsWith('D') && 
//         !item.MachineCode.startsWith('DW')
//       );
//     } catch (error) {
//       console.error('Error fetching data:', error);
//       throw error;
//     }
//   }
  
//   function formatDate(date) {
//     const d = new Date(date);
//     d.setHours(d.getHours() - 7); 
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   }
  


//   async function generateWeeklyReport(startDateNg, endDateNg) {
//     const dailyProductionData = await fetchDailyProductionData(startDateNg, endDateNg);
//     const popData = calculateCumulativePOP(dailyProductionData);
    
//     // สร้างรายงาน
//     const report = popData.map(item => ({
//       MachineCode: item.MachineCode,
//       Issues: dailyProductionData
//         .filter(d => d.MachineCode === item.MachineCode && d.Remark)
//         .map(d => `${formatDate(d.PrintTime)}: ${d.Remark}`)
//         .join('; '),
//       Solutions: '' // ต้องเพิ่มลอจิกสำหรับการแก้ไขป้องกันตามความเหมาะสม
//     }));
  
//     return report;
//   }
  
//   document.getElementById('generateReport').addEventListener('click', async () => {
//     const startDateNg = document.getElementById('startDateNg').value;
//     const endDateNg = document.getElementById('endDateNg').value;

//     const report = await generateWeeklyReport(startDateNg, endDateNg);
    
//     // แสดงผลรายงานในตาราง
//     const tableBody = document.querySelector('#reportTableNG tbody');
//     tableBody.innerHTML = '';

//     report.forEach(item => {
//         const row = `<tr>
//         <td>${startDateNg} - ${endDateNg}</td>
//         <td>${item.MachineCode}</td>
//         <td>${item.Issues}</td>
//         <td>${item.Solutions}</td>
//         </tr>`;
//         tableBody.innerHTML += row;
//     });
//     });