// เพิ่มตัวแปรเพื่อควบคุมการแสดงผลแบบกลุ่ม
let isPercentageView = false; // true for %POP, false for Plan/Actual
let isDetailedView = true; // true for individual machines, false for combined view
let isGroupedView = false; // true for S, M, L, XL groups, false for normal view

// กำหนดกลุ่มเครื่องจักร
const machineGroups = {
  'S': ['PRO011-2', 'PRO015', 'PRO015-1', 'PRO016', 'PRO016-1', 'PRO014', 'PRO014-1', 'PRO008', 'PRO008-1', 'PRO020', 'PRO020-1', 'PRO020-2'],
  'M-L-XL': ['PRO011-1', 'PRO018', 'PRO018-1', 'PRO019', 'PRO019-1', 'PRO003', 'PRO003-1', 'PRO004', 'PRO004-1', 'PRO005', 'PRO005-1', 'PRO006', 'PRO006-1', 'PRO012', 'PRO012-1']
};

Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
Chart.defaults.global.defaultFontColor = '#000000';
Chart.defaults.global.defaultFontStyle = 'bold';

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
  console.log("Combining data...");
  const totalPlan = data.reduce((sum, item) => sum + item.PlanQuantity, 0);
  const totalActual = data.reduce((sum, item) => sum + item.ActualQuantity, 0);
  const combinedPercentage = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
  const result = [{
      MachineCode: 'All Profile Machines',
      PlanQuantity: totalPlan,
      ActualQuantity: totalActual,
      Percentage: combinedPercentage
  }];
  console.log("Combined result:", result);
  return result;
}

// ฟังก์ชันใหม่สำหรับดึงข้อมูลดิบและจัดกลุ่มตามกลุ่มเครื่อง
async function fetchAndGroupMachineData(startDate, endDate) {
  try {
      // ดึงข้อมูลจาก API
      const url = new URL('/api/chartProductionDataPRO', window.location.origin);
      url.searchParams.append('startDate', startDate);
      url.searchParams.append('endDate', endDate);
      
      console.log('Fetching data for machine groups from:', url.toString());
      
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData = await response.json();
      console.log('Raw data received:', rawData);

      if (rawData.length === 0) {
          console.warn('No data received from API');
          return [];
      }
      
      // จัดกลุ่มข้อมูลตามกลุ่มเครื่องที่กำหนด
      const result = [];
      
      for (const [groupName, machineList] of Object.entries(machineGroups)) {
          console.log(`Processing group ${groupName} with machines:`, machineList);
          
          // กรองเฉพาะเครื่องที่อยู่ในกลุ่ม
          const groupMachines = rawData.filter(item => {
              return machineList.includes(item.MachineCode);
          });
          
          console.log(`Found ${groupMachines.length} machines in group ${groupName}:`, 
                      groupMachines.map(item => item.MachineCode));
          
          // คำนวณผลรวมสำหรับกลุ่ม
          const totalPlan = groupMachines.reduce((sum, item) => sum + (Number(item.PlanQuantity) || 0), 0);
          const totalActual = groupMachines.reduce((sum, item) => sum + (Number(item.ActualQuantity) || 0), 0);
          const groupPercentage = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
          
          console.log(`Group ${groupName} totals:`, { 
              plan: totalPlan, actual: totalActual, percentage: groupPercentage 
          });
          
          result.push({
              MachineCode: `Group ${groupName}`,
              PlanQuantity: totalPlan,
              ActualQuantity: totalActual,
              Percentage: groupPercentage
          });
      }
      
      console.log("Final grouped result:", result);
      return result;
  } catch (error) {
      console.error('Error processing machine group data:', error);
      throw error;
  }
}

let cachedData = null;
let cachedStartDate = null;
let cachedEndDate = null;

async function fetchDataForBarChart(startDate, endDate) {
  try {
      const url = new URL('/api/chartProductionDataPRO', window.location.origin);
      url.searchParams.append('startDate', startDate);
      url.searchParams.append('endDate', endDate);
      
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

      // จัดกลุ่มข้อมูลตามรหัสเครื่องจักรหลัก (ไม่มี suffix -1, -2, etc.)
      const groupedData = data.reduce((acc, item) => {
          // ตัดส่วน suffix ออก (ทุกอย่างหลัง -)
          const baseMachineCode = item.MachineCode.split('-')[0];
          
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

      // แปลงข้อมูลที่จัดกลุ่มแล้วเป็น array
      const finalData = Object.values(groupedData)
          .map(item => ({
              MachineCode: item.MachineCode,
              PlanQuantity: item.PlanQuantity,
              ActualQuantity: item.ActualQuantity,
              Percentage: item.PlanQuantity > 0 ? (item.ActualQuantity / item.PlanQuantity) * 100 : 0
          }))
          .sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

      console.log('Final grouped data for chart:', finalData);
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
  console.log("Current view mode:", { isDetailedView, isGroupedView, isPercentageView });
  
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
  const endDateTime = new Date(new Date(endDate + 'T07:59:59').getTime() + 86400000);

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
    // ดึงข้อมูลตามโหมดการแสดงผล
    let chartData;
    
    if (isGroupedView) {
      // สำหรับมุมมองแบบกลุ่ม ใช้ฟังก์ชันเฉพาะที่จัดกลุ่มตามที่กำหนด
      chartData = await fetchAndGroupMachineData(startDate, endDate);
      console.log("Using predefined machine group data:", chartData);
    } else {
      // สำหรับมุมมองปกติ ใช้ฟังก์ชันเดิม
      const data = await fetchDataForBarChart(startDate, endDate);
      
      if (data.length === 0) {
        chartContainer.innerHTML = '<p class="text-center">No data available for the selected date range</p>';
        return;
      }
      
      if (isDetailedView) {
        // สำหรับมุมมองแบบละเอียด (แยกตามเครื่อง)
        chartData = data;
        console.log("Using detailed data for chart:", chartData);
      } else {
        // สำหรับมุมมองแบบรวม (ทั้งหมด)
        chartData = combineData(data);
        console.log("Using combined data for chart:", chartData);
      }
    }
    
    if (chartData.length === 0) {
      console.warn("No chart data available after processing");
      chartContainer.innerHTML = '<p class="text-center">No data available for the selected view mode</p>';
      return;
    }
    
    chartContainer.innerHTML = '<canvas id="productionChart"></canvas>';
    
    const barChartElement = document.getElementById("productionChart");
    if (!barChartElement) {
        console.error('Chart element not found after recreation');
        return;
    }

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
                var actualValue = number_format(item.ActualQuantity, 1);
                var planValue = number_format(item.PlanQuantity, 1);
                if (isPercentageView) {
                  return [
                    `${label}: ${value}`,
                    `Actual: ${actualValue}`,
                    `Plan: ${planValue}`
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

function initializeChart() {
  const startDatePicker = document.getElementById('start');
  const endDatePicker = document.getElementById('end');
  
  if (!startDatePicker || !endDatePicker) {
      console.error("Date picker elements not found");
      return;
  }

  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  startDatePicker.value = formatDateForInput(firstDayOfMonth);
  endDatePicker.value = formatDateForInput(lastDayOfMonth);
  
  createOrUpdateBarChart();
}

document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM fully loaded");
  initializeChart();

  const filterButton = document.getElementById('filterButton');
  if (filterButton) {
    filterButton.addEventListener('click', createOrUpdateBarChart);
  } else {
    console.log("Filter button not found, skipping event listener");
  }

  const toggleViewButton = document.getElementById('toggleViewButton');
  if (toggleViewButton) {
    toggleViewButton.addEventListener('click', function() {
      isDetailedView = !isDetailedView;
      isGroupedView = false; // ปิดมุมมองกลุ่มเมื่อกดปุ่มนี้
      this.textContent = isDetailedView ? "Show Combined View" : "Show Detailed View";
      
      // อัพเดตสถานะของปุ่มกลุ่ม
      const toggleGroupButton = document.getElementById('toggleGroupButton');
      if (toggleGroupButton) {
        toggleGroupButton.textContent = "Switch to Group View";
      }
      
      console.log("View changed. isDetailedView is now:", isDetailedView);
      createOrUpdateBarChart();
    });
  } else {
    console.log("Toggle view button not found, skipping event listener");
  }

  const toggleChartViewButton = document.getElementById('toggleChartViewButton');
  if (toggleChartViewButton) {
    toggleChartViewButton.addEventListener('click', function() {
      isPercentageView = !isPercentageView;
      this.textContent = isPercentageView ? "Switch to Plan/Actual View" : "Switch to %POP View";
      document.querySelector('.card-header h6').textContent = isPercentageView ? 
        "%Production On Plan (Profile)" : "Plan vs Actual Production (Profile)";
      createOrUpdateBarChart();
    });
  } else {
    console.log("Toggle chart view button not found, skipping event listener");
  }
  
  // เพิ่มปุ่มสำหรับสลับการแสดงผลกลุ่มเครื่อง
  const toggleChartViewButtonContainer = document.getElementById('toggleChartViewButton').parentElement;
  if (toggleChartViewButtonContainer) {
    const toggleGroupButton = document.createElement('button');
    toggleGroupButton.id = 'toggleGroupButton';
    toggleGroupButton.className = 'btn btn-primary ml-2';
    toggleGroupButton.textContent = 'Switch to Group View';
    toggleChartViewButtonContainer.appendChild(toggleGroupButton);
    
    toggleGroupButton.addEventListener('click', function() {
      isGroupedView = !isGroupedView;
      
      if (isGroupedView) {
        isDetailedView = false; // ปิดมุมมองรายละเอียดเมื่อใช้มุมมองกลุ่ม
        this.textContent = "Switch to Normal View";
        
        // อัพเดตสถานะของปุ่มรายละเอียด
        const toggleViewButton = document.getElementById('toggleViewButton');
        if (toggleViewButton) {
          toggleViewButton.textContent = "Show Detailed View";
        }
      } else {
        this.textContent = "Switch to Group View";
      }
      
      console.log("View changed. isGroupedView is now:", isGroupedView);
      createOrUpdateBarChart();
    });
  } else {
    console.error("toggleChartViewButton parent element not found");
  }
});

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

function formatDateForInput(date) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}