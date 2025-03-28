async function fetchWeeklyProductionData(startDate, endDate) {
  try {
    const url = new URL('http://192.168.1.214:5000/api/productionData');
    url.searchParams.append('startDate', startDate);
    url.searchParams.append('endDate', endDate);
    url.searchParams.append('machineCodePrefix', 'D');

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
    // กรองเฉพาะ DRA และไม่รวม DRA022
    if (item.MachineCode.startsWith('DRA') && item.MachineCode !== 'DRA022') {
      if (!acc[item.MachineCode]) {
        acc[item.MachineCode] = { totalActual: 0, totalPlan: 0, issues: [] };
      }
      const actual = parseFloat(item.Actual) || 0;
      const plan = parseFloat(item.ProductionQuantity) || 0;
      
      acc[item.MachineCode].totalActual += actual;
      acc[item.MachineCode].totalPlan += plan;

      console.log(`${item.MachineCode}: Actual=${actual}, Plan=${plan}, Running total: Actual=${acc[item.MachineCode].totalActual}, Plan=${acc[item.MachineCode].totalPlan}`);
    }
    return acc;
  }, {});

  console.log('Grouped data:', groupedData);

  const result = Object.entries(groupedData).map(([machineCode, data]) => {
    const cumulativePOP = data.totalPlan > 0 ? (data.totalActual / data.totalPlan) * 100 : 0;
    console.log(`${machineCode}: Final calculation - Actual=${data.totalActual}, Plan=${data.totalPlan}, POP=${cumulativePOP.toFixed(1)}%`);
    return {
      MachineCode: machineCode,
      CumulativePOP: cumulativePOP,
      TotalWIPWeight: data.totalActual,
      TotalPlan: data.totalPlan,
      Issues: data.issues
    };
  }).sort((a, b) => {
    const numA = parseInt(a.MachineCode.replace('DRA', ''));
    const numB = parseInt(b.MachineCode.replace('DRA', ''));
    return numA - numB;
  });

  console.log('Final calculated result:', result);
  return result;
}

async function generateWeeklyReport(startDate, endDate) {
  try {
    const response = await fetch(`http://192.168.1.214:5000/api/weeklyReport?startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const data = await response.json();
    console.log('Raw API data:', data);
    
    const savedReportData = await fetchSavedWeeklyReport(startDate, endDate);

    // กรองเฉพาะข้อมูลของ DRA และไม่รวม DRA022
    const filteredData = data.filter(item => item.MachineCode.startsWith('DRA') && item.MachineCode !== 'DRA022');

    const report = filteredData.map(item => {
      const savedData = savedReportData.find(saved => saved.MachineCode === item.MachineCode);
      return {
        MachineCode: item.MachineCode,
        CumulativePOP: item.CumulativePOP || 0,
        TotalWIPWeight: item.TotalWIPWeight || 0,
        TotalPlan: item.TotalPlan || 0,
        Issues: item.Issues || 'ไม่มีข้อมูล',
        TotalDowntime: item.TotalDowntime || 0,
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
      
      // แยกปัญหาเป็นรายการและสร้าง HTML
      let issuesHtml = '<div class="issue-item">ไม่มีปัญหา</div>';
      if (item.Issues && typeof item.Issues === 'string' && item.Issues !== 'ไม่มีข้อมูล' && item.Issues !== 'ไม่มีปัญหา') {
        const issuesArray = item.Issues.split('; ');
        issuesHtml = issuesArray.map(issue => `<div class="issue-item">${issue}</div>`).join('');
      } else if (Array.isArray(item.Issues) && item.Issues.length > 0) {
        issuesHtml = item.Issues.map(issue => `<div class="issue-item">${issue}</div>`).join('');
      }
      
      const row = `<tr data-machine-code="${item.MachineCode}">
        <td>${index === 0 ? `${startDate} - ${endDate}` : ''}</td>
        <td>${item.MachineCode}</td>
        <td>${cumulativePOP.toFixed(1)}%</td>
        <td>${item.TotalWIPWeight.toFixed(1)} / ${item.TotalPlan.toFixed(1)}</td>
        <td class="issues-cell">${issuesHtml}</td>
        <td>${item.TotalDowntime} นาที</td>
        <td><input type="text" class="form-control preventive-correction-input" value="${item.PreventiveCorrection || ''}" maxlength="200"></td>
      </tr>`;
      tableBody.innerHTML += row;
    });

    console.log('Table updated with report data');
  } catch (error) {
    console.error('Error generating report:', error);
    alert(`เกิดข้อผิดพลาดในการสร้างรายงาน: ${error.message}`);
  }
});

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