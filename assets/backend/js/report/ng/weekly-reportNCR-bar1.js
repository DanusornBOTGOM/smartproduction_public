function calculateCumulativePOP(data) {
  console.log('Raw data for calculation:', data);

  const groupedData = data.reduce((acc, item) => {
    // ใช้ startsWith เฉพาะ COM ส่วนเครื่องอื่นใช้การเปรียบเทียบโดยตรง
    if (item.MachineCode.startsWith('COM') || 
        item.MachineCode === 'CUT022' ||
        item.MachineCode === 'ANB001' ||
        item.MachineCode === 'STN004' ||
        item.MachineCode === 'TWR001') {  

      const baseMachineCode = item.MachineCode.split('-')[0];
      
      if (!acc[item.MachineCode]) {
        acc[item.MachineCode] = { 
          totalActual: 0, 
          totalPlan: 0, 
          issues: []
        };
      }

      const actual = parseFloat(item.Actual) || 0;
      const plan = parseFloat(item.ProductionQuantity) || 0;
      
      acc[item.MachineCode].totalActual += actual;
      acc[item.MachineCode].totalPlan += plan;
    }
    return acc;
  }, {});

  const result = Object.entries(groupedData).map(([machineCode, data]) => {
    const cumulativePOP = data.totalPlan > 0 ? (data.totalActual / data.totalPlan) * 100 : 0;

    const uniqueIssues = [...new Set(data.issues)];
    const issuesString = uniqueIssues.length > 0 ? uniqueIssues.join('; ') : 'ไม่มีปัญหา';

    console.log(`${machineCode}: Final calculation - Actual=${data.totalActual}, Plan=${data.totalPlan}, POP=${cumulativePOP.toFixed(1)}%`);

    return {
      MachineCode: machineCode,
      CumulativePOP: cumulativePOP,
      TotalWIPWeight: data.totalActual,
      TotalPlan: data.totalPlan,
      Issues: issuesString
    };
  }).sort((a, b) => {
    const machineTypes = {
      'COM': 1,
      'CUT022': 2,
      'ANB001': 3,
      'STN004': 4,
      'TWR001': 5
    };
    
    // ปรับการเรียงลำดับให้เหมาะกับรูปแบบใหม่
    if (a.MachineCode.startsWith('COM') && b.MachineCode.startsWith('COM')) {
      // ถ้าเป็น COM ทั้งคู่ ให้เรียงตามเลขเครื่อง
      const numA = parseInt(a.MachineCode.replace('COM', ''));
      const numB = parseInt(b.MachineCode.replace('COM', ''));
      return numA - numB;
    } else {
      // ถ้าไม่ใช่ COM ให้เรียงตามลำดับที่กำหนด
      const typeA = a.MachineCode.startsWith('COM') ? 'COM' : a.MachineCode;
      const typeB = b.MachineCode.startsWith('COM') ? 'COM' : b.MachineCode;
      return (machineTypes[typeA] || 99) - (machineTypes[typeB] || 99);
    }
  });

  console.log('Final calculated result:', result);
  return result;
}

async function generateWeeklyReport(startDate, endDate) {
  try {
      const response = await fetch(`http://192.168.1.214:5000/api/weeklyReportNCRbar1?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      const data = await response.json();
      
      const savedReportData = await fetchSavedWeeklyReport(startDate, endDate);

      const filteredData = data
          .filter(item => 
              item.MachineCode.startsWith('COM') ||
              item.MachineCode === 'CUT022' ||
              item.MachineCode === 'ANB001' ||
              item.MachineCode === 'STN004' ||
              item.MachineCode === 'TWR001'
          )
          .reduce((acc, item) => {
              const baseMachineCode = item.MachineCode.split('-')[0];
              const existingItem = acc.find(i => i.MachineCode === baseMachineCode);
              const savedItem = savedReportData.find(s => s.MachineCode === baseMachineCode);

              if (!existingItem) {
                  acc.push({
                      MachineCode: baseMachineCode,
                      NCRQuantity: item.TotalNGWeight || 0,
                      Issues: item.Issues || 'ไม่มีข้อมูล',
                      PreventiveCorrection: savedItem ? savedItem.PreventiveCorrection : ''
                  });
              } else {
                  existingItem.NCRQuantity += item.TotalNGWeight || 0;
                  if (item.Issues && item.Issues !== 'ไม่มีข้อมูล' && item.Issues !== existingItem.Issues) {
                      existingItem.Issues = existingItem.Issues === 'ไม่มีข้อมูล' ? 
                          item.Issues : `${existingItem.Issues}; ${item.Issues}`;
                  }
                  if (!existingItem.PreventiveCorrection && savedItem) {
                      existingItem.PreventiveCorrection = savedItem.PreventiveCorrection;
                  }
              }
              return acc;
          }, []);

      console.log('Processed report data:', filteredData);
      return filteredData;
  } catch (error) {
      console.error('Error:', error);
      throw error;
  }
}

document.getElementById('generateReportNcr').addEventListener('click', async () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('เลือกวันที่เริ่มต้นและวันที่สิ้นสุดก่อน');
        return;
    }

    try {
        const report = await generateWeeklyReport(startDate, endDate);
        const tableBody = document.querySelector('#reportTableNcr tbody');
        tableBody.innerHTML = '';

        report.forEach((item, index) => {
            let issuesHtml = '<div class="issue-item">ไม่มีปัญหา</div>';
            if (item.Issues && item.Issues !== 'ไม่มีข้อมูล' && item.Issues !== 'ไม่มีปัญหา') {
              const issuesArray = item.Issues.split(';').map(issue => issue.trim());
              issuesHtml = issuesArray
                  .map(issue => `<div class="issue-item">${issue}</div>`)
                  .join('');
          }

            const row = `<tr data-machine-code="${item.MachineCode}">
                <td>${index === 0 ? `${startDate} - ${endDate}` : ''}</td>
                <td>${item.MachineCode}</td>
                <td>${item.NCRQuantity.toFixed(1)}</td>
                <td class="issues-cell">${issuesHtml}</td>
                <td><input type="text" class="form-control preventive-correction-input" 
                    value="${item.PreventiveCorrection || ''}" maxlength="200"></td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
});
  
  async function fetchSavedWeeklyReport(startDate, endDate) {
    try {
      const response = await fetch(`http://192.168.1.214:5000/api/getWeeklyReportNCR?startDate=${startDate}&endDate=${endDate}`);
      
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
  
  document.getElementById('saveAllPreventiveCorrectionsNcr').addEventListener('click', saveAllPreventiveCorrections);
  
  async function saveAllPreventiveCorrections() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const rows = document.querySelectorAll('#reportTableNcr tbody tr');
    
    const dataToSave = Array.from(rows)
        .map(row => ({
            machineCode: row.getAttribute('data-machine-code'),
            ncrQuantity: parseFloat(row.querySelector('td:nth-child(3)').textContent),
            issues: row.querySelector('td:nth-child(4)').innerHTML,
            preventiveCorrection: row.querySelector('.preventive-correction-input').value.trim()
        }))
        .filter(item => item.preventiveCorrection !== '');

    try {
        const response = await fetch('http://192.168.1.214:5000/api/saveWeeklyReportNCR', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, data: dataToSave }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (error) {
        console.error('Error:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
}

document.getElementById('exportExcelNCR').addEventListener('click', exportToExcel);
async function exportToExcel() {
  const table = document.getElementById('reportTableNcr');
  const rows = table.querySelectorAll('tbody tr');

  if (rows.length === 0) {
    alert('ไม่มีข้อมูลให้ Export');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('รายงานของเสีย');

  // กำหนด header
  worksheet.columns = [
    { header: 'วันที่', key: 'date', width: 25 },
    { header: 'เครื่องจักร', key: 'machine' },
    { header: 'ของเสียสะสม(NCR)', key: 'ncr', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'ปัญหา(น้ำหนัก, วันที่ยิงออก)', key: 'issues', width: 35 },
    { header: 'การแก้ไขป้องกัน', key: 'correction', width: 30 }
];


  // style สำหรับ header
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


    // เพิ่มข้อมูลจาก table
  // เพิ่มข้อมูลจาก table
  rows.forEach(row => {
    // ดึงข้อมูลปัญหาจาก innerHTML เพื่อให้ได้ข้อความที่แท้จริง
    const issuesCell = row.querySelector('td:nth-child(4)');
    const issuesText = Array.from(issuesCell.querySelectorAll('.issue-item'))
      .map(item => item.textContent)
      .filter(text => text.trim() !== '')
      .join('\n');  // ใช้ '\n' เพื่อขึ้นบรรทัดใหม่

    const dataRow = worksheet.addRow({
      date: row.querySelector('td:nth-child(1)').textContent,
      machine: row.querySelector('td:nth-child(2)').textContent,
      ncr: row.querySelector('td:nth-child(3)').textContent,
      issues: issuesText || 'ไม่มีปัญหา',
      correction: row.querySelector('.preventive-correction-input').value
    });

    // style สำหรับแถวข้อมูล
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
  });

  // สร้างไฟล์ Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Weekly_NCR_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
}