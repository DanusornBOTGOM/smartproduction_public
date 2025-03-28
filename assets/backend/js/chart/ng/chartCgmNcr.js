(function() {
  Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  Chart.defaults.global.defaultFontColor = '#858796';
  
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

  function combineWasteData(data) {
      console.log("Combining waste data...");
      const groups = {
          'CGM': data.filter(item => item.MachineCode.startsWith('CGM'))
      };

      const result = Object.entries(groups).map(([groupName, groupData]) => {
          const totalWaste = groupData.reduce((sum, item) => sum + parseFloat(item.WasteQuantity), 0);
          return {
              MachineCode: groupName,
              WasteQuantity: totalWaste
          };
      });

      console.log("Combined waste result:", result);
      return result;
  }

  let wasteChartData = null;
  let wasteStartDate = null;
  let wasteEndDate = null;

  async function fetchDataForWasteChart(startDate, endDate) {
      try {
          const url = new URL('/api/wasteChartData', window.location.origin);
          url.searchParams.append('startDate', startDate);
          url.searchParams.append('endDate', endDate);
          url.searchParams.append('machineCodePrefix', 'CGM');
          
          console.log('Fetching waste data from:', url.toString());
          
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log('Raw waste data received:', data);

          return data.summary;
      } catch (error) {
          console.error('Error fetching waste data:', error);
          throw error;
      }
  }

  function showWasteLoading() {
      const chartContainer = document.querySelector('.waste-chart-container');
      chartContainer.innerHTML = '<p class="text-center">Loading waste data...</p>';
  }

  function hideWasteLoading() {
      const chartContainer = document.querySelector('.waste-chart-container');
      chartContainer.innerHTML = '<canvas id="wasteChart"></canvas>';
  }

  let isWasteDetailedView = true;

  async function createOrUpdateWasteChart() {
      showWasteLoading();
      console.log("createOrUpdateWasteChart function called");

      const startDate = document.getElementById('wasteStart').value;
      const endDate = document.getElementById('wasteEnd').value;

      console.log(`Start Date: ${startDate}, End Date: ${endDate}`);

      if (!startDate || !endDate) {
          console.warn('กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุดก่อนกด Filter');
          return;
      }

      const chartContainer = document.querySelector('.waste-chart-container');
      chartContainer.innerHTML = '<p class="text-center">Loading data...</p>';

      try {
          const data = await fetchDataForWasteChart(startDate, endDate);
          console.log("Data fetched for waste chart:", data);

          if (data.length === 0) {
              chartContainer.innerHTML = '<p class="text-center">No waste data available for the selected date range</p>';
              return;
          }

          chartContainer.innerHTML = '<canvas id="wasteChart"></canvas>';
          const wasteChartElement = document.getElementById("wasteChart");

          if (!wasteChartElement) {
              console.error('Waste chart element not found after recreation');
              return;
          }

          const chartData = isWasteDetailedView ? data : combineWasteData(data);
          console.log("Data used for waste chart:", chartData);

          const wasteChartContext = wasteChartElement.getContext('2d');

          if (window.myWasteChart) {
              window.myWasteChart.destroy();
          }

          window.myWasteChart = new Chart(wasteChartContext, {
            type: 'bar',
            plugins: [{
                afterDatasetsDraw: function(chart) {
                    var ctx = chart.ctx;
                    chart.data.datasets.forEach(function(dataset, i) {
                        var meta = chart.getDatasetMeta(i);
                        if (!meta.hidden) {
                            meta.data.forEach(function(element, index) {
                                // Draw the text in black, with the specified font
                                ctx.fillStyle = 'rgb(0, 0, 0)';
                                var fontSize = 12;
                                var fontStyle = 'bold';
                                var fontFamily = 'Arial';
                                ctx.font = Chart.helpers.fontString(fontSize, fontStyle, fontFamily);
        
                                // Format the data value to display
                                var dataString = number_format(dataset.data[index], 1);
        
                                // Make sure alignment settings are correct
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
        
                                var padding = 5;
                                var position = element.tooltipPosition();
                                ctx.fillText(dataString, position.x, position.y - (fontSize / 2) - padding);
                            });
                        }
                    });
                }
            }],
            data: {
                  labels: chartData.map(item => item.MachineCode),
                  datasets: [{
                      label: "Waste",
                      backgroundColor: "#e74a3b",
                      data: chartData.map(item => item.WasteQuantity),
                  }]
              },
              options: {
                  maintainAspectRatio: false,
                  layout: {
                      padding: {
                          left: 10,
                          right: 25,
                          top: 25,
                          bottom: 0
                      }
                  },
                  scales: {
                      xAxes: [{
                          gridLines: {
                              display: true,
                              drawBorder: false
                          },
                          ticks: {
                              maxTicksLimit: 20
                          }
                      }],
                      yAxes: [{
                          ticks: {
                              min: 0,
                              maxTicksLimit: 5,
                              padding: 10,
                              callback: function(value, index, values) {
                                  return number_format(value);
                              }
                          },
                          gridLines: {
                              color: "rgb(234, 236, 244)",
                              zeroLineColor: "rgb(234, 236, 244)",
                              drawBorder: false,
                              borderDash: [2],
                              zeroLineBorderDash: [2]
                          }
                      }]
                  },
                  legend: {
                      display: true
                  },
                  tooltips: {
                      backgroundColor: "rgb(255,255,255)",
                      bodyFontColor: "#858796",
                      titleMarginBottom: 10,
                      titleFontColor: '#6e707e',
                      titleFontSize: 14,
                      borderColor: '#dddfeb',
                      borderWidth: 1,
                      xPadding: 15,
                      yPadding: 15,
                      displayColors: false,
                      intersect: false,
                      mode: 'index',
                      caretPadding: 10,
                      callbacks: {
                          label: function(tooltipItem, chart) {
                              var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
                              var value = number_format(tooltipItem.yLabel, 1);
                              return datasetLabel + ': ' + value;
                          }
                      }
                  }
              }
          });

      } catch (error) {
          hideWasteLoading();
          console.error('Error creating waste chart:', error);
          alert('Error creating waste chart. Please try again later.');
      }
  }

  document.addEventListener("DOMContentLoaded", function() {
      console.log("DOM fully loaded for waste chart");
      setTimeout(() => {
          initializeWasteChart();
      }, 100);

      const filterButton = document.getElementById('wasteFilterButton');
      if (filterButton) {
          filterButton.addEventListener('click', createOrUpdateWasteChart);
      } else {
          console.error("Waste filter button not found");
      }

      const resetButton = document.getElementById('wasteResetButton');
      if (resetButton) {
          resetButton.addEventListener('click', resetWasteDateAndChart);
      } else {
          console.error("Waste reset button not found");
      }
  });

  function initializeWasteChart() {
      const startDatePicker = document.getElementById('wasteStart');
      const endDatePicker = document.getElementById('wasteEnd');
      
      if (!startDatePicker || !endDatePicker) {
          console.error("Waste date picker elements not found");
          return;
      }

      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      startDatePicker.value = formatDateForInput(firstDayOfMonth);
      endDatePicker.value = formatDateForInput(lastDayOfMonth);

      createOrUpdateWasteChart();
  }

  function formatDateForInput(date) {
      const offset = date.getTimezoneOffset();
      const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
      return adjustedDate.toISOString().split('T')[0];
  }

  function resetWasteDateAndChart() {
      initializeWasteChart();
  }

})();