let isPercentageView = false; // เริ่มต้นด้วยมุมมอง %POP

Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
Chart.defaults.global.defaultFontColor = '#000000';

function number_format(number, decimals, dec_point, thousands_sep) {
  number = (number + '').replace(',', '').replace(' ', '');
  var n = !isFinite(+number) ? 0 : +number,
    prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
    sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
    dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
    s = '',
    toFixedFix = function(n, prec) {
      var k = Math.pow(10, prec);
      return '' + Math.round(n * k) / k;
    };
  s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
  if (s[0].length > 3) {
    s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
  }
  if ((s[1] || '').length < prec) {
    s[1] = s[1] || '';
    s[1] += new Array(prec - s[1].length + 1).join('0');
  }
  return s.join(dec);
}

function combineData(data) {
  console.log("Data before combining:", data);
  const groups = {
    'CUT + DRA022': data.filter(item => item.MachineCode.startsWith('CUT') || item.MachineCode === 'DRA022'),
    'CO2': data.filter(item => item.MachineCode.startsWith('CO2') || ['CO2001', 'CO2002', 'CO2003'].includes(item.MachineCode)),
    'PAP': data.filter(item => item.MachineCode.startsWith('PAP'))
  };

  const result = Object.entries(groups).map(([groupName, groupData]) => {
    const totalPlan = groupData.reduce((sum, item) => sum + item.PlanQuantity, 0);
    const totalActual = groupData.reduce((sum, item) => sum + item.ActualQuantity, 0);
    const combinedPercentage = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    return {
      MachineCode: groupName,
      PlanQuantity: totalPlan,
      ActualQuantity: totalActual,
      Percentage: combinedPercentage
    };
  });

  console.log("Data after combining:", result);
  return result;
}

let cachedData = null;
let cachedStartDate = null;
let cachedEndDate = null;

async function fetchDataForBarChart(startDate, endDate) {
  try {
    const url = new URL('/api/chartProductionData', window.location.origin);
    url.searchParams.append('startDate', startDate);
    url.searchParams.append('endDate', endDate);
    url.searchParams.append('machineCodePrefix', 'CUT');
    url.searchParams.append('additionalMachineCodes', 'DRA022,CO2001,CO2002,CO2003,PAP001,PAP002');
    
    console.log('Fetching data from:', url.toString());
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Raw data received:', data);

    if (data.length === 0) {
      console.warn('No data received from API');
      return [];
    }

    // Group data by base MachineCode (without suffix)
    const groupedData = data.reduce((acc, item) => {
      const baseMachineCode = item.MachineCode.split('-')[0];
      // Filter for specific machine types
      const isValidMachine = (
        (baseMachineCode.startsWith('CUT') && parseInt(baseMachineCode.slice(3)) <= 18) || 
        baseMachineCode === 'DRA022' ||
        ['CO2001', 'CO2002', 'CO2003'].includes(baseMachineCode) ||
        ['PAP001', 'PAP002'].includes(baseMachineCode)
      );

      if (!isValidMachine) return acc;

      if (!acc[baseMachineCode]) {
        acc[baseMachineCode] = {
          MachineCode: baseMachineCode,
          PlanQuantity: 0,
          ActualQuantity: 0
        };
      }
      acc[baseMachineCode].PlanQuantity += Number(item.PlanQuantity) || 0;
      acc[baseMachineCode].ActualQuantity += Number(item.ActualQuantity) || 0;
      return acc;
    }, {});

    const finalData = Object.values(groupedData)
      .map(item => ({
        ...item,
        Percentage: item.PlanQuantity > 0 ? (item.ActualQuantity / item.PlanQuantity) * 100 : 0
      }))
      .sort((a, b) => {
        const order = ['CUT', 'DRA022', 'CO2', 'PAP'];
        const groupA = order.find(prefix => a.MachineCode.startsWith(prefix)) || a.MachineCode;
        const groupB = order.find(prefix => b.MachineCode.startsWith(prefix)) || b.MachineCode;
        if (groupA !== groupB) {
          return order.indexOf(groupA) - order.indexOf(groupB);
        }
        return a.MachineCode.localeCompare(b.MachineCode);
      });

    console.log('Final data for chart:', finalData);
    return finalData;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

function showLoading() {
  const chartContainer = document.querySelector('.chart-container');
  chartContainer.innerHTML = '<p class="text-center">Loading data...</p>';
}

function hideLoading() {
  const chartContainer = document.querySelector('.chart-container');
  chartContainer.innerHTML = '<canvas id="productionChart"></canvas>';
}

let isDetailedView = true; // เพิ่มตัวแปรนี้ที่ด้านนอกฟังก์ชัน

async function createOrUpdateBarChart() {
  showLoading();
  console.log("createOrUpdateBarChart function called");
  
  const startDatePicker = document.getElementById('start');
  const endDatePicker = document.getElementById('end');
  
  if (!startDatePicker || !endDatePicker) {
      console.error("Date picker elements not found in createOrUpdateBarChart");
      return;
  }

  const startDate = startDatePicker.value;
  const endDate = endDatePicker.value;

  // คำนวณวันที่สำหรับ title
  const startDateTime = new Date(startDate + 'T08:00:00');
  const endDateTime = new Date(new Date(endDate + 'T07:59:59').getTime() + 86400000); // เพิ่ม 1 วัน

  const formatDate = (date) => {
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const titleText = `ข้อมูลแสดงผลตั้งแต่ 08:00 น. ของวันที่ ${formatDate(startDateTime)} ถึง 07:59:59 น. ของวันที่ ${formatDate(endDateTime)}`;

  console.log(`Start Date: ${startDate}, End Date: ${endDate}`);

  if (!startDate || !endDate) {
      console.warn('Please select both start and end dates.');
      return;
  }
  
  const chartContainer = document.querySelector('.chart-container');
  if (!chartContainer) {
      console.error("Chart container not found");
      return;
  }
  
  chartContainer.innerHTML = '<p class="text-center">Loading data...</p>';

  try {
    const data = await fetchDataForBarChart(startDate, endDate);
    console.log("Data fetched:", data);
    
    if (data.length === 0) {
        chartContainer.innerHTML = '<p class="text-center">No data available for the selected date range</p>';
        return;
    }
    
    chartContainer.innerHTML = '<canvas id="productionChart"></canvas>';
    
    const barChartElement = document.getElementById("productionChart");
    if (!barChartElement) {
        console.error('Chart element not found after recreation');
        return;
    }

    const chartData = isDetailedView ? data : combineData(data);
    console.log("Data used for chart:", chartData);
    console.log("CO2 and PAP data for chart:", chartData.filter(item => 
      item.MachineCode.startsWith('CO2') || item.MachineCode.startsWith('PAP')
    ));
    
    const barColors = chartData.map(item => 
      item.Percentage >= 95 ? "#1cc88a" : "#e74a3b"
  );

    const barChartContext = barChartElement.getContext('2d');

    if (window.myBarChart) {
        window.myBarChart.destroy();
    }

    let datasets;
    if (isPercentageView) {
      datasets = [{
        label: "%Production On Plan",
        backgroundColor: barColors,
        data: chartData.map(item => item.Percentage),
        hoverBackgroundColor: barColors.map(color => 
          color === "#1cc88a" ? "#17a673" :
          color === "#f6c23e" ? "#dda20a" :
          "#c23616"
        ),
        borderColor: "#ffffff",
        barPercentage: 0.5,
        categoryPercentage: 0.8
      }];
    } else {
      datasets = [
        {
          label: "Plan",
          backgroundColor: "#4e73df",
          data: chartData.map(item => item.PlanQuantity),
          borderColor: "#ffffff",
          barPercentage: 0.5,
          categoryPercentage: 0.8
        },
        {
          label: "Actual",
          backgroundColor: chartData.map(item => {
            const percentage = item.PlanQuantity > 0 ? (item.ActualQuantity / item.PlanQuantity) * 100 : 0;
            return percentage >= 95 ? "#1cc88a" : "#e74a3b";
          }),
          data: chartData.map(item => item.ActualQuantity),
          borderColor: "#ffffff",
          barPercentage: 0.5,
          categoryPercentage: 0.8
        }
      ];
    }

    window.myBarChart = new Chart(barChartContext, {
      type: 'bar',
      plugins: [{
          id: 'customDataLabels',
          afterDatasetsDraw(chart, args, options) {
              const { ctx, data, chartArea: { top, bottom, left, right, width, height } } = chart;
  
              ctx.save();
              data.datasets.forEach((dataset, datasetIndex) => {
                dataset.data.forEach((datapoint, index) => {
                  const { x, y } = chart.getDatasetMeta(datasetIndex).data[index].tooltipPosition();
  
                  ctx.font = 'bold 12px Arial';
                  ctx.fillStyle = 'black';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'bottom';
                  let value = isPercentageView ? `${number_format(datapoint, 1)}%` : number_format(datapoint, 1);
                  ctx.fillText(value, x, y - 5);
                });
              });
              ctx.restore();
          }
      }],
      data: {
          labels: chartData.map(item => item.MachineCode),
          datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 25,
            top: 25,
            bottom: 20
          }
        },
        plugins: {
          title: {
            display: true,
            text: titleText,
            font: {
              size: 14
            },
            color: '#333',
            padding: 0
          },
          legend: { 
            display: true,
            position: 'top',
          },
          tooltip: {
            titleMarginBottom: 10,
            titleFont: {
              size: 14
            },
            titleColor: '#6e707e',
            backgroundColor: "rgb(255,255,255)",
            bodyColor: "#858796",
            borderColor: '#dddfeb',
            borderWidth: 1,
            xPadding: 15,
            yPadding: 15,
            displayColors: false,
            caretPadding: 10,
            callbacks: {
              label: function(context) {
                var label = context.dataset.label || '';
                var value = isPercentageView ? 
                  number_format(context.parsed.y, 1) + '%' :
                  number_format(context.parsed.y, 1);
                var item = chartData[context.dataIndex];
                var group = getMachineCodeGroup(item.MachineCode);
                if (isPercentageView) {
                  return [
                    `${label}: ${value}`,
                    `Group: ${group}`,
                    `Actual: ${number_format(item.ActualQuantity, 1)}`,
                    `Plan: ${number_format(item.PlanQuantity, 1)}`,
                    `Status: ${item.Percentage >= 95 ? 'On Target' : 'Below Target'}`
                  ];
                } else {
                  return `${label}: ${value}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              maxTicksLimit: 20,
              callback: function(value, index, values) {
                // ตัดคำให้สั้นลงถ้าจำเป็น
                return this.getLabelForValue(value).length > 10 
                  ? this.getLabelForValue(value).substr(0, 10) + '...' 
                  : this.getLabelForValue(value);
              }
            }
          },
          y: {
            type: 'logarithmic', // เปลี่ยนเป็น logarithmic scale
            beginAtZero: true,
            max: isPercentageView ? 200 : undefined,
            ticks: {
              maxTicksLimit: 5,
              padding: 10,
              callback: function(value) {
                if (isPercentageView) {
                  return value + '%';
                } else {
                  // สำหรับ logarithmic scale ควรแสดงค่าในรูปแบบที่อ่านง่าย
                  if (value === 0) return '0';
                  if (value < 1000) return value;
                  if (value >= 1000 && value < 1000000) return (value / 1000).toFixed(1) + 'K';
                  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                }
              }
            },
            grid: {
              color: "rgb(234, 236, 244)",
              zeroLineColor: "rgb(234, 236, 244)",
              drawBorder: false,
              borderDash: [2],
              zeroLineBorderDash: [2]
            }
          }
        }
      }
    });
    
    console.log("Chart created successfully");
  } catch (error) {
    hideLoading();
    console.error('Error creating chart:', error);
    alert('Error creating chart. Please try again later.');
  }
}

function getMachineCodeGroup(machineCode) {
  if (machineCode.startsWith('CUT') || machineCode === 'DRA022') return 'CUT + DRA022';
  if (machineCode.startsWith('CO2') || ['CO2001', 'CO2002', 'CO2003'].includes(machineCode)) return 'CO2';
  if (machineCode.startsWith('PAP')) return 'PAP';
  return 'Other';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
      const later = () => {
          clearTimeout(timeout);
          func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
  };
}

const debouncedCreateOrUpdateBarChart = debounce(createOrUpdateBarChart, 300);
// ใช้ debouncedCreateOrUpdateBarChart แทน createOrUpdateBarChart ในส่วนที่มีการเรียกใช้บ่อยๆ


// อัปเดตข้อความของปุ่ม Toggle View
const toggleViewButton = document.getElementById('toggleViewButton');
if (toggleViewButton) {
    toggleViewButton.textContent = isDetailedView ? "Show Combined View" : "Show Detailed View";
}

// เพิ่ม event listener สำหรับปุ่ม Toggle View
if (toggleViewButton) {
    toggleViewButton.addEventListener('click', function() {
        isDetailedView = !isDetailedView;
        console.log("View changed. isDetailedView is now:", isDetailedView);
        createOrUpdateBarChart();
    });
} else {
    console.error("Toggle view button not found");
}


document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM fully loaded");
  initializeChart();

  const filterButton = document.getElementById('filterButton');
  if (filterButton) {
    filterButton.addEventListener('click', createOrUpdateBarChart);
  } else {
    console.error("Filter button not found");
  }


  const toggleViewButton = document.getElementById('toggleViewButton');
  if (toggleViewButton) {
    toggleViewButton.addEventListener('click', function() {
      isDetailedView = !isDetailedView;
      this.textContent = isDetailedView ? "Show Combined View" : "Show Detailed View";
      console.log("View changed. isDetailedView is now:", isDetailedView);
      createOrUpdateBarChart();
    });
  } else {
    console.error("Toggle view button not found");
  }

  const toggleChartViewButton = document.getElementById('toggleChartViewButton');
  if (toggleChartViewButton) {
    toggleChartViewButton.addEventListener('click', function() {
      isPercentageView = !isPercentageView;
      this.textContent = isPercentageView ? "Switch to Plan/Actual View" : "Switch to %POP View";
      document.querySelector('.card-header h6').textContent = isPercentageView ? 
        "%Production On Plan (Bar2)" : "Plan vs Actual Production (Bar2)";
      createOrUpdateBarChart();
    });
  } else {
    console.log("Toggle chart view button not found, skipping event listener");
  }
});

function initializeChart() {
  const startDatePicker = document.getElementById('start');
  const endDatePicker = document.getElementById('end');
  
  if (!startDatePicker || !endDatePicker) {
      console.error("Date picker elements not found");
      return;
  }

  // ตั้งค่าวันเริ่มต้นเป็นวันที่ 1 ของเดือนปัจจุบัน (เวลาท้องถิ่น)
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  startDatePicker.value = formatDateForInput(firstDayOfMonth);
  endDatePicker.value = formatDateForInput(lastDayOfMonth);
  
  // เรียกใช้ฟังก์ชันสร้างกราฟทันทีเมื่อโหลดหน้า
  createOrUpdateBarChart();

  const filterButton = document.getElementById('filterButton');
  if (filterButton) {
      filterButton.addEventListener('click', createOrUpdateBarChart);
  }

  const toggleViewButton = document.getElementById('toggleViewButton');
  if (toggleViewButton) {
      toggleViewButton.addEventListener('click', function() {
          isDetailedView = !isDetailedView;
          createOrUpdateBarChart();
      });
  }
}

function resetDateAndChart() {
  const startDatePicker = document.getElementById('start');
  const endDatePicker = document.getElementById('end');
  
  if (!startDatePicker || !endDatePicker) {
      console.error("Date picker elements not found in resetDateAndChart");
      return;
  }

  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  startDatePicker.value = formatDateForInput(firstDayOfMonth);
  endDatePicker.value = formatDateForInput(lastDayOfMonth);
  
  createOrUpdateBarChart();
}

// ฟังก์ชันช่วยในการจัดรูปแบบวันที่สำหรับ input
function formatDateForInput(date) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}


// ใน main script
const worker = new Worker('dataProcessingWorker.js');
worker.postMessage({ data: rawData });
worker.onmessage = function(e) {
    const processedData = e.data;
    // ใช้ processedData สร้างกราฟ
};

// ใน dataProcessingWorker.js
self.onmessage = function(e) {
    const rawData = e.data.data;
    const processedData = processData(rawData);
    self.postMessage(processedData);
};


function toggleChartView() {
  isPercentageView = !isPercentageView;
  createOrUpdateBarChart();
}