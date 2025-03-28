function calculateCumulativePOP(data) {
    console.log('Raw data for calculation:', data);
  
    const groupedData = data.reduce((acc, item) => {
      if (item.MachineCode.startsWith('PRO')) {  

      // ตัดส่วน suffix ออก (เช่น PRO011-1 เป็น PRO011)
      const baseMachineCode = item.MachineCode.split('-')[0];
        
        if (!acc[item.MachineCode]) {
          acc[item.MachineCode] = { 
            totalActual: 0, 
            totalPlan: 0, 
            issues: [],
            TotalDowntime: 0
          };
        }

        const actual = parseFloat(item.Actual) || 0;
        const plan = parseFloat(item.ProductionQuantity) || 0;
        const downtime = parseFloat(item.TotalDowntime) || 0;
        
        acc[item.MachineCode].totalActual += actual;
        acc[item.MachineCode].totalPlan += plan;
        acc[baseMachineCode].totalDowntime += downtime;
      }
      return acc;
    }, {});
  
    const result = Object.entries(groupedData).map(([machineCode, data]) => {
      const cumulativePOP = data.totalPlan > 0 ? (data.totalActual / data.totalPlan) * 100 : 0;

      // กำจัด issues ที่ซ้ำกัน
      const uniqueIssues = [...new Set(data.issues)];
      const issuesString = uniqueIssues.length > 0 ? uniqueIssues.join('; ') : 'ไม่มีปัญหา';

      console.log(`${machineCode}: Final calculation - Actual=${data.totalActual}, Plan=${data.totalPlan}, POP=${cumulativePOP.toFixed(1)}%`);

      return {
        MachineCode: machineCode,
        CumulativePOP: cumulativePOP,
        TotalWIPWeight: data.totalActual,
        TotalPlan: data.totalPlan,
        Issues: issuesString,
        TotalDowntime: data.totalDowntime
      };
    }).sort((a, b) => {
      const numA = parseInt(a.MachineCode.replace('PRO', ''));  
      const numB = parseInt(b.MachineCode.replace('PRO', '')); 
      return numA - numB;
    });
  
    console.log('Final calculated result:', result);
    return result;
  }
  
  async function generateWeeklyReport(startDate, endDate) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/production/weekly-report?startDate=${startDate}&endDate=${endDate}`);
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Raw API data:', data);
      
      const savedReportData = await fetchSavedWeeklyReport(startDate, endDate);
  
    // กรองและรวมข้อมูลของเครื่องจักรที่มีรหัสพื้นฐานเดียวกัน
      const filteredData = data
        .filter(item => item.MachineCode.startsWith('PRO'))
        .reduce((acc, item) => {
          const baseMachineCode = item.MachineCode.split('-')[0];
          const existingItem = acc.find(i => i.MachineCode === baseMachineCode);

          if (!existingItem) {
            acc.push({
              MachineCode: baseMachineCode,
              CumulativePOP: item.CumulativePOP || 0,
              TotalWIPWeight: item.TotalWIPWeight || 0,
              TotalPlan: item.TotalPlan || 0,
              Issues: item.Issues || 'ไม่มีข้อมูล',
              TotalDowntime: item.TotalDowntime || 0
            });
          } else {
            existingItem.TotalWIPWeight += item.TotalWIPWeight || 0;
            existingItem.TotalPlan += item.TotalPlan || 0;
            existingItem.TotalDowntime += item.TotalDowntime || 0;
          // คำนวณ CumulativePOP ใหม่
            existingItem.CumulativePOP = existingItem.TotalPlan > 0 ?
            (existingItem.TotalWIPWeight / existingItem.TotalPlan) * 100 : 0;
          }
          return acc;
        }, []);
  
        const report = filteredData.map(item => {
          const savedData = savedReportData.find(saved => 
            saved.MachineCode.split('-')[0] === item.MachineCode.split('-')[0]
          );
          return {
            ...item,
            PreventiveCorrection: savedData ? savedData.PreventiveCorrection : '',
          };
        });
    
        console.log('Processed report data:', report);
        return report;
      } catch (error) {
        console.error('Error generating weekly report:', error);
        throw error;
      }
    }

    document.getElementById('generateReport').addEventListener('click', async () => {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
  
      if (!startDate || !endDate) {
          alert('เลือกวันที่เริ่มต้นและวันที่สิ้นสุดก่อน');
          return;
      }
  
      try {
          const report = await generateWeeklyReport(startDate, endDate);
          const tableBody = document.querySelector('#reportTable tbody');
          tableBody.innerHTML = '';
  
          report.forEach((item, index) => {
              const cumulativePOP = isNaN(item.CumulativePOP) ? 0 : item.CumulativePOP;
              
              // จัดการกับการแสดงผลปัญหา
              let issuesHtml = '<div class="issue-item">ไม่มีปัญหา</div>';
              if (item.Issues && item.Issues !== 'ไม่มีปัญหา' && item.Issues !== 'ไม่มีข้อมูล') {
                  const issuesArray = item.Issues.split(';').filter(issue => issue.trim());
                  if (issuesArray.length > 0) {
                      issuesHtml = issuesArray
                          .map(issue => `<div class="issue-item">${issue.trim()}</div>`)
                          .join('');
                  }
              }
  
              const rowClass = cumulativePOP < 95 ? 'low-pop' : '';
              
              const row = document.createElement('tr');
              row.setAttribute('data-machine-code', item.MachineCode);
              row.className = rowClass;
              row.innerHTML = `
                  <td>${index === 0 ? `${startDate} - ${endDate}` : ''}</td>
                  <td>${item.MachineCode}</td>
                  <td>${cumulativePOP.toFixed(1)}%</td>
                  <td>${item.TotalWIPWeight.toFixed(1)} / ${item.TotalPlan.toFixed(1)}</td>
                  <td class="issues-cell">${issuesHtml}</td>
                  <td>${item.TotalDowntime} นาที</td>
                  <td>
                      <input type="text" 
                             class="form-control preventive-correction-input" 
                             value="${item.PreventiveCorrection || ''}" 
                             maxlength="200">
                  </td>
              `;
              tableBody.appendChild(row);
          });
  
      } catch (error) {
          console.error('Error generating report:', error);
          alert(`เกิดข้อผิดพลาดในการสร้างรายงาน: ${error.message}`);
      }
  });
  
  async function fetchSavedWeeklyReport(startDate, endDate) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/production/weekly-report?startDate=${startDate}&endDate=${endDate}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching saved weekly report:', error);
      return [];
    }
  }
  
  document.getElementById('saveAllPreventiveCorrections').addEventListener('click', saveAllPreventiveCorrections);
  
  async function saveAllPreventiveCorrections() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const rows = document.querySelectorAll('#reportTable tbody tr');
    
    const dataToSave = Array.from(rows)
      .map(row => ({
        machineCode: row.getAttribute('data-machine-code'),
        cumulativePOP: parseFloat(row.querySelector('td:nth-child(3)').textContent),
        issues: row.querySelector('td:nth-child(5)').innerHTML,
        preventiveCorrection: row.querySelector('.preventive-correction-input').value.trim()
      }))
      .filter(item => item.preventiveCorrection !== '');
  
    console.log('Data to save:', JSON.stringify(dataToSave, null, 2));
  
    try {
        const response = await fetch('http://192.168.1.214:5000/api/production/weekly-report/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          startDate, 
          endDate, 
          data: dataToSave
        }),
      });
  
      const result = await response.json();
      console.log('API response:', result);
  
      if (!response.ok) {
        throw new Error(result.error || result.details || `HTTP error! status: ${response.status}`);
      }
  
      alert('บันทึกการแก้ไขป้องกันทั้งหมดเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error saving PreventiveCorrections:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึกการแก้ไขป้องกัน: ${error.message}`);
    }
  }

  const exportWeeklyReportExcelButton = document.getElementById('exportWeeklyReportExcel');

