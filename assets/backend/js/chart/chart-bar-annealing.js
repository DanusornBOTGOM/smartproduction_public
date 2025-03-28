let isPercentageView = false; // เริ่มต้นด้วย Plan/Actual View
let isDetailedView = false; // เริ่มต้นด้วย Combined View

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
    'ANN001': data.filter(item => item.MachineCode.startsWith('ANN001')),
    'ANN002': data.filter(item => item.MachineCode.startsWith('ANN002')),
    'ANN003': data.filter(item => item.MachineCode.startsWith('ANN003')),
    'ANN004': data.filter(item => item.MachineCode.startsWith('ANN004')),
    'ANN005': data.filter(item => item.MachineCode.startsWith('ANN005')),
    'ANN006': data.filter(item => item.MachineCode.startsWith('ANN006'))
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
    url.searchParams.append('machineCodePrefix', 'ANN');
    
    console.log('Fetching data from:', url.toString());
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Raw data received:', data);

    // กรองข้อมูลสำหรับ Annealing
    const filteredData = data.filter(item => item.MachineCode.startsWith('ANN'));

    // คำนวณเปอร์เซ็นต์และเรียงลำดับตาม MachineCode
    const finalData = filteredData
      .map(item => ({
        MachineCode: item.MachineCode,
        PlanQuantity: item.PlanQuantity,
        ActualQuantity: item.ActualQuantity,
        Percentage: item.PlanQuantity > 0 ? (item.ActualQuantity / item.PlanQuantity) * 100 : 0
      }))
      .sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

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

    const barChartContext = barChartElement.getContext('2d');

    if (window.myBarChart) {
        window.myBarChart.destroy();
    }

    let datasets;
    if (isPercentageView) {
      // %POP View
      datasets = [{
        label: "%Production On Plan",
        backgroundColor: chartData.map(item => 
          item.Percentage >= 100 ? "#1cc88a" :
          item.Percentage >= 95 ? "#f6c23e" :
          "#e74a3b"
        ),
        data: chartData.map(item => item.Percentage),
        hoverBackgroundColor: chartData.map(item => 
          item.Percentage >= 100 ? "#17a673" :
          item.Percentage >= 95 ? "#dda20a" :
          "#c23616"
        ),
        borderColor: "#ffffff",
        barPercentage: 0.5,
        categoryPercentage: 0.8
      }];
    } else {
      // Plan/Actual View
      datasets = [
        {
          label: "Plan",
          backgroundColor: "#4e73df",
          data: chartData.map(item => item.PlanQuantity),
        },
        {
          label: "Actual",
          backgroundColor: "#1cc88a",
          data: chartData.map(item => item.ActualQuantity),
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
                var value = number_format(context.parsed.y, 1);
                var item = chartData[context.dataIndex];
                if (isPercentageView) {
                  return [
                    `${label}: ${value}%`,
                    `Actual: ${number_format(item.ActualQuantity, 1)}`,
                    `Plan: ${number_format(item.PlanQuantity, 1)}`
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
                return this.getLabelForValue(value);
              }
            }
          },
          y: {
            beginAtZero: true,
            max: isPercentageView ? 200 : undefined,
            ticks: {
              maxTicksLimit: 5,
              padding: 10,
              callback: function(value) {
                return isPercentageView ? value + '%' : value;
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
  return machineCode.substring(0, 6);  // เช่น 'ANN001', 'ANN002', etc.
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
    toggleViewButton.textContent = isDetailedView ? "โชว์เฉพาะเตา" : "โชว์ทุกท่อ";
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
    toggleViewButton.textContent = isDetailedView ? "โชว์เฉพาะเตา" : "โชว์ทุกท่อ";
    toggleViewButton.addEventListener('click', function() {
      isDetailedView = !isDetailedView;
      this.textContent = isDetailedView ? "โชว์เฉพาะเตา" : "โชว์ทุกท่อ";
      console.log("View changed. isDetailedView is now:", isDetailedView);
      createOrUpdateBarChart();
    });
  } else {
    console.error("Toggle view button not found");
  }

  const toggleChartViewButton = document.getElementById('toggleChartViewButton');
  if (toggleChartViewButton) {
    toggleChartViewButton.textContent = isPercentageView ? "Switch to Plan/Actual View" : "Switch to %POP View";
    toggleChartViewButton.addEventListener('click', function() {
      isPercentageView = !isPercentageView;
      this.textContent = isPercentageView ? "Switch to Plan/Actual View" : "Switch to %POP View";
      document.querySelector('.card-header h6').textContent = isPercentageView ? 
        "%Production On Plan (Annealing)" : "Plan vs Actual Production (Annealing)";
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