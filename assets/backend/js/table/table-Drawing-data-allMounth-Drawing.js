let selectedMonth = new Date().getMonth() + 1; 
let selectedYear = new Date().getFullYear();

async function fetchDataAndPopulateTable() {
    try {
        const url = new URL('/api/productionData', window.location.origin);
        url.searchParams.append('month', selectedMonth);
        url.searchParams.append('year', selectedYear);

        console.log('Fetching data from:', url.toString());

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw data:', data);

        // Group data by MachineCode and Date, excluding DRA022
        const groupedData = data.reduce((acc, item) => {
            if (item.MachineCode !== 'DRA022') {
                if (!acc[item.MachineCode]) {
                    acc[item.MachineCode] = {};
                }
                const productionDate = new Date(item.ProductionDate);
                if (productionDate.getMonth() + 1 === selectedMonth && productionDate.getFullYear() === selectedYear) {
                    const day = productionDate.getDate();
                    if (!acc[item.MachineCode][day]) {
                        acc[item.MachineCode][day] = { plan: 0, actual: 0, ng: 0 };
                    }
                    acc[item.MachineCode][day].plan += item.ProductionQuantity || 0;
                    acc[item.MachineCode][day].actual += item.Actual || 0;
                    acc[item.MachineCode][day].ng += item.NgWeight || 0;
                }
            }
            return acc;
        }, {});

        createTable(groupedData);
    } catch (error) {
        console.error('Error in fetchDataAndPopulateTable:', error);
    }
}

function createTable(data) {
    console.log('Grouped data before creating table:', data);

    const table = document.getElementById('productionTable');
    table.innerHTML = ''; // Clear existing table

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

    const tbody = document.createElement('tbody');
    
    // Filter and sort machines according to the drawing department's criteria
    const filteredAndSortedMachines = Object.keys(data)
        .filter(machine => machine.startsWith('D') && !machine.startsWith('DW') && machine !== 'DRA022')
        .sort((a, b) => {
            const numA = parseInt(a.replace('D', ''));
            const numB = parseInt(b.replace('D', ''));
            return numA - numB;
        });

    let grandTotalPlan = 0, grandTotalActual = 0, grandTotalNG = 0;


    for (const machine of filteredAndSortedMachines) {
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

        const totalPOP = totalPlan ? ((totalActual / totalPlan) * 100).toFixed(2) : 'N/A';
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

    // Create the Total row
    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `<td><strong>Total</strong></td>`;
    for (let i = 1; i <= daysInMonth; i++) {
        totalRow.innerHTML += `<td></td><td></td><td></td>`;
    }
    const grandTotalPOP = grandTotalPlan ? ((grandTotalActual / grandTotalPlan) * 100).toFixed(2) : 'N/A';
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

document.addEventListener('DOMContentLoaded', function() {
    const currentDate = new Date();
    document.getElementById('monthYearPicker').value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    fetchDataAndPopulateTable();
});
