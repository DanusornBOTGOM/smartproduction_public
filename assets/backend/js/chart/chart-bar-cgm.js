
let isPercentageView = true; // true for %POP, false for Plan/Actual

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
  const totalAdjustedActual = data.reduce((sum, item) => sum + item.AdjustedActualQuantity, 0);
  const combinedPercentage = totalPlan > 0 ? (totalAdjustedActual / totalPlan) * 100 : 0;
  const result = [{
      MachineCode: 'All CGM Machines',
      PlanQuantity: totalPlan,
      ActualQuantity: totalAdjustedActual,
      AdjustedActualQuantity: totalAdjustedActual,
      Percentage: combinedPercentage
  }];
  console.log("Combined result:", result);
  return result;
}

let cachedData = null;
let cachedStartDate = null;
let cachedEndDate = null;

async function fetchDataForBarChart(startDate, endDate) {
  try {
      const url = new URL('/api/chartProductionDataCGM', window.location.origin);
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

      const finalData = data.sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));
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

let isDetailedView = true;

async function createOrUpdateBarChart() {
    try {
        showLoading();
        console.log("createOrUpdateBarChart function called");
        
        const startDatePicker = document.getElementById('start');
        const endDatePicker = document.getElementById('end');
        
        if (!startDatePicker || !endDatePicker) {
            throw new Error("Date picker elements not found");
        }

        const startDate = startDatePicker.value;
        const endDate = endDatePicker.value;

        if (!startDate || !endDate) {
            throw new Error("Please select both start and end dates");
        }

        // คำนวณวันที่สำหรับ title
        const startDateTime = new Date(startDate + 'T08:00:00');
        const endDateTime = new Date(new Date(endDate + 'T07:59:59').getTime() + 86400000);

        const formatDate = (date) => {
            return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const titleText = `ข้อมูลแสดงผลตั้งแต่ 08:00 น. ของวันที่ ${formatDate(startDateTime)} ถึง 07:59:59 น. ของวันที่ ${formatDate(endDateTime)}`;

        const data = await fetchDataForBarChart(startDate, endDate);
        console.log("Raw data received:", data);

        // if (!Array.isArray(data) || data.length === 0) {
        //     throw new Error("No data available for the selected date range");
        // }

        const chartContainer = document.querySelector('.chart-container');
        if (!chartContainer) {
            throw new Error("Chart container not found");
        }

        chartContainer.innerHTML = '<canvas id="productionChart"></canvas>';
        
        const barChartElement = document.getElementById("productionChart");
        if (!barChartElement) {
            throw new Error("Chart element not found after recreation");
        }

        if (data.length === 0) {
            chartContainer.innerHTML = '<p class="text-center">ยังไม่มีข้อมูล Actual จาก Barcode ออกมา รอมีน้ำหนักออก</p>';
            return;
        }

        const barChartContext = barChartElement.getContext('2d');

        // Process data based on view type
        let processedData = data;
        
        // Check if we're in combined view
        if (!isDetailedView) {
            console.log("Processing combined view...");
            const combinedData = {
                PlanQuantity: 0,
                ActualQuantity: 0,
                AdjustedActualQuantity: 0,
                DocNos: new Set()
            };

            // Safely combine data
            data.forEach(item => {
                combinedData.PlanQuantity += Number(item.PlanQuantity) || 0;
                combinedData.ActualQuantity += Number(item.ActualQuantity) || 0;
                combinedData.AdjustedActualQuantity += Number(item.AdjustedActualQuantity) || 0;
                if (Array.isArray(item.DocNos)) {
                    item.DocNos.forEach(docNo => combinedData.DocNos.add(docNo));
                }
            });

            // Calculate percentage
            const percentage = combinedData.PlanQuantity > 0 
                ? (combinedData.AdjustedActualQuantity / combinedData.PlanQuantity) * 100 
                : 0;

            processedData = [{
                MachineCode: 'All CGM Machines',
                PlanQuantity: combinedData.PlanQuantity,
                ActualQuantity: combinedData.ActualQuantity,
                AdjustedActualQuantity: combinedData.AdjustedActualQuantity,
                Percentage: percentage,
                DocNos: Array.from(combinedData.DocNos)
            }];
            
            console.log("Combined data:", processedData);
        } else {
            // Detailed view processing
            console.log("Processing detailed view...");
            const machineGroups = {};
            
            data.forEach(item => {
                const machineCode = item.MachineCode || 'Unknown';
                if (!machineGroups[machineCode]) {
                    machineGroups[machineCode] = {
                        planTotal: 0,
                        actualTotal: 0,
                        adjustedActualTotal: 0,
                        docNos: new Set()
                    };
                }
                
                machineGroups[machineCode].planTotal += Number(item.PlanQuantity) || 0;
                machineGroups[machineCode].actualTotal += Number(item.ActualQuantity) || 0;
                machineGroups[machineCode].adjustedActualTotal += Number(item.AdjustedActualQuantity) || 0;
                if (Array.isArray(item.DocNos)) {
                    item.DocNos.forEach(docNo => machineGroups[machineCode].docNos.add(docNo));
                }
            });

            processedData = Object.keys(machineGroups).map(machineCode => ({
                MachineCode: machineCode,
                PlanQuantity: machineGroups[machineCode].planTotal,
                ActualQuantity: machineGroups[machineCode].actualTotal,
                AdjustedActualQuantity: machineGroups[machineCode].adjustedActualTotal,
                Percentage: machineGroups[machineCode].planTotal > 0 
                    ? (machineGroups[machineCode].adjustedActualTotal / machineGroups[machineCode].planTotal) * 100 
                    : 0,
                DocNos: Array.from(machineGroups[machineCode].docNos)
            }));
        }

        // Destroy existing chart if it exists
        if (window.myBarChart) {
            window.myBarChart.destroy();
        }

        // Create datasets based on view type
        let datasets;
        if (isPercentageView) {
            datasets = [{
                label: "%Production On Plan",
                backgroundColor: processedData.map(item => 
                    item.Percentage >= 95 ? "#1cc88a" : "#e74a3b"
                ),
                data: processedData.map(item => item.Percentage),
                hoverBackgroundColor: processedData.map(item => 
                    item.Percentage >= 95 ? "#17a673" : "#c23616"
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
                    data: processedData.map(item => item.PlanQuantity),
                },
                {
                    label: "Actual",
                    backgroundColor: processedData.map(item => {
                        return item.Percentage >= 95 ? "#1cc88a" : "#e74a3b";
                    }),
                    data: processedData.map(item => item.AdjustedActualQuantity),
                    borderColor: "#ffffff",
                    barPercentage: 0.5,
                    categoryPercentage: 0.8
                }
            ];
        }

        // Create new chart
        window.myBarChart = new Chart(barChartContext, {
            type: 'bar',
            plugins: [{
                id: 'customDataLabels',
                afterDatasetsDraw(chart, args, options) {
                    const { ctx, data } = chart;
        
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
                labels: processedData.map(item => item.MachineCode),
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
                        bodyColor: "#000000",
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
                                var item = processedData[context.dataIndex];
                                return [
                                    `${label}: ${value}`,
                                    `Total Actual: ${number_format(item.ActualQuantity, 1)}`,
                                    `Total Plan: ${number_format(item.PlanQuantity, 1)}`,
                                    `DocNo(s): ${item.DocNos.join(', ')}`,
                                    `Machine: ${item.MachineCode}`
                                ];
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

    } catch (error) {
        console.error('Error in createOrUpdateBarChart:', error);
        hideLoading();
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `<p class="text-center text-danger">Error: ${error.message}</p>`;
        }
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
      this.textContent = isDetailedView ? "Show Combined View" : "Show Detailed View";
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
        "%Production On Plan (CGM)" : "Plan vs Actual Production (CGM)";
      createOrUpdateBarChart();
    });
  } else {
    console.log("Toggle chart view button not found, skipping event listener");
  }

  // const exportExcelButton = document.getElementById('exportExcelButton');
  // if (exportExcelButton) {
  //     exportExcelButton.addEventListener('click', exportToExcel);
  // } else {
  //     console.log("Export Excel button not found, skipping event listener");
  // }

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



// async function exportToExcel() {
//     if (!window.myBarChart) {
//         alert('ไม่พบข้อมูลกราฟ กรุณาสร้างกราฟก่อนส่งออกเป็น Excel');
//         return;
//     }

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('CGM Report');

//     // กำหนด columns
//     worksheet.columns = [
//         { header: 'MachineCode', key: 'machineCode', width: 15 },
//         { header: 'Plan', key: 'plan', width: 10, style: { numFmt: '#,##0.00' } },
//         { header: 'Actual', key: 'actual', width: 10, style: { numFmt: '#,##0.00' } },
//         { header: 'AdjustedActual', key: 'adjustedActual', width: 15, style: { numFmt: '#,##0.00' } },
//         { header: '%POP', key: 'pop', width: 10, style: { numFmt: '0.00%' } }
//     ];

//     // สร้าง style สำหรับ header
//     const headerStyle = {
//         font: { bold: true, color: { argb: 'FFFFFFFF' } },
//         fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }
//     };

//     // ใส่ style ให้ header
//     worksheet.getRow(1).eachCell((cell) => {
//         cell.style = headerStyle;
//     });

//     // ดึงข้อมูลจากกราฟ
//     const labels = window.myBarChart.data.labels;
//     const datasets = window.myBarChart.data.datasets;
//     const planData = datasets.find(ds => ds.label === "Plan")?.data || [];
//     const actualData = datasets.find(ds => ds.label === "Actual")?.data || [];
//     const adjustedActualData = datasets.find(ds => ds.label === "AdjustedActual")?.data || actualData;
//     const popData = datasets.find(ds => ds.label === "%Production On Plan")?.data || [];

//     // เพิ่มข้อมูลลงใน worksheet
//     labels.forEach((label, index) => {
//         worksheet.addRow({
//             machineCode: label,
//             plan: planData[index] || 0,
//             actual: actualData[index] || 0,
//             adjustedActual: adjustedActualData[index] || 0,
//             pop: (popData[index] || 0) / 100 // แปลงเป็นทศนิยม
//         });
//     });

//     // สร้างไฟล์ Excel
//     const buffer = await workbook.xlsx.writeBuffer();
//     const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
//     const url = window.URL.createObjectURL(blob);

//     // สร้าง link และ trigger การดาวน์โหลด
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `cgm_report_${new Date().toISOString().split('T')[0]}.xlsx`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
// }