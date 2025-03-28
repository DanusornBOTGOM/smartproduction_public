// Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
// Chart.defaults.global.defaultFontColor = '#858796';

// function number_format(number, decimals, dec_point, thousands_sep) {
//     number = (number + '').replace(',', '').replace(' ', '');
//     var n = !isFinite(+number) ? 0 : +number,
//       prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
//       sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
//       dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
//       s = '',
//       toFixedFix = function(n, prec) {
//         var k = Math.pow(10, prec);
//         return '' + Math.round(n * k) / k;
//       };
//     s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
//     if (s[0].length > 3) {
//       s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
//     }
//     if ((s[1] || '').length < prec) {
//       s[1] = s[1] || '';
//       s[1] += new Array(prec - s[1].length + 1).join('0');
//     }
//     return s.join(dec);
//   }

// function combineData(data) {
//   console.log("Combining data...");
//   const totalPlan = data.reduce((sum, item) => sum + item.PlanQuantity, 0);
//   const totalActual = data.reduce((sum, item) => sum + item.ActualQuantity, 0);
//   return [{
//     MachineCode: 'Total',
//     PlanQuantity: totalPlan,
//     ActualQuantity: totalActual,
//     Percentage: totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0
//   }];
// }

// let cachedData = null;
// let cachedStartDate = null;
// let cachedEndDate = null;

// async function fetchDataForDrawingChart(startDate, endDate) {
//   try {
//     const url = new URL('/api/chartProductionData', window.location.origin);
//     url.searchParams.append('startDate', startDate);
//     url.searchParams.append('endDate', endDate);
//     url.searchParams.append('machineCodePrefix', 'D');
//     url.searchParams.append('excludeMachineCodePrefix', 'DW');
//     url.searchParams.append('excludeMachineCodes', 'DRA022');
//     url.searchParams.append('itemType', 'WIP');
    
//     console.log('Fetching data from:', url.toString());
    
//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     const data = await response.json();
//     console.log('Raw data received:', data);

//     const filteredData = data.filter(item => 
//       item.MachineCode.startsWith('D') && 
//       !item.MachineCode.startsWith('DW') &&
//       item.MachineCode !== 'DRA022'
//     );

//     const finalData = filteredData
//       .map(item => ({
//         MachineCode: item.MachineCode,
//         PlanQuantity: parseFloat(item.PlanQuantity) || 0,
//         ActualQuantity: parseFloat(item.ActualQuantity) || 0,
//         Percentage: item.PlanQuantity > 0 ? (item.ActualQuantity / item.PlanQuantity) * 100 : 0
//       }))
//       .sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

//     console.log('Final data for Drawing chart:', finalData);

//     return finalData;
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     throw error;
//   }
// }

// function showLoading() {
//   const chartContainer = document.querySelector('.chart-container');
//   chartContainer.innerHTML = '<p class="text-center">Loading data...</p>';
// }

// function hideLoading() {
//   const chartContainer = document.querySelector('.chart-container');
//   chartContainer.innerHTML = '<canvas id="drawingProductionChart"></canvas>';
// }

// let isDetailedView = true;

// async function createOrUpdateDrawingChart() {
//   showLoading();
//   console.log("createOrUpdateDrawingChart function called");
  
//   const startDatePicker = document.getElementById('start');
//   const endDatePicker = document.getElementById('end');
  
//   if (!startDatePicker || !endDatePicker) {
//       console.error("Date picker elements not found in createOrUpdateDrawingChart");
//       return;
//   }

//   const startDate = startDatePicker.value;
//   const endDate = endDatePicker.value;

//   const startDateTime = new Date(startDate + 'T08:00:00');
//   const endDateTime = new Date(new Date(endDate + 'T07:59:59').getTime() + 86400000);

//   const formatDate = (date) => {
//     return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
//   };

//   const titleText = `ข้อมูลแสดงผลตั้งแต่ 08:00 น. ของวันที่ ${formatDate(startDateTime)} ถึง 07:59:59 น. ของวันที่ ${formatDate(endDateTime)}`;

//   console.log(`Start Date: ${startDate}, End Date: ${endDate}`);

//   if (!startDate || !endDate) {
//       console.warn('Please select both start and end dates.');
//       return;
//   }
  
//   const chartContainer = document.querySelector('.chart-container');
//   if (!chartContainer) {
//       console.error("Chart container not found");
//       return;
//   }
  
//   chartContainer.innerHTML = '<p class="text-center">Loading data...</p>';

//   try {
//     const data = await fetchDataForDrawingChart(startDate, endDate);
//     console.log("Data fetched for Drawing:", data);
    
//     if (data.length === 0) {
//       chartContainer.innerHTML = '<p class="text-center">No data available for the selected date range</p>';
//       return;
//     }
    
//     chartContainer.innerHTML = '<canvas id="drawingProductionChart"></canvas>';
    
//     const drawingChartElement = document.getElementById("drawingProductionChart");
//     if (!drawingChartElement) {
//       console.error('Chart element not found after recreation');
//       return;
//     }

//     const chartData = isDetailedView ? data : combineData(data);

//     const drawingChartContext = drawingChartElement.getContext('2d');

//     if (window.myDrawingChart) {
//       window.myDrawingChart.destroy();
//     }

//     window.myDrawingChart = new Chart(drawingChartContext, {
//       type: 'bar',
//       plugins: [{
//         id: 'customDataLabels',
//         afterDatasetsDraw(chart, args, options) {
//           const { ctx, data, chartArea: { top, bottom, left, right, width, height } } = chart;

//           ctx.save();
//           data.datasets.forEach((dataset, datasetIndex) => {
//             chart.getDatasetMeta(datasetIndex).data.forEach((datapoint, index) => {
//               const { x, y } = datapoint.tooltipPosition();

//               ctx.font = 'bold 12px Arial';
//               ctx.fillStyle = 'black';
//               ctx.textAlign = 'center';
//               ctx.textBaseline = 'bottom';
//               let value = dataset.data[index];
//               ctx.fillText(number_format(value, 1), x, y - 5);
//             });
//           });
//           ctx.restore();
//         }
//       }],
//       data: {
//         labels: chartData.map(item => item.MachineCode),
//         datasets: [
//           {
//             label: "Plan",
//             backgroundColor: "#4e73df",
//             data: chartData.map(item => item.PlanQuantity),
//           },
//           {
//             label: "Actual",
//             backgroundColor: chartData.map(item => 
//               item.ActualQuantity >= item.PlanQuantity ? "#1cc88a" :
//               item.ActualQuantity >= item.PlanQuantity * 0.95 ? "#f6c23e" :
//               "#e74a3b"
//             ),
//             data: chartData.map(item => item.ActualQuantity),
//           }
//         ],
//       },
//       options: {
//         maintainAspectRatio: false,
//         layout: {
//           padding: {
//             left: 10,
//             right: 25,
//             top: 25,
//             bottom: 0
//           }
//         },
//         scales: {
//           xAxes: [{
//             gridLines: {
//               display: true,
//               drawBorder: false
//             },
//             ticks: {
//               maxTicksLimit: 20
//             }
//           }],
//           yAxes: [{
//             ticks: {
//               min: 0,
//               maxTicksLimit: 5,
//               padding: 10,
//               callback: function(value, index, values) {
//                 return number_format(value);
//               }
//             },
//             gridLines: {
//               color: "rgb(234, 236, 244)",
//               zeroLineColor: "rgb(234, 236, 244)",
//               drawBorder: false,
//               borderDash: [2],
//               zeroLineBorderDash: [2]
//             }
//           }],
//         },
//         legend: {
//           display: true
//         },
//         tooltips: {
//           backgroundColor: "rgb(255,255,255)",
//           bodyFontColor: "#858796",
//           titleMarginBottom: 10,
//           titleFontColor: '#6e707e',
//           titleFontSize: 14,
//           borderColor: '#dddfeb',
//           borderWidth: 1,
//           xPadding: 15,
//           yPadding: 15,
//           displayColors: false,
//           intersect: false,
//           mode: 'index',
//           caretPadding: 10,
//           callbacks: {
//             label: function(tooltipItem, chart) {
//               var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
//               var value = number_format(tooltipItem.yLabel, 1);
//               return datasetLabel + ': ' + value;
//             }
//           }
//         },
//       }
//     });
    
//     console.log("Drawing Chart created successfully");
//   } catch (error) {
//     hideLoading();
//     console.error('Error creating Drawing chart:', error);
//     alert('Error creating Drawing chart. Please try again later.');
//   }
// }

// document.addEventListener("DOMContentLoaded", function() {
//   console.log("DOM fully loaded");
//   initializeDrawingChart();

//   const filterButton = document.getElementById('filterButton');
//   if (filterButton) {
//     filterButton.addEventListener('click', createOrUpdateDrawingChart);
//   } else {
//     console.error("Filter button not found");
//   }

//   const toggleViewButton = document.getElementById('toggleViewButton');
//   if (toggleViewButton) {
//     toggleViewButton.addEventListener('click', function() {
//       isDetailedView = !isDetailedView;
//       toggleViewButton.textContent = isDetailedView ? "Show Combined View" : "Show Detailed View";
//       console.log("View changed. isDetailedView is now:", isDetailedView);
//       createOrUpdateDrawingChart();
//     });
//   } else {
//     console.error("Toggle view button not found");
//   }
// });

// function initializeDrawingChart() {
//   const startDatePicker = document.getElementById('start');
//   const endDatePicker = document.getElementById('end');
  
//   if (!startDatePicker || !endDatePicker) {
//       console.error("Date picker elements not found");
//       return;
//   }

//   const currentDate = new Date();
//   const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
//   const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
//   startDatePicker.value = formatDateForInput(firstDayOfMonth);
//   endDatePicker.value = formatDateForInput(lastDayOfMonth);
  
//   createOrUpdateDrawingChart();
// }

// function formatDateForInput(date) {
//   const offset = date.getTimezoneOffset();
//   const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
//   return adjustedDate.toISOString().split('T')[0];
// }

// function resetDateAndDrawingChart() {
//   const startDatePicker = document.getElementById('start');
//   const endDatePicker = document.getElementById('end');
  
//   if (!startDatePicker || !endDatePicker) {
//       console.error("Date picker elements not found in resetDateAndDrawingChart");
//       return;
//   }

//   const currentDate = new Date();
//   const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
//   const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
//   startDatePicker.value = formatDateForInput(firstDayOfMonth);
//   endDatePicker.value = formatDateForInput(lastDayOfMonth);
  
//   createOrUpdateDrawingChart();
// }