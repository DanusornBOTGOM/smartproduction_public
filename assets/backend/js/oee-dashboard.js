const CONFIG = {
    CHART_COLORS: {
        oee: 'rgb(75, 192, 192)',
        availability: 'rgb(255, 99, 132)',
        performance: 'rgb(54, 162, 235)',
        quality: 'rgb(255, 206, 86)'
    }
};

if (!window.dateUtils) {
    console.error('dateUtils not loaded');
    // อาจเพิ่ม fallback function หรือแจ้งเตือนผู้ใช้
}

function formatDate(date) {
    try {
        return window.dateUtils.formatDate(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.handleMorningTalkChange = async function(input) {
        const button = input.nextElementSibling;
        button.disabled = true;
        button.textContent = 'Saving...';
    
        try {
            const date = input.dataset.date;
            const machineCode = input.dataset.machine;
            const downtime = parseFloat(input.value) || 15;
    
            const response = await fetch('/api/oee/morningTalk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date,
                    machineCode,
                    downtime
                })
            });
    
            if (!response.ok) {
                throw new Error('Failed to update Morning Talk');
            }
    
            const result = await response.json();
            if (result.success && result.data) {
                // อัพเดท UI ด้วยข้อมูลใหม่
                updateDashboard(result.data);
            }
    
            button.textContent = 'Saved!';
            setTimeout(() => {
                button.textContent = 'Save';
                button.disabled = false;
            }, 1000);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to update Morning Talk minutes');
            input.value = input.defaultValue;
            button.textContent = 'Save';
            button.disabled = false;
        }
    }

    // Initialize UI
    let elements = null;
    let oeeChartInstance = null;

    async function initializeApp() {
        elements = initializeElements();
        if (!elements) return;
    
        oeeChartInstance = initializeChart();
        initializeDateRange();
        setupEventListeners();
        
        // โหลดข้อมูลเครื่องแรก
        await loadMachines();
        
        // เลือกเครื่องที่ต้องการเป็นค่าเริ่มต้น
        const defaultMachine = 'CUT001';  // หรือเครื่องที่ต้องการ
        if (elements.machineSelect.options.length > 0) {
            for(let i = 0; i < elements.machineSelect.options.length; i++) {
                if (elements.machineSelect.options[i].value === defaultMachine) {
                    elements.machineSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        await updateOEEData();
    }

//     await loadMachines();
    
//     // เลือกเครื่องที่ต้องการเป็นค่าเริ่มต้น
//     const defaultMachine = 'CGM001';  // หรือเครื่องที่ต้องการ
//     if (elements.machineSelect.options.length > 0) {
//         for(let i = 0; i < elements.machineSelect.options.length; i++) {
//             if (elements.machineSelect.options[i].value === defaultMachine) {
//                 elements.machineSelect.selectedIndex = i;
//                 break;
//             }
//         }
//     }
    
//     await updateOEEData();
// }

    function initializeElements() {
        const elements = {
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            machineSelect: document.getElementById('machineCode'),
            searchBtn: document.getElementById('searchBtn'),
            oeeChart: document.getElementById('oeeChart'),
            errorMessage: document.getElementById('errorMessage')
        };

        if (!validateElements(elements)) {
            showError('Required elements not found');
            return null;
        }

        return elements;
    }

    function initializeConsoleDisplay() {
        const consoleDiv = document.createElement('div');
        consoleDiv.id = 'browserConsole';
        consoleDiv.style.cssText = `
            position: fixed;
            bottom: ${CONFIG.UI.console.bottomPosition};
            right: ${CONFIG.UI.console.rightPosition};
            width: ${CONFIG.UI.console.width};
            max-height: ${CONFIG.UI.console.height};
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            border: 1px solid #333;
            border-radius: 5px;
        `;

        const toggleButton = document.createElement('button');
        toggleButton.textContent = '🔍 Console';
        toggleButton.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 1001;
            padding: 5px 10px;
            background: #333;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;

        toggleButton.onclick = () => {
            consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
        };

        document.body.appendChild(toggleButton);
        document.body.appendChild(consoleDiv);

        // Override console.log
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            originalConsoleLog.apply(console, args);
            
            const logEntry = document.createElement('div');
            logEntry.style.cssText = `
                border-bottom: 1px solid #333;
                padding: 5px 0;
                font-family: monospace;
            `;
            
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return arg;
            }).join(' ');

            logEntry.innerHTML = `
                <span style="color: #888;">${new Date().toLocaleTimeString()}</span>
                <pre style="margin: 0; white-space: pre-wrap;">${message}</pre>
            `;

            const consoleDiv = document.getElementById('browserConsole');
            if (consoleDiv) {
                consoleDiv.appendChild(logEntry);
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
                
                while (consoleDiv.children.length > 100) {
                    consoleDiv.removeChild(consoleDiv.firstChild);
                }
            }
        };
    }

    function validateElements(elements) {
        return Object.values(elements).every(element => element !== null);
    }

    function setupEventListeners() {
        elements.searchBtn.addEventListener('click', updateOEEData);
        elements.startDate.addEventListener('change', validateDates);
        elements.endDate.addEventListener('change', validateDates);
        setupExportButton();
    }

    function initializeDateRange() {
        const today = new Date();
        // ใช้ dateUtils แทน
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        elements.startDate.value = dateUtils.formatDate(firstDayOfMonth);
        elements.endDate.value = dateUtils.formatDate(lastDayOfMonth);
    
        console.log('Date range initialized:', {
            start: elements.startDate.value,
            end: elements.endDate.value
        });
    }

 

function initializeChart() {
    const canvas = elements.oeeChart;
    const container = document.createElement('div');
    container.className = 'chart-container';
    canvas.parentNode.insertBefore(container, canvas);
    container.appendChild(canvas);

    // กำหนดสีที่สดใสและสวยงาม
    const chartColors = {
        oee: {
            main: 'rgb(65, 105, 225)', // Royal Blue
            background: 'rgba(65, 105, 225, 0.7)'
        },
        availability: {
            main: 'rgb(255, 99, 132)', // Pink
            background: 'rgba(255, 99, 132, 0.7)'
        },
        performance: {
            main: 'rgb(50, 205, 50)', // Lime Green
            background: 'rgba(50, 205, 50, 0.7)'
        },
        quality: {
            main: 'rgb(255, 165, 0)', // Orange
            background: 'rgba(255, 165, 0, 0.7)'
        }
    };

    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'OEE %',
                    data: [],
                    backgroundColor: chartColors.oee.background,
                    borderColor: chartColors.oee.main,
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 25
                },
                {
                    label: 'Availability %',
                    data: [],
                    backgroundColor: chartColors.availability.background,
                    borderColor: chartColors.availability.main,
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 25,
                    hidden: true
                },
                {
                    label: 'Performance %',
                    data: [],
                    backgroundColor: chartColors.performance.background,
                    borderColor: chartColors.performance.main,
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 25,
                    hidden: true
                },
                {
                    label: 'Quality %',
                    data: [],
                    backgroundColor: chartColors.quality.background,
                    borderColor: chartColors.quality.main,
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 25,
                    hidden: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(200, 200, 200, 0.3)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 10,
                        callback: function(value) {
                            return value + '%';
                        },
                        color: '#666'
                    },
                    title: {
                        display: true,
                        text: 'Percentage (%)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {top: 20, bottom: 20},
                        color: '#333'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 10,
                        color: '#666'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {top: 20, bottom: 20},
                        color: '#333'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 15,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1) + '%';
                            }
                            return label;
                        }
                    },
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                },
                legend: {
                    position: 'top',
                    align: 'center',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#333',
                        generateLabels: function(chart) {
                            const datasets = chart.data.datasets;
                            return datasets.map((dataset, i) => ({
                                text: dataset.label,
                                fillStyle: dataset.backgroundColor,
                                strokeStyle: dataset.borderColor,
                                lineWidth: 2,
                                hidden: !chart.isDatasetVisible(i),
                                index: i
                            }));
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 30,
                    right: 20,
                    bottom: 20,
                    left: 20
                }
            }
        }
    });
}

// Add CSS
const style = document.createElement('style');
style.textContent = `
    .chart-container {
        position: relative;
        height: 60vh;
        width: 100%;
        margin: 20px 0;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .av-row td {
        padding: 4px 8px;
    }
    
    .av-row td:not(:first-child):not(:nth-child(2)):not(:nth-child(3)) {
        text-align: right;
    }
    
    .total-losstime {
        font-weight: bold;
        background-color: #f5f5f5;
    }
    
    .total-losstime td {
        border-top: 2px solid #ddd;
    }

    .morning-talk-cell {
        position: relative;
        min-width: 100px;
    }

    .morning-talk-container {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .value-container {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .edit-container {
        display: none;
        flex-direction: column;
        gap: 5px;
    }

    .mt-input {
        width: 50px;
        text-align: right;
        padding: 2px 4px;
    }

    .edit-all-btn {
        margin-left: 10px;
        font-size: 0.9em;
        padding: 2px 10px;
    }

    .morning-talk-container {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 5px;
    }

    .mt-input {
        width: 50px !important;
        text-align: right;
        padding: 2px 4px;
        display: none;
    }

    .mt-value {
        display: inline-block;
        min-width: 30px;
        text-align: right;
    }

    /* สำหรับโหมดแก้ไข */
    .editing .mt-input {
        display: inline-block;
    }

    .editing .mt-value {
        display: none;
    }
`;
document.head.appendChild(style);

    async function loadMachines() {
        try {
            const response = await fetch('/api/machines');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const machines = await response.json();
            populateMachineSelect(machines);
        } catch (error) {
            showError(`Error loading machines: ${error.message}`);
        }
    }

    function populateMachineSelect(machines) {
        const select = elements.machineSelect;
        if (!select) return;
        
        select.innerHTML = '';
        
        try {
            // กรองและแปลง MachineCode โดยตัด '-' ออกทั้งหมด
            const validMachines = machines
                .filter(m => m && m.MachineCode)
                .map(m => ({
                    ...m,
                    MachineCode: m.MachineCode.includes('-') ?
                        m.MachineCode.substring(0, m.MachineCode.indexOf('-')) :
                        m.MachineCode
                }))
                .sort((a, b) => String(a.MachineCode).localeCompare(String(b.MachineCode)));
    
            // ใช้ Set เพื่อกรอง MachineCode ที่ซ้ำ
            const uniqueMachines = Array.from(
                new Set(validMachines.map(m => m.MachineCode))
            ).sort();
    
            // เพิ่มตัวเลือกเครื่องจักร
            uniqueMachines.forEach(machineCode => {
                const option = document.createElement('option');
                option.value = machineCode;
                option.textContent = machineCode;
                select.appendChild(option);
            });
    
            // เพิ่ม All Machines ไว้ท้ายสุด
            const allOption = document.createElement('option');
            allOption.value = "";
            allOption.textContent = "All Machines";
            select.appendChild(allOption);
    
            console.log(`Loaded ${uniqueMachines.length} machines successfully`);
        } catch (error) {
            console.error('Error populating machine select:', error);
            showError('Failed to load machine list');
        }
    }

    async function updateOEEData() {
        try {
            if (!validateDates()) return;
    
            const startDate = new Date(elements.startDate.value);
            const endDate = new Date(elements.endDate.value);
    
            console.log('Fetching data for:', { startDate, endDate });
            const machineCode = elements.machineSelect.value;
    
            console.log('🔍 Request Parameters:', {
                startDate: startDate,
                endDate: endDate,
                machineCode: machineCode || 'All Machines'
            });
    
            const response = await fetch(`/api/oee/summary?startDate=${startDate}&endDate=${endDate}&machineCode=${machineCode}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            if (data.success) {
                console.group('📊 OEE Data Results');
                console.log('Status:', data.data.status);
                if (data.data.cacheInfo) {
                    console.log('Cache Statistics:', {
                        hits: data.data.cacheInfo.stats.hits,
                        misses: data.data.cacheInfo.stats.misses,
                        keys: data.data.cacheInfo.stats.keys
                    });
                }
                console.log('Metrics:', {
                    overall: data.data.overall,
                    recordCount: data.data.dailyMetrics.length
                });
                console.groupEnd();
    
                updateDashboard(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch OEE data');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            showError(error.message);
        }
    }

    function showError(message) {
        if (elements.errorMessage) {
            elements.errorMessage.className = 'alert alert-danger';
            elements.errorMessage.textContent = message;
            elements.errorMessage.style.display = 'block';
            setTimeout(() => {
                elements.errorMessage.style.display = 'none';
            }, 5000);
        }
        console.error(message); // เพิ่ม log ในกรณี error
    }

    function validateDates() {
        const start = new Date(elements.startDate.value);
        const end = new Date(elements.endDate.value);
        
        if (end < start) {
            showError('End date must be after start date');
            return false;
        }

        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 365) {
            showError('Date range cannot exceed 1 year');
            return false;
        }

        return true;
    }

    function updateDashboard(data) {
        updateMetricCards(data.overall);
        updateChart(data.dailyMetrics);
        updateTable(data.dailyMetrics);
    }

    function updateMetricCards(overall) {
        document.getElementById('oeeValue').textContent = `${formatNumber(overall.oee)}%`;
        document.getElementById('availabilityValue').textContent = `${formatNumber(overall.availability)}%`;
        document.getElementById('performanceValue').textContent = `${formatNumber(overall.performance)}%`;
        document.getElementById('qualityValue').textContent = `${formatNumber(overall.quality)}%`;
    }

    function updateDashboard(data) {
        if (!data) {
            console.error('No data received');
            return;
        }
    
        try {
            // ตรวจสอบว่ามีข้อมูล overall หรือไม่
            if (data.overall) {
                updateMetricCards(data.overall);
            }
    
            // ตรวจสอบว่ามีข้อมูล dailyMetrics หรือไม่
            if (Array.isArray(data.dailyMetrics)) {
                updateChart(data.dailyMetrics);
                updateTable(data.dailyMetrics);
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
            showError('Error updating dashboard');
        }
    }
    
    function updateMetricCards(overall) {
        // ป้องกันกรณี overall เป็น undefined
        if (!overall) return;
    
        document.getElementById('oeeValue').textContent = `${formatNumber(overall.oee || 0)}%`;
        document.getElementById('availabilityValue').textContent = `${formatNumber(overall.availability || 0)}%`;
        document.getElementById('performanceValue').textContent = `${formatNumber(overall.performance || 0)}%`;
        document.getElementById('qualityValue').textContent = `${formatNumber(overall.quality || 0)}%`;
    }
    
    function updateChart(metrics) {
        try {
            if (!Array.isArray(metrics)) {
                console.error('Invalid metrics data:', metrics);
                return;
            }
    
            // กรองข้อมูลตามช่วงวันที่ที่เลือก
            const startDate = new Date(elements.startDate.value);
            const endDate = new Date(elements.endDate.value);
            const allDates = [];
            const currentDate = new Date(startDate);
    
            while (currentDate <= endDate) {
                allDates.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
    
            console.log("Generated dates:", allDates);
    
            // แปลงข้อมูลให้ครบทุกวัน
            const fullData = allDates.map(date => {
                if (!(date instanceof Date)) {
                    console.error('Invalid date object:', date);
                    return {
                        date: new Date(),
                        metrics: {
                            oee: 0,
                            availability: 0,
                            performance: 0,
                            quality: 0
                        }
                    };
                }
    
                const metric = metrics.find(m => {
                    try {
                        const mDate = new Date(m.date);
                        return mDate.toDateString() === date.toDateString();
                    } catch (error) {
                        console.error('Error comparing dates:', error);
                        return false;
                    }
                });
    
                return {
                    date: date,
                    metrics: metric?.metrics || {
                        oee: 0,
                        availability: 0,
                        performance: 0,
                        quality: 0
                    }
                };
            });
    
            console.log("Processed data:", fullData);
    
            // อัพเดทกราฟ
            if (oeeChartInstance) {
                oeeChartInstance.data.labels = fullData.map(d => {
                    try {
                        if (d.date instanceof Date) {
                            return d.date.getDate().toString();
                        }
                        return '0';
                    } catch (error) {
                        console.error('Error formatting date label:', error);
                        return '0';
                    }
                });
    
                oeeChartInstance.data.datasets = [
                    {
                        label: 'OEE %',
                        data: fullData.map(d => d?.metrics?.oee || 0),
                        backgroundColor: CONFIG.CHART_COLORS.oee,
                        borderColor: CONFIG.CHART_COLORS.oee,
                        tension: 0.1
                    },
                    {
                        label: 'Availability %',
                        data: fullData.map(d => d?.metrics?.availability || 0),
                        backgroundColor: CONFIG.CHART_COLORS.availability,
                        borderColor: CONFIG.CHART_COLORS.availability,
                        tension: 0.1,
                        hidden: true
                    },
                    {
                        label: 'Performance %',
                        data: fullData.map(d => d?.metrics?.performance || 0),
                        backgroundColor: CONFIG.CHART_COLORS.performance,
                        borderColor: CONFIG.CHART_COLORS.performance,
                        tension: 0.1,
                        hidden: true
                    },
                    {
                        label: 'Quality %',
                        data: fullData.map(d => d?.metrics?.quality || 0),
                        borderColor: CONFIG.CHART_COLORS.quality,
                        backgroundColor: CONFIG.CHART_COLORS.quality,
                        tension: 0.1,
                        hidden: true
                    }
                ];
    
                oeeChartInstance.update();
            }
        } catch (error) {
            console.error('Error in updateChart:', error);
        }
    }

    function mapMetricToDate(metrics, date) {
        try {
            // ตรวจสอบ input
            if (!Array.isArray(metrics) || !(date instanceof Date)) {
                console.error('Invalid input:', { metrics, date });
                return getEmptyMetric();
            }
    
            // แปลงวันที่ที่ต้องการค้นหาเป็น YYYY-MM-DD
            const searchDate = date.toISOString().split('T')[0];
            
            // ค้นหา metric ที่ตรงกับวันที่
            const metric = metrics.find(m => {
                if (m && m.date) {
                    const mDate = new Date(m.date);
                    const metricDate = mDate.toISOString().split('T')[0];
                    
                    // Log เพื่อ debug
                    console.log('Date comparison:', {
                        searchDate,
                        metricDate,
                        metrics: {
                            performance: m.metrics?.performance,
                            oee: m.metrics?.oee
                        },
                        details: {
                            actualQty: m.details?.actualQty,
                            plannedQty: m.details?.plannedQty,
                            totalQty: m.TotalQuantity, // ตรวจสอบค่านี้
                            calculatedPerformance: m.details?.actualQty / m.details?.plannedQty
                        }
                    });
    
                    return searchDate === metricDate;
                }
                return false;
            });
    
            if (!metric) {
                return getEmptyMetric();
            }
    
            // คำนวณ performance ใหม่จากข้อมูลที่ถูกต้อง
            const recalculatedPerformance = metric.details?.plannedQty > 0 
                ? (metric.details?.actualQty / metric.details?.plannedQty) * 100 
                : 0;
    
            // Log ผลลัพธ์สุดท้าย
            console.log('Final metric:', {
                date: searchDate,
                originalPerformance: metric.metrics?.performance,
                recalculatedPerformance,
                oee: metric.metrics?.oee
            });
    
            // สร้าง object ใหม่พร้อมค่าที่คำนวณใหม่
            return {
                ...metric,
                details: {
                    ...metric.details,
                    WorkingMinutes: metric.details?.WorkingMinutes || 0,
                    WorkingHours: metric.details?.WorkingHours || 0,
                    actualQty: metric.details?.actualQty || 0,
                    plannedQty: metric.details?.plannedQty || 0,
                    NgQuantity: metric.details?.NgQuantity || 0,
                    losstime: metric.details?.losstime || [],
                    totalLosstime: metric.details?.totalLosstime || 0
                },
                metrics: {
                    ...metric.metrics,
                    availability: metric.metrics?.availability || 0,
                    performance: recalculatedPerformance, // ใช้ค่าที่คำนวณใหม่
                    quality: metric.metrics?.quality || 0,
                    oee: metric.metrics?.oee || 0
                }
            };
        } catch (error) {
            console.error('Error in mapMetricToDate:', error);
            console.error('Error details:', {
                date: date?.toISOString(),
                metricsLength: metrics?.length
            });
            return getEmptyMetric();
        }
    }
    
    // เพิ่มฟังก์ชันนี้ด้วย
    function getEmptyMetric() {
        return {
            details: {
                WorkingMinutes: 0,
                WorkingHours: 0,
                actualQty: 0,
                plannedQty: 0,
                NgQuantity: 0,
                losstime: [],
                totalLosstime: 0
            },
            metrics: {
                availability: 0,
                performance: 0,
                quality: 0,
                oee: 0
            }
        };
    }

    function updateTable(metrics) {
        // เพิ่ม debug log ตรงนี้
        console.log('Metrics before display:', metrics.map(m => ({
            date: m.date,
            performance: m.metrics.performance,
            oee: m.metrics.oee
        })));
        const tbody = document.querySelector('#oeeTable tbody');
        const thead = document.querySelector('#oeeTable thead');
        if (!tbody || !thead) return;

        // กรองข้อมูลตามช่วงวันที่ที่เลือก
        const startDate = new Date(elements.startDate.value);
        const endDate = new Date(elements.endDate.value);
        
        const filteredMetrics = Object.values(metrics).filter(metric => {
            const metricDate = new Date(metric.date);
            return metricDate >= startDate && metricDate <= endDate;
        });
    
        const sortedMetrics = filteredMetrics.sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
    
        // สร้างวันที่ทั้งหมดในช่วง
        const allDates = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            allDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        const headerRows = `
        <tr>
            <th colspan="3">
                การวิเคราะห์ OEE ${elements.machineSelect.value}
                <button onclick="handleEditAllMorningTalk(this)" 
                        class="btn btn-sm btn-primary edit-all-btn"
                        style="margin-left: 10px;">
                    Edit Morning Talk
                </button>
            </th>
            ${allDates.map(date => `<th>${date.getDate()}</th>`).join('')}
        </tr>
        <tr>
            <th colspan="3">เวลาทำงาน (ชั่วโมง)</th>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<th>${formatNumber(metric.details.WorkingHours || 0, 0)}</th>`;
            }).join('')}
        </tr>
    `;
    thead.innerHTML = headerRows;
    
    // Debug log สำหรับการ map ข้อมูล
    allDates.forEach(date => {
        const metric = mapMetricToDate(sortedMetrics, date);
        console.log(`Data for ${date.toISOString().split('T')[0]}:`, {
            workingMinutes: metric.details.WorkingMinutes,
            workingHours: metric.details.WorkingHours
        });
    });

    // เก็บทุก CauseCode ที่มีในข้อมูล
    const allCauseCodes = new Set();
    metrics.forEach(metric => {
        if (metric.details && metric.details.losstime) {
            metric.details.losstime.forEach(loss => {
                if (loss.causeCode) {
                    allCauseCodes.add(loss.causeCode);
                }
            });
        }
    });

    const tableRows = `
<tr class="working-row">
    <td rowspan="3">Working</td>
    <td colspan="2">เวลาทำงาน (นาที)</td>
    ${allDates.map(date => {
        const metric = mapMetricToDate(sortedMetrics, date);
        const workingMinutes = metric.details?.WorkingMinutes || 0;
        return `<td>${formatNumber(workingMinutes || 0, 0)}</td>`;
    }).join('')}
</tr>

<tr class="working-row">
    <td colspan="2">แผน Down time</td>
    ${allDates.map(date => {
        const metric = mapMetricToDate(sortedMetrics, date);
        const workingMinutes = metric.details?.WorkingMinutes || 0;
        let plannedDowntime = 0;
        if (workingMinutes > 0) {
            if (workingMinutes >= 1440) {
                plannedDowntime = 220;
            } else if (workingMinutes >= 960) {
                plannedDowntime = 160;
            } else if (workingMinutes >= 480) {
                plannedDowntime = 80;
            }
        }
        return `<td>${formatNumber(plannedDowntime || 0, 0)}</td>`;
    }).join('')}
</tr>

<tr class="working-row">
    <td colspan="2">เวลาที่ใช้ (นาที)</td>
    ${allDates.map(date => {
        const metric = mapMetricToDate(sortedMetrics, date);
        const workingMinutes = metric.details?.WorkingMinutes || 0;
        let plannedDowntime = 0;
        if (workingMinutes > 0) {
            if (workingMinutes >= 1440) {
                plannedDowntime = 220;
            } else if (workingMinutes >= 960) {
                plannedDowntime = 160;
            } else if (workingMinutes >= 480) {
                plannedDowntime = 80;
            }
        }
        return `<td>${formatNumber(workingMinutes > 0 ? workingMinutes - plannedDowntime : 0, 0)}</td>`;
    }).join('')}
</tr>

<!-- AV Section -->
${(() => {
    console.log("Starting AV section generation...");
    console.log("Metrics:", metrics);

    // เพิ่ม Morning Talk row ก่อน
    const morningTalkRow = `
    <tr class="av-row">
        <td>AV</td>
        <td colspan="2">1.Morning Talk (G01)</td>
        ${allDates.map(date => {
            const metric = mapMetricToDate(sortedMetrics, date);
            const morningTalk = metric.details?.losstime?.find(l => l.causeCode === 'G01');
            const morningTalkValue = morningTalk ? morningTalk.downtime : 0;

            return `<td>
                <div class="morning-talk-container">
                    <span class="mt-value">${morningTalkValue}</span>
                    <input type="number" 
                        value="${morningTalkValue}"
                        min="0"
                        class="mt-input form-control"
                        data-date="${formatDate(date)}"
                        data-machine="${metric.machineCode}"
                        style="display: none; width: 50px;">
                </div>
            </td>`;
        }).join('')}
    </tr>`;

    // button handle
    window.handleEditAllMorningTalk = function(button) {
        const table = button.closest('table');
        
        // ถ้าปุ่มยังไม่ได้กดแก้ไข
        if (!button.classList.contains('editing')) {
            // เข้าสู่โหมดแก้ไข
            button.classList.add('editing');
            button.textContent = 'Save All';
            button.classList.replace('btn-primary', 'btn-success');
            
            // แสดง input ทุกช่อง
            const inputs = table.querySelectorAll('.mt-input');
            const values = table.querySelectorAll('.mt-value');
            
            inputs.forEach(input => {
                input.style.display = 'inline-block';
                input.dataset.original = input.value; // เก็บค่าเดิมไว้
            });
            
            values.forEach(value => {
                value.style.display = 'none';
            });
            
            // เพิ่มปุ่ม Cancel
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'btn btn-sm btn-secondary ml-2';
            cancelBtn.onclick = function() {
                handleCancelAllEdit(this);
            };
            button.parentNode.insertBefore(cancelBtn, button.nextSibling);
        } else {
            // บันทึกการเปลี่ยนแปลง
            saveAllChanges(button);
        }
    };

    function handleCancelAllEdit(button) {
        const table = button.closest('table');
        const editBtn = button.previousElementSibling;
        
        // กลับไปใช้ค่าเดิม
        const inputs = table.querySelectorAll('.mt-input');
        const values = table.querySelectorAll('.mt-value');
        
        inputs.forEach(input => {
            input.style.display = 'none';
            input.value = input.dataset.original;
        });
        
        values.forEach(value => {
            value.style.display = 'inline-block';
        });
        
        // รีเซ็ตปุ่ม
        editBtn.textContent = 'Edit Morning Talk';
        editBtn.classList.replace('btn-success', 'btn-primary');
        button.remove();
    }    

    async function saveAllChanges(button) {
        const table = button.closest('table');
        const inputs = table.querySelectorAll('.mt-input');
        const changes = [];
        
        // รวบรวมข้อมูลที่เปลี่ยนแปลง
        inputs.forEach(input => {
            if (input.value !== input.dataset.original) {
                changes.push({
                    date: input.dataset.date,
                    machineCode: input.dataset.machine,
                    downtime: parseFloat(input.value) || 0
                });
            }
        });
        
        try {
            if (changes.length > 0) {
                // บันทึกการเปลี่ยนแปลงทั้งหมด
                const results = await Promise.all(changes.map(change => 
                    fetch('/api/oee/morningTalk', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(change)
                    })
                ));
                
                // ตรวจสอบผลลัพธ์
                if (results.every(r => r.ok)) {
                    alert('บันทึกข้อมูลสำเร็จ');
                    
                    // อัพเดทการแสดงผล
                    inputs.forEach(input => {
                        const valueSpan = input.previousElementSibling;
                        valueSpan.textContent = input.value;
                        input.style.display = 'none';
                        valueSpan.style.display = 'inline-block';
                    });
                    
                    // รีเซ็ตปุ่ม
                    button.textContent = 'Edit Morning Talk';
                    button.classList.remove('editing');
                    button.classList.replace('btn-success', 'btn-primary');
                    button.nextElementSibling?.remove(); // ลบปุ่ม Cancel
                    
                    // รีโหลดข้อมูล
                    await updateOEEData();
                }
            } else {
                button.textContent = 'Edit Morning Talk';
                button.classList.remove('editing');
                button.classList.replace('btn-success', 'btn-primary');
                button.nextElementSibling?.remove(); // ลบปุ่ม Cancel
                
                // ซ่อน inputs และแสดงค่า
                const inputs = table.querySelectorAll('.mt-input');
                const values = table.querySelectorAll('.mt-value');
                
                inputs.forEach(input => {
                    input.style.display = 'none';
                });
                
                values.forEach(value => {
                    value.style.display = 'inline-block';
                });
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    }
    
    
    // รวบรวม unique causes
    const allCauses = new Set();
    metrics.forEach(metric => {
        if (metric.details?.losstime) {
            metric.details.losstime.forEach(loss => {
                if (loss.causeCode !== 'G01') {
                    allCauses.add(loss.causeCode);
                }
            });
        }
    });
    
    console.log("All causes found:", Array.from(allCauses));

    const lossRows = Array.from(allCauses)
    .filter(causeCode => causeCode !== 'G01')  // ไม่รวม Morning Talk
    .map((causeCode, index) => {
        const firstLoss = metrics.find(m => 
            m.details?.losstime?.find(l => l.causeCode === causeCode)
        )?.details.losstime.find(l => l.causeCode === causeCode);

        // แสดงผลตามที่มาจากฐานข้อมูลโดยตรง
        const displayText = causeCode === null || causeCode === undefined
            ? `${index + 2}.${firstLoss?.description || firstLoss?.cause || ''}`  // กรณี NULL
            : `${index + 2}.${firstLoss?.description || ''} (${causeCode})`; // กรณีมี CauseCode

        return `
            <tr class="av-row">
                <td>AV</td>
                <td colspan="2">${displayText}</td>
                ${allDates.map(date => {
                    const metric = mapMetricToDate(sortedMetrics, date);
                    const loss = metric.details?.losstime?.find(l => l.causeCode === causeCode);
                    return `<td>${loss ? formatNumber(loss.downtime || 0, 1) : '0'}</td>`;
                }).join('')}
            </tr>`;
    }).join('');

    // Total row
    // const totalRow = `
    //     <tr class="av-row total-losstime">
    //         <td>AV</td>
    //         <td colspan="2">รวม Losstime</td>
    //         ${allDates.map(date => {
    //             const metric = mapMetricToDate(sortedMetrics, date);
    //             const total = metric.details?.losstime?.reduce((sum, loss) => 
    //                 sum + (loss.downtime || 0), 0) || 0;
    //             return `<td>${total > 0 ? formatNumber(total, 1) : '-'}</td>`;
    //         }).join('')}
    //     </tr>`;

    // Total row ใน lossRows
const totalRow = `
<tr class="av-row total-losstime">
    <td>AV</td>
    <td colspan="2">รวม Losstime</td>
    ${allDates.map(date => {
        const metric = mapMetricToDate(sortedMetrics, date);
        // กรอง G01 ออกจากการแสดงผลด้วย
        const total = metric.details?.losstime
            ?.reduce((sum, loss) => {
                if (loss.causeCode === 'G01') return sum;  // ข้าม G01
                return sum + (loss.downtime || 0);
            }, 0) || 0;
        return `<td>${total > 0 ? formatNumber(total, 1) : '-'}</td>`;
    }).join('')}
</tr>`;

    return `${morningTalkRow}${lossRows}${totalRow}`;
})()}

        <!-- PE Section -->
        <tr class="pe-row">
            <td rowspan="2">PE</td>
            <td colspan="2">Actual</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.details.actualQty || 0, 1)}</td>`;
            }).join('')}
        </tr>
        <tr class="pe-row">
            <td colspan="2">Plan</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.details.plannedQty || 0, 1)}</td>`;
            }).join('')}
        </tr>

        <!-- Quality Section -->
        <tr class="q-row">
            <td rowspan="1">Q</td>
            <td colspan="2">NG</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.details.NgQuantity || 0, 1)}</td>`;
            }).join('')}
        </tr>

        <!-- OEE Section -->
        <tr class="oee-row">
            <td rowspan="4">OEE</td>
            <td colspan="2">AV%</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.metrics.availability || 0, 1)}</td>`;
            }).join('')}
        </tr>
        <tr class="oee-row">
            <td colspan="2">PE%</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.metrics.performance || 0, 1)}</td>`;
            }).join('')}
        </tr>
        <tr class="oee-row">
            <td colspan="2">Q%</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.metrics.quality || 0, 1)}</td>`;
            }).join('')}
        </tr>
        <tr class="oee-row">
            <td colspan="2">OEE</td>
            ${allDates.map(date => {
                const metric = mapMetricToDate(sortedMetrics, date);
                return `<td>${formatNumber(metric.metrics.oee || 0, 1)}%</td>`;
            }).join('')}
        </tr>
    `;

    tbody.innerHTML = tableRows;
}


// Helper function สำหรับ map ข้อมูลตามวันที่
function mapMetricForExcel(metrics, date) {
    return metrics.find(m => 
        new Date(m.date).toDateString() === date.toDateString()
    ) || {
        metrics: {},
        details: {}
    };
}

async function exportToExcel() {
    try {
        const tableData = await getMetricsData();
        if (!tableData) {
            throw new Error('No data available for export');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('OEE Analysis');

        // กำหนดความกว้างคอลัมน์
        worksheet.columns = [
            { width: 10 }, // Column A
            { width: 30 }, // Column B
            { width: 15 }, // Column C
            ...Array(31).fill({ width: 12 }) // วันที่ 1-31
        ];

        const startDate = new Date(elements.startDate.value);
        const endDate = new Date(elements.endDate.value);
        const allDates = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            allDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // ทศนิยม
        const numberStyle = {
            numFmt: '0.0',
            alignment: {
                vertical: 'middle',
                horizontal: 'right'
            }
        };

        // จำนวนเต็ม
        const integerStyle = {
            numFmt: '0',
            alignment: {
                vertical: 'middle',
                horizontal: 'right'
            }
        };

        // สร้างสไตล์สำหรับหัวตาราง
        const headerStyle = {
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            },
            font: {
                bold: true
            },
            alignment: {
                vertical: 'middle',
                horizontal: 'center'
            },
            border: {
                top: { style: 'medium' },
                left: { style: 'medium' },
                bottom: { style: 'medium' },
                right: { style: 'medium' }
            }
        };

        // สไตล์สำหรับแต่ละส่วน
        const styles = {
            working: {
                font: { bold: true, color: { argb: 'FFFFFFFF' } },
                border: { 
                    top: { style: 'medium' }, 
                    left: { style: 'medium' }, 
                    bottom: { style: 'medium' },
                    right: { style: 'medium' }
                },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17A2B8' } }
            },
            av: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } },
                border: { 
                    top: { style: 'thin' }, 
                    left: { style: 'thin' }, 
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            },
            pe: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } },
                border: { 
                    top: { style: 'thin' }, 
                    left: { style: 'thin' }, 
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            },
            quality: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8FF' } },
                border: { 
                    top: { style: 'thin' }, 
                    left: { style: 'thin' }, 
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            },
            oee: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9D9' } },
                border: { 
                    top: { style: 'thin' }, 
                    left: { style: 'thin' }, 
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            }
        };

        // หัวตาราง วันที่
        const titleRow = worksheet.addRow(['OEE', 'วันที่', '', ...allDates.map(date => date.getDate())]);
        titleRow.eachCell(cell => {
            cell.style = headerStyle;
        });

        // Working Hours
        const addWorkingHoursSection = () => {
            const workingHoursRow = worksheet.addRow(['Working', 'เวลาทำงาน (ชั่วโมง)', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                return Number(metric.details?.WorkingHours || 0);
            })]);
            workingHoursRow.eachCell(cell => {
                cell.style = { ...styles.working,
                    alignment: {
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                };
            });
        };

        // Working Section
        const addWorkingSection = () => {
            const workingMinutesRow = worksheet.addRow(['Working', 'เวลาทำงาน (นาที)', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                return Number(metric.details?.WorkingMinutes || 0);
            })]);

            // แผน Down time
            const plannedDowntimeRow = worksheet.addRow(['Working', 'แผน Down time', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                const workingMinutes = Number(metric.details?.WorkingMinutes || 0);
                let plannedDowntime = 0;
                if (workingMinutes > 0) {
                    if (workingMinutes >= 1440) {
                        plannedDowntime = 220;
                    } else if (workingMinutes >= 960) {
                        plannedDowntime = 160;
                    } else if (workingMinutes >= 480) {
                        plannedDowntime = 80;
                    }
                }
                return plannedDowntime;
            })]);

            // เวลาที่ใช้ (นาที)
            const actualTimeRow = worksheet.addRow(['Working', 'เวลาที่ใช้ (นาที)', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                const workingMinutes = Number(metric.details?.WorkingMinutes || 0);

                let plannedDowntime = 0
                if (workingMinutes > 0) {
                    if (workingMinutes >= 1440) {
                        plannedDowntime = 220;
                    } else if (workingMinutes >= 960) {
                        plannedDowntime = 160;
                    } else if (workingMinutes >= 480) {
                        plannedDowntime = 80;
                    }
                }
                return Number(workingMinutes > 0 ? workingMinutes - plannedDowntime : 0, 0);
            })]);

            [workingMinutesRow, plannedDowntimeRow, actualTimeRow].forEach(row => {
                row.eachCell(cell => {
                    cell.style = { ...styles.working };
                });
            });
        };

        // AV Section
        const addAVSection = () => {
            // Morning Talk
            const mtRow = worksheet.addRow(['AV', '1.Morning Talk', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                const morningTalk = metric.details?.losstime?.find(l => l.causeCode === 'G01');
                return Number(morningTalk ? morningTalk.downtime : 0);
            })]);

            // ดึงข้อมูลทุกสาเหตุที่มีในข้อมูล
            const allCauses = new Set();
            tableData.dailyMetrics.forEach(metric => {
                metric.details.losstime?.forEach(loss => {
                    if (loss.causeCode !== 'G01') {
                        allCauses.add(JSON.stringify({
                            causeCode: loss.causeCode,
                            description: loss.description
                        }));
                    }
                });
            });

            // เรียงลำดับและแสดงทุกสาเหตุ
            const sortedCauses = Array.from(allCauses)
                .map(cause => JSON.parse(cause))
                .sort((a, b) => (a.causeCode || '').localeCompare(b.causeCode || ''));

            // สร้างแถวสำหรับแต่ละสาเหตุ
            const causeRows = sortedCauses.map((cause, index) => {
                return worksheet.addRow(['AV', `${index + 2}.${cause.description} (${cause.causeCode})`, '',
                    ...allDates.map(date => {
                        const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                        const loss = metric.details?.losstime?.find(l => l.causeCode === cause.causeCode);
                        return Number(loss?.downtime || 0); // แปลงเป็น Number
                    })
                ]);
            });

            // แถว Losstime
            // const totalLosstimeRow = worksheet.addRow(['AV', 'รวม Losstime', '', ...allDates.map(date => {
            //     const metric = mapMetricForExcel(tableData.dailyMetrics, date);
            //     const total = metric.details?.losstime?.reduce((sum, loss) => 
            //         sum + Number(loss.downtime || 0), 0) || 0;
            //     return total; // ส่งค่าเป็น Number
            // })]);
            const totalLosstimeRow = worksheet.addRow(['AV', 'รวม Losstime', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                // กรอง G01 ออกจากการคำนวณ total
                const total = metric.details?.losstime
                    ?.reduce((sum, loss) => {
                        if (loss.CauseCode === 'G01') return sum;  // ไม่รวม G01
                        return sum + (loss.Downtime || 0);
                    }, 0) || 0;
                return total;  // ส่งค่าที่ไม่รวม G01
            })]);

            // จัดสไตล์สำหรับทุกแถว
            [mtRow, ...causeRows, totalLosstimeRow].forEach(row => {
                row.eachCell(cell => {
                    cell.style = {
                        ...styles.av,
                        alignment: {
                            vertical: 'middle',
                            horizontal: 'center'
                        }
                    };
                });
            });

            // สไตล์สำหรับแถวรวม
            totalLosstimeRow.eachCell(cell => {
                cell.style = {
                    ...styles.av,
                    font: { bold: true }
                };
            });
        };

        // PE Section
        const addPESection = () => {
            ['Actual', 'Plan'].forEach((type, index) => {
                const peRow = worksheet.addRow(['PE', type, '', ...allDates.map(date => {
                    const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                    return type === 'Actual' ? 
                        Number(metric.details?.actualQty || 0, 1) :
                        Number(metric.details?.plannedQty || 0, 1);
                })]);
                peRow.eachCell(cell => {
                    cell.style = { ...styles.pe };
                });
            });
        };

        // Quality Section
        const addQualitySection = () => {
            const qRow = worksheet.addRow(['Q', 'NG', '', ...allDates.map(date => {
                const metric = mapMetricForExcel(tableData.dailyMetrics, date);
                return Number(metric.details?.NgQuantity || 0, 1);
            })]);
            qRow.eachCell(cell => {
                cell.style = { ...styles.quality };
            });
        };

        // OEE Section
        const addOEESection = () => {
            ['AV%', 'PE%', 'Q%', 'OEE'].forEach(metric => {
                const oeeRow = worksheet.addRow(['OEE', metric, '', ...allDates.map(date => {
                    const dayMetric = mapMetricForExcel(tableData.dailyMetrics, date);
                    let value = 0;
                    switch(metric) {
                        case 'AV%': value = Number(dayMetric.metrics?.availability || 0); break;
                        case 'PE%': value = Number(dayMetric.metrics?.performance || 0); break;
                        case 'Q%': value = Number(dayMetric.metrics?.quality || 0); break;
                        case 'OEE': value = Number(dayMetric.metrics?.oee || 0); break;
                    }
                    return value; // ส่งค่าเป็น Number
                })]);
        
                oeeRow.eachCell((cell, colNumber) => {
                    if (colNumber > 3) {
                        cell.style = {
                            ...styles.oee,
                            ...numberStyle
                        };
                        cell.numFmt = '0.0"%"'; // กำหนดให้แสดงเครื่องหมาย % ด้วย
                    } else {
                        cell.style = styles.oee;
                    }
                });
            });
        };

        // Add all sections
        addWorkingHoursSection();
        addWorkingSection();
        addAVSection();
        addPESection();
        addQualitySection();
        addOEESection();

        // สร้างและดาวน์โหลดไฟล์
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `oee_analysis_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`;
        link.click();

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Failed to export data to Excel');
    }
}

    function setupExportButton() {
        const exportButton = document.getElementById('exportButton');
        exportButton.addEventListener('click', async function() {
            const metrics = await getMetricsData();
            exportToExcel(metrics);
        });
    }

    async function getMetricsData() {
        try {
            const machineCode = elements.machineSelect.value;
            const startDate = elements.startDate.value;
            const endDate = elements.endDate.value;
    
            const response = await fetch(`/api/oee/summary?machineCode=${machineCode}&startDate=${startDate}&endDate=${endDate}`);
    
            if (!response.ok) {
                throw new Error('Failed to fetch metrics data');
            }
    
            const result = await response.json();
            console.log(result.data); 
            return result.data;
        } catch (error) {
            console.error('Error fetching metrics data:', error);
            return null;
        }
    }

    function formatNumber(value, decimals = 1) {
        const num = Number(value);
        if (isNaN(num)) return '0';
        return num.toFixed(decimals);
    }

    // Start the application
    initializeApp();
});