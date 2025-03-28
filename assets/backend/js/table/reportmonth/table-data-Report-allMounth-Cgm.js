let selectedMonth = new Date().getMonth() + 1; 
let selectedYear = new Date().getFullYear();
const MACHINE_PREFIX_CGM = 'CGM';
// const MACHINE_PREFIX_D22 = 'D22';
// const MACHINE_PREFIX_CO2 = 'CO2';
// const MACHINE_PREFIX_PAP = 'PAP';

async function fetchDataAndPopulateTable() {
    try {
        const urls = [
            createUrlForMachinePrefix(MACHINE_PREFIX_CGM)
            // createUrlForMachinePrefix(MACHINE_PREFIX_D22),
            // createUrlForMachinePrefix(MACHINE_PREFIX_CO2),
            // createUrlForMachinePrefix(MACHINE_PREFIX_PAP)
        ];

        console.log('Fetching data from:', urls.map(url => url.toString()));
        
        const responses = await Promise.all(urls.map(url => fetch(url)));

        if (responses.some(response => !response.ok)) {
            throw new Error(`HTTP error! status: ${responses.map(r => r.status).join(', ')}`);
        }

        const dataArrays = await Promise.all(responses.map(response => response.json()));

        console.log('Raw data:', dataArrays);

        // cgm machine and filter data
        const cgmMachine = dataArrays.flat().filter(item => 
            (item.MachineCode.startsWith('CGM') && parseInt(item.MachineCode.slice(3)) <= 18)
        );

        console.log('Combined and filtered data:', cgmMachine);

        // จัดกลุ่มข้อมูลตาม MachineCode และวันที่
        const groupedData = combinedData.reduce((acc, item) => {
            if (!acc[item.MachineCode]) {
                acc[item.MachineCode] = {};
            }
            const productionDate = new Date(item.ProductionDate);
            // ตรวจสอบว่าวันที่อยู่ในเดือนที่เลือกจริงๆ
            if (productionDate.getMonth() + 1 === selectedMonth && productionDate.getFullYear() === selectedYear) {
                const day = productionDate.getDate();
                if (!acc[item.MachineCode][day]) {
                    acc[item.MachineCode][day] = { plan: 0, actual: 0, ng: 0 };
                }
                acc[item.MachineCode][day].plan += item.ProductionQuantity || 0;
                acc[item.MachineCode][day].actual += item.Actual || 0;  // เปลี่ยนจาก WIPWeight เป็น Actual
                acc[item.MachineCode][day].ng += item.NgWeight || 0;
            }
            return acc;
        }, {});

        createTable(groupedData);
    } catch (error) {
        console.error('Error in fetchDataAndPopulateTable:', error);
    }
}

function createUrlForMachinePrefix(prefix) {
    const url = new URL('/api/productionData', window.location.origin);
    url.searchParams.append('month', selectedMonth);
    url.searchParams.append('year', selectedYear);
    url.searchParams.append('machineCodePrefix', prefix);
    
    // เพิ่มพารามิเตอร์เพื่อกรองเฉพาะ MachineCode ที่ต้องการ
    if (prefix === MACHINE_PREFIX_CGM) {
        url.searchParams.append('maxMachineNumber', '18');
    }
    return url;
}

function createTable(data) {
    console.log('Grouped data before creating table:', data);

    const table = document.getElementById('productionTable');
    table.innerHTML = ''; // Clear existing table

    // Create table header
    const thead = document.createElement('thead');

    let headerRow = '<tr><th rowspan="2">Machine</th>';
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        headerRow += `<th colspan="3">${i}</th>`;
    }
    headerRow += '<th colspan="4">Total</th></tr>';
    headerRow += '<tr>';
    for (let i = 1; i <= daysInMonth; i++) {
        headerRow += '<th>Plan</th><th>Actual</th><th>%POP</th>';
    }
    headerRow += '<th>Plan</th><th>Actual</th><th>NG</th><th>%POP</th></tr>';
    thead.innerHTML = headerRow;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    
    // Sort MachineCode
    const sortedMachines = Object.keys(data).sort((a, b) => {
        const prefixOrder = {'CGM': 1};
        const getPrefix = (code) => {
            if (code.startsWith('CGM')) return 'CGM';
            // if (code.startsWith('CO2')) return 'CO2';
            // if (code.startsWith('PAP')) return 'PAP';
            return code;
        };
        const prefixA = getPrefix(a);
        const prefixB = getPrefix(b);
        
        if (prefixOrder[prefixA] !== prefixOrder[prefixB]) {
            return prefixOrder[prefixA] - prefixOrder[prefixB];
        }
        return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
    });

    let grandTotalPlan = 0, grandTotalActual = 0, grandTotalNG = 0;

    for (const machine of sortedMachines) {
        const days = data[machine];
        const row = document.createElement('tr');
        let cellsHTML = `<td class="machine-column">${machine}</td>`;
        let totalPlan = 0, totalActual = 0, totalNG = 0;

        for (let i = 1; i <= daysInMonth; i++) {
            const day = days[i] || { plan: 0, actual: 0, ng: 0 };
            totalPlan += day.plan;
            totalActual += day.actual;
            totalNG += day.ng;
            const pop = day.plan ? ((day.actual / day.plan) * 100).toFixed(1) : '-';
            cellsHTML += `<td>${day.plan.toFixed(1)}</td>`;
            cellsHTML += `<td>${day.actual.toFixed(1)}</td>`;
            cellsHTML += `<td>${pop}${pop !== '-' ? '%' : ''}</td>`;
        }

        const totalPOP = totalPlan ? ((totalActual / totalPlan) * 100).toFixed(1) : 'N/A';
        cellsHTML += `<td>${totalPlan.toFixed(1)}</td>`;
        cellsHTML += `<td>${totalActual.toFixed(1)}</td>`;
        cellsHTML += `<td>${totalNG.toFixed(1)}</td>`;
        cellsHTML += `<td>${totalPOP}${totalPOP !== 'N/A' ? '%' : ''}</td>`;

        row.innerHTML = cellsHTML;
        tbody.appendChild(row);

        grandTotalPlan += totalPlan;
        grandTotalActual += totalActual;
        grandTotalNG += totalNG;
    }

    // สร้างแถว Total
    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `<td><strong>Total</strong></td>`;
    for (let i = 1; i <= daysInMonth; i++) {
        totalRow.innerHTML += `<td></td><td></td><td></td>`;
    }
    const grandTotalPOP = grandTotalPlan ? ((grandTotalActual / grandTotalPlan) * 100).toFixed(1) : 'N/A';
    totalRow.innerHTML += `<td><strong>${grandTotalPlan.toFixed(1)}</strong></td>`;
    totalRow.innerHTML += `<td><strong>${grandTotalActual.toFixed(1)}</strong></td>`;
    totalRow.innerHTML += `<td><strong>${grandTotalNG.toFixed(1)}</strong></td>`;
    totalRow.innerHTML += `<td><strong>${grandTotalPOP}${grandTotalPOP !== 'N/A' ? '%' : ''}</strong></td>`;
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
}

document.getElementById('tableFilterButton').addEventListener('click', function() {
    const selectedDate = new Date(document.getElementById('monthYearPicker').value);
    selectedMonth = selectedDate.getMonth() + 1; 
    selectedYear = selectedDate.getFullYear();
    fetchDataAndPopulateTable();
});

// เรียกใช้ฟังก์ชันดึงข้อมูลเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', function() {
    // ตั้งค่าเริ่มต้นสำหรับ monthYearPicker
    const currentDate = new Date();
    const monthYearPicker = document.getElementById('monthYearPicker');
    if (monthYearPicker) {
        monthYearPicker.value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    }

    fetchDataAndPopulateTable();

    const exportButton = document.getElementById('exportProductionDataButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportProductionDataToExcel);
    } else {
        console.warn("Element with ID 'exportProductionDataButton' not found");
    }
});

async function exportProductionDataToExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Production Data');

    const table = document.getElementById('productionTable');
    const rows = table.querySelectorAll('tr');

    // Add headers
    const headerRow1 = worksheet.addRow([]);
    const headerRow2 = worksheet.addRow([]);
    const headerCells1 = rows[0].querySelectorAll('th');
    const headerCells2 = rows[1].querySelectorAll('th');

    let currentCol = 1;
    headerCells1.forEach((cell, index) => {
        if (index === 0) {
            headerRow1.getCell(currentCol).value = cell.innerText;
            headerRow2.getCell(currentCol).value = '';
            worksheet.mergeCells(1, currentCol, 2, currentCol);
            currentCol++;
        } else {
            const colspan = parseInt(cell.getAttribute('colspan')) || 1;
            if (colspan > 1) {
                headerRow1.getCell(currentCol).value = cell.innerText;
                worksheet.mergeCells(1, currentCol, 1, currentCol + colspan - 1);
                currentCol += colspan;
            } else {
                headerRow1.getCell(currentCol).value = cell.innerText;
                currentCol++;
            }
        }
    });

    currentCol = 2; // Reset for second header row, starting from second column
    headerCells2.forEach((cell, index) => {
        if (index > 0) {
            headerRow2.getCell(currentCol).value = cell.innerText;
            currentCol++;
        }
    });

    // Style headers
    [headerRow1, headerRow2].forEach(row => {
        row.eachCell(cell => {
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    });

    // Add data
    for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => cell.innerText);
        worksheet.addRow(rowData);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        column.width = 15;
    });

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Production_Data_${selectedMonth}_${selectedYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}