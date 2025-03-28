async function fetchWeeklyProductionData(startDate, endDate) {
  try {
      const url = new URL('http://192.168.1.214:5000/api/weeklyProductionDataCGM');  // เปลี่ยนเป็น weeklyProductionDataCGM
      url.searchParams.append('startDate', startDate);
      url.searchParams.append('endDate', endDate);

      console.log('Fetching data with URL:', url.toString());

      const response = await fetch(url);
      
      if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Raw data from API:', data);
      return data;
  } catch (error) {
      console.error('Error fetching production data:', error);
      throw error;
  }
}
  
function calculateCumulativePOP(data) {
  console.log('Raw data for calculation:', data);

  const groupedData = data.reduce((acc, item) => {
    if (item.MachineCode.startsWith('CGM')) {
      if (!acc[item.MachineCode]) {
        acc[item.MachineCode] = { totalAdjustedActual: 0, totalPlan: 0, issues: [] };
      }
      const adjustedActual = parseFloat(item.AdjustedActualQuantity) || 0;
      const plan = parseFloat(item.PlanQuantity) || 0;
      
      acc[item.MachineCode].totalAdjustedActual += adjustedActual;
      acc[item.MachineCode].totalPlan += plan;

      console.log(`${item.MachineCode}: AdjustedActual=${adjustedActual}, Plan=${plan}, Running total: AdjustedActual=${acc[item.MachineCode].totalAdjustedActual}, Plan=${acc[item.MachineCode].totalPlan}`);
    }
    return acc;
  }, {});

  console.log('Grouped data:', groupedData);

  const result = Object.entries(groupedData).map(([machineCode, data]) => {
    const cumulativePOP = data.totalPlan > 0 ? (data.totalAdjustedActual / data.totalPlan) * 100 : 0;
    console.log(`${machineCode}: Final calculation - AdjustedActual=${data.totalAdjustedActual}, Plan=${data.totalPlan}, POP=${cumulativePOP.toFixed(1)}%`);
    return {
      MachineCode: machineCode,
      CumulativePOP: cumulativePOP,
      TotalAdjustedActual: data.totalAdjustedActual,
      TotalPlan: data.totalPlan,
      Issues: data.issues
    };
  }).sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

  console.log('Final calculated result:', result);
  return result;
}

async function generateWeeklyReport(startDate, endDate) {
  try {
      const chartData = await fetchWeeklyProductionData(startDate, endDate);
      const weeklyReportResponse = await fetch(`http://192.168.1.214:5000/api/weeklyReport?startDate=${startDate}&endDate=${endDate}&machineCodePrefix=CGM`);
      
      if (!weeklyReportResponse.ok) {
          const errorText = await weeklyReportResponse.text();
          throw new Error(`HTTP error! status: ${weeklyReportResponse.status}, message: ${errorText}`);
      }
      
      const weeklyReportData = await weeklyReportResponse.json();
      console.log('Weekly Report API data:', weeklyReportData);
      
      const savedReportData = await fetchSavedWeeklyReport(startDate, endDate);

      // รวมข้อมูลจากทั้งสอง API
      const combinedData = chartData.map(item => {
          const weeklyItem = weeklyReportData.find(w => w.MachineCode === item.MachineCode) || {};
          const savedData = savedReportData.find(s => s.MachineCode === item.MachineCode) || {};
          
          // คำนวณ CumulativePOP โดยใช้ AdjustedActualQuantity
          const cumulativePOP = item.PlanQuantity > 0 ? (item.AdjustedActualQuantity / item.PlanQuantity * 100) : 0;
          
          return {
              MachineCode: item.MachineCode,
              CumulativePOP: cumulativePOP,
              TotalAdjustedActual: item.AdjustedActualQuantity || 0,
              TotalPlan: item.PlanQuantity || 0,
              Issues: weeklyItem.Issues || 'ไม่มีปัญหา',
              TotalDowntime: weeklyItem.TotalDowntime || 0,
              PreventiveCorrection: savedData.PreventiveCorrection || '',
          };
      });

      // กรองและเรียงลำดับข้อมูล
      const filteredData = combinedData
          .filter(item => item.MachineCode.startsWith('CGM'))
          .sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

      console.log('Generated report data:', filteredData);
      return filteredData;
  } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
  }
}

function updateReportTable(report, startDate, endDate) {
  const table = document.getElementById('reportTable');
  if (!table) {
      console.error('Report table not found');
      return;
  }

  const tableBody = table.querySelector('tbody') || table.createTBody();
  tableBody.innerHTML = '';

  report.forEach((item, index) => {
      const cumulativePOP = isNaN(item.CumulativePOP) || !isFinite(item.CumulativePOP) ? 0 : item.CumulativePOP;
      
      let issuesHtml = '<div class="issue-item">ไม่มีปัญหา</div>';
      if (item.Issues && item.Issues !== 'ไม่มีปัญหา' && item.Issues !== 'ไม่มีข้อมูล') {
          if (typeof item.Issues === 'string') {
              const issuesArray = item.Issues.split('\n');
              issuesHtml = issuesArray.map(issue => `<div class="issue-item">${issue.trim()}</div>`).join('');
          } else if (Array.isArray(item.Issues)) {
              issuesHtml = item.Issues.map(issue => `<div class="issue-item">${issue}</div>`).join('');
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
          <td>${item.TotalAdjustedActual.toFixed(1)} / ${item.TotalPlan.toFixed(1)}</td>
          <td class="issues-cell">${issuesHtml}</td>
          <td>${item.TotalDowntime} นาที</td>
          <td><input type="text" class="form-control preventive-correction-input" value="${item.PreventiveCorrection || ''}" maxlength="200"></td>
      `;
      tableBody.appendChild(row);
  });

  console.log('Table updated with report data');
}
  
  async function fetchSavedWeeklyReport(startDate, endDate) {
    try {
      const response = await fetch(`http://192.168.1.214:5000/api/getWeeklyReport?startDate=${startDate}&endDate=${endDate}`);
      
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
      const response = await fetch('http://192.168.1.214:5000/api/saveAllWeeklyReportPreventiveCorrections', {
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

function setupEventListeners() {
  const generateReportButton = document.getElementById('generateReport');
  if (generateReportButton) {
      generateReportButton.addEventListener('click', handleGenerateReport);
  } else {
      console.error('Generate report button not found');
  }

  const saveAllButton = document.getElementById('saveAllPreventiveCorrections');
  if (saveAllButton) {
      saveAllButton.addEventListener('click', saveAllPreventiveCorrections);
  } else {
      console.error('Save all button not found');
  }

  const exportWeeklyReportExcelButton = document.getElementById('exportWeeklyReportExcel');
  if (exportWeeklyReportExcelButton) {
      exportWeeklyReportExcelButton.addEventListener('click', exportWeeklyReportToExcel);
  } else {
      console.log("Export Weekly Report Excel button not found, skipping event listener");
  }
}

async function handleGenerateReport() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  if (!startDate || !endDate) {
      alert('เลือกวันที่เริ่มต้นและวันที่สิ้นสุดก่อน');
      return;
  }

  try {
      const report = await generateWeeklyReport(startDate, endDate);
      updateReportTable(report, startDate, endDate);
  } catch (error) {
      console.error('Error generating report:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างรายงาน: ${error.message}`);
  }
}

// เรียกใช้ setupEventListeners เมื่อ DOM โหลดเสร็จ
document.addEventListener("DOMContentLoaded", setupEventListeners);

async function exportWeeklyReportToExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Weekly CGM Report');

  // กำหนด columns
  worksheet.columns = [
      { header: 'วันที่', key: 'date', width: 20 },
      { header: 'MachineCode', key: 'machineCode', width: 15 },
      { header: '%POP สะสม', key: 'cumulativePOP', width: 15, style: { numFmt: '0.00%' } },
      { header: 'Actual', key: 'actual', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Plan', key: 'plan', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'ปัญหา', key: 'issues', width: 30 },
      { header: 'เวลาที่สูญเสีย (นาที)', key: 'downtime', width: 20 },
      { header: 'การแก้ไขป้องกัน', key: 'preventiveCorrection', width: 30 }
  ];

  // Style สำหรับ header
  const headerStyle = {
      font: { 
          bold: true, 
          color: { argb: 'FFFFFFFF' },
          size: 12
      },
      fill: { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: 'FF4F81BD' } 
      },
      alignment: { 
          vertical: 'middle', 
          horizontal: 'center', 
          wrapText: true 
      },
      border: {
          top: { style: 'thick', color: { argb: 'FF000000' } },
          left: { style: 'thick', color: { argb: 'FF000000' } },
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
          right: { style: 'thick', color: { argb: 'FF000000' } }
      }
  };

  // เพิ่ม header และจัด style
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
      cell.style = headerStyle;
  });

  const table = document.getElementById('reportTable');
  const rows = table.querySelectorAll('tbody tr');
  let dateRange = '';

  rows.forEach((row, index) => {
      const cells = row.cells;
      if (index === 0) {
          dateRange = cells[0].textContent;
      }

      const dataRow = worksheet.addRow({
          date: index === 0 ? dateRange : '',
          machineCode: cells[1].textContent,
          cumulativePOP: parseFloat(cells[2].textContent) / 100,
          actual: parseFloat(cells[3].textContent.split('/')[0]),
          plan: parseFloat(cells[3].textContent.split('/')[1]),
          issues: cells[4].textContent,
          downtime: parseInt(cells[5].textContent),
          preventiveCorrection: cells[6].querySelector('input').value
      });

      // Style สำหรับแถวข้อมูล
      dataRow.eachCell((cell, colNumber) => {
          cell.alignment = { 
              vertical: 'middle', 
              horizontal: colNumber > 2 ? 'right' : 'left', 
              wrapText: true 
          };
          
          // เพิ่มเส้นขอบหนา
          cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
          };

          // Font
          cell.font = { 
              size: 11,
              name: 'Arial'
          };
      });

      // สีสำหรับคอลัมน์ %POP
      const popValue = parseFloat(cells[2].textContent);
      if (popValue < 95) {
          dataRow.getCell(3).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFF6347' } // สีแดง
          };
      } else {
          dataRow.getCell(3).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF90EE90' } // สีเขียว
          };
      }
  });

  // การตั้งค่าเพิ่มเติมสำหรับเอกสาร
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]; // แช่แข็งแถว header

  // ส่วนที่เหลือเหมือนเดิม
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `weekly_cgm_report_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