if (exportWeeklyReportExcelButton) {
  exportWeeklyReportExcelButton.addEventListener('click', async () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
      alert('เลือกวันที่เริ่มต้นและวันที่สิ้นสุดก่อน');
      return;
    }

    try {
      await generateExcelReport(startDate, endDate);
    } catch (error) {
      console.error('Error generating Excel report:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างรายงานเป็น Excel: ${error.message}`);
    }
  });
}
  
  async function generateExcelReport(startDate, endDate) {
    try {
      const report = await generateWeeklyReport(startDate, endDate);
  
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Weekly Report');
  
      // กำหนด header ของตาราง
      worksheet.columns = [
        { header: 'ช่วงวันที่', key: 'period' },
        { header: 'รหัสเครื่องจักร', key: 'machineCode' },
        { header: 'Cumulative POP', key: 'cumulativePOP' },
        { header: 'Total WIP / Total Plan', key: 'totalWIPTotalPlan' },
        { header: 'ปัญหา', key: 'issues' },
        { header: 'เวลาหยุดเครื่อง (นาที)', key: 'totalDowntime' },
        { header: 'การแก้ไขป้องกัน', key: 'preventiveCorrection' }
      ];
  
      // เพิ่มข้อมูลรายการลงในตาราง
      report.forEach(item => {
        worksheet.addRow({
          period: startDate && endDate ? `${startDate} - ${endDate}` : '',
          machineCode: item.MachineCode,
          cumulativePOP: item.CumulativePOP.toFixed(1),
          totalWIPTotalPlan: `${item.TotalWIPWeight.toFixed(1)} / ${item.TotalPlan.toFixed(1)}`,
          issues: item.Issues,
          totalDowntime: item.TotalDowntime,
          preventiveCorrection: item.PreventiveCorrection
        });
      });
  
      // ตั้งค่าความกว้างของคอลัมน์
      worksheet.getColumn(1).width = 20;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(4).width = 20;
      worksheet.getColumn(5).width = 40;
      worksheet.getColumn(6).width = 20;
      worksheet.getColumn(7).width = 40;
  
      // สร้างไฟล์ Excel
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
  
      // สร้างลิงก์ดาวน์โหลดไฟล์
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Weekly_Report_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
      console.log('Excel report generated successfully.');
    } catch (error) {
      console.error('Error generating Excel report:', error);
      throw error;
    }
  }
  