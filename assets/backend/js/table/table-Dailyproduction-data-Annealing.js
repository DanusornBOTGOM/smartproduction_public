let selectedDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
let allData = [];
const SECTION = '';
let isInitialLoad = true;
let rawData = [];

function formatDate(date) {
    const d = new Date(date);
    const bangkokTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const year = bangkokTime.getFullYear();
    const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');
    const day = String(bangkokTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function clearTable() {
    const tableBody = document.querySelector('#barChartTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
    } else {
        console.error('Table body not found');
    }
}

function formatDateThai(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok'
    }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$2/$1');
}

async function fetchData() {
    try {
        const url = new URL('http://192.168.1.214:5000/api/combinedDashboard');
        url.searchParams.append('date', formatDate(selectedDate));
        url.searchParams.append('machineCodePrefix', 'ANN00');

        console.log('Fetching data with URL:', url.toString());
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Raw data from API:', data);

        // กรองข้อมูลเฉพาะ ANN00%
        const filteredData = data.filter(item => item.MachineCode.startsWith('ANN00'));

        // ดึงข้อมูล Cause
        const causeData = await fetchCauseData(selectedDate);
        console.log('Cause data:', causeData);

        if (Array.isArray(filteredData)) {
            allData = filteredData.map(item => {
                const causes = causeData.find(c => c.MachineCode === item.MachineCode && c.DocNo === item.DocNo);
                return { 
                    ...item, 
                    Causes: causes ? causes.Causes : [],
                    TotalDowntime: causes ? causes.TotalDowntime : 0,
                    OrderWeight: item.OrderWeight || 'ไม่มีข้อมูล',
                    ItemLen: item.ItemLen || 'ไม่มีข้อมูล',
                    SizeIn: item.SizeIn || 'ไม่มีข้อมูล',
                    SizeOut: item.SizeOut || 'ไม่มีข้อมูล',
                    PartName: item.PartName || 'ไม่มีข้อมูล'
                };
            });
            console.log('Mapped allData:', allData); 
        
            if (allData.length === 0) {
                console.log('No data received for the selected date');
                clearTable();
                document.querySelector('#barChartTable tbody').innerHTML = '<tr><td colspan="8">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
            } else {
                const groupedData = groupDataByMachineAndDoc(allData);
                populateBarChartTable(groupedData, selectedDate);
                adjustHeaderWidth();
            }

            if (isInitialLoad && allData.length > 0) {
                const latestDate = new Date(allData[0].PrintTime);
                const bangkokTime = new Date(latestDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
                const dateElement = document.getElementById('selectedDate');

                if (dateElement) {
                    dateElement.value = bangkokTime.toISOString().split('T')[0];
                    selectedDate = dateElement.value;
                } else {
                    console.error('selectedDate element not found');
                }
                isInitialLoad = false;
            }
        } else if (data.error) {
            console.error('Error from server:', data.error);
            clearTable();
            document.querySelector('#barChartTable tbody').innerHTML = `<tr><td colspan="8">เกิดข้อผิดพลาดในการดึงข้อมูล: ${data.error}</td></tr>`;
        } else {
            console.error('Received data is not an array:', data);
            clearTable();
            document.querySelector('#barChartTable tbody').innerHTML = '<tr><td colspan="8">เกิดข้อผิดพลาดในการดึงข้อมูล: รูปแบบข้อมูลไม่ถูกต้อง</td></tr>';
        }
    } catch (error) {
        console.error('Error in fetchData:', error);
        document.querySelector('#barChartTable tbody').innerHTML = `<tr><td colspan="10">เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}</td></tr>`;
    }
}

async function initPage() {
    await fetchData();
    // โค้ดอื่นๆ ที่ต้องการให้ทำงานเมื่อหน้าเว็บโหลด
}

// เรียกใช้ initPage เมื่อหน้าเว็บโหลด
window.addEventListener('load', initPage);

function parseCauseString(causeString) {
    if (!causeString) return [];
    return causeString.split('; ').map(problem => {
        const match = problem.match(/(.*) \((\d+) นาที\)/);
        if (match) {
            return {
                description: match[1].trim(),
                downtime: parseInt(match[2])
            };
        }
        return { description: problem, downtime: 0 };
    });
}

function groupDataByMachineAndDoc(data) {
    const groupedData = {};
    data.forEach(item => {
        if (item.ItemType !== 'NG' && item.MachineCode.startsWith('ANN00')) {
            const key = `${item.MachineCode}-${item.DocNo}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    MachineCode: item.MachineCode,
                    DocNo: item.DocNo,
                    PlanDocNo: item.PlanDocNo,
                    Actual: 0,
                    Plan: parseFloat(item.Plan) || 0,
                    PrintTime: formatDateThai(new Date(item.PrintTime)),
                    CustName: item.CustName,  
                    Remark: item.Remark,
                    Cause: item.Cause || '',
                    Downtime: item.Downtime || 0,
                    OrderWeight: item.OrderWeight || 'ไม่มีข้อมูล',
                    ItemLen: item.ItemLen || 'ไม่มีข้อมูล',
                    SizeIn: item.SizeIn || 'ไม่มีข้อมูล',
                    SizeOut: item.SizeOut || 'ไม่มีข้อมูล',
                    PartName: item.PartName || 'ไม่มีข้อมูล',
                };
            }
            groupedData[key].Actual += parseFloat(item.Actual) || 0;
        }
    });
    console.log('Grouped data:', groupedData);
    return Object.values(groupedData);
}

function populateBarChartTable(groupedData, selectedDate) {
    console.log('Populating table with grouped data:', groupedData);
    const tableBody = document.querySelector('#barChartTable tbody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }
    tableBody.innerHTML = '';
    if (groupedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
        return;
    }

    let isAlternateColor = false;

    groupedData.forEach((item, index) => {
        console.log('Item data for row:', item);
        if (index !== 0 && item.MachineCode.slice(0, 6) !== groupedData[index - 1].MachineCode.slice(0, 6)) {
            tableBody.innerHTML += `<tr class="machine-separator"><td colspan="10"></td></tr>`;
            isAlternateColor = !isAlternateColor;
        }

        const planValue = item.Plan > 0 ? item.Plan.toFixed(1) : '-';
        const actualValue = parseFloat(item.Actual).toFixed(1);

        const causeData = allData.find(d => 
            d.MachineCode === item.MachineCode && 
            d.DocNo === item.DocNo
        );
        let causeHTML = '';
        let totalDowntime = 0;

        if (causeData && Array.isArray(causeData.Causes)) {
            causeHTML = causeData.Causes.map(cause => 
                `<div>${cause.description} (${cause.downtime} นาที)</div>`
            ).join('');
            totalDowntime = causeData.TotalDowntime || 0;
        }
        
        // เพิ่มคลาส 'ann-machine' สำหรับเครื่องจักร ANN
        const isANNMachine = item.MachineCode.startsWith('ANN00');
        const machineCodeClass = isANNMachine ? 'ann-machine' : '';

        const row = `
        <tr class="${isAlternateColor ? 'alternate-row' : ''} ${machineCodeClass}" data-docno="${item.DocNo || ''}" data-machine="${item.MachineCode || ''}">
            <td class="machine-code">${item.MachineCode || ''}</td>
            <td>${actualValue}</td>
            <td>${planValue}</td>
            <td>${item.DocNo || ''}</td>
            <td title="${item.CustName || ''}">${item.CustName || ''}</td>
            <td>${item.Remark || ''}</td>
            <td class="problem-column">
                <div class="problem-details">${causeHTML}</div>
            </td>
            <td>${totalDowntime}</td>
            <td>${item.OrderWeight || 'ไม่มีข้อมูล'}</td>
            <td>${item.ItemLen || 'ไม่มีข้อมูล'}</td>
            <td>${item.SizeIn || 'ไม่มีข้อมูล'}</td>
            <td>${item.SizeOut || 'ไม่มีข้อมูล'}</td>
            <td>${item.PartName || 'ไม่มีข้อมูล'}</td>
            <td>
                <button onclick="editProblem('${item.MachineCode}', '${item.DocNo}')" class="btn btn-success">บันทึก/แก้ไข</button>
            </td>
            <td>
                <button class="btn btn-primary btn-sm view-details" data-machine="${item.MachineCode}" data-date="${selectedDate}">
                    ดูรายละเอียด
                </button>
            </td>
        </tr>
        `;
        tableBody.innerHTML += row;
    });

    adjustHeaderWidth();
    adjustProblemDetails();
}

function adjustProblemDetails() {
    const problemDetails = document.querySelectorAll('.problem-details');
    problemDetails.forEach(cell => {
        cell.title = cell.textContent.trim();
    });
}


// เพิ่มฟังก์ชันอื่นๆ ที่เหมือนกับของ BAR2 ตามที่แสดงในโค้ดก่อนหน้านี้
// เช่น editProblem, showEditModal, closeEditModal, saveProblem, showMachineDetails, saveAllCauses, etc.
function editProblem(machineCode, docNo) {
    const row = document.querySelector(`#barChartTable tr[data-docno="${docNo}"]`);
    if (row) {
        const problemDetailsCell = row.querySelector('.problem-details');
        const currentProblems = Array.from(problemDetailsCell.querySelectorAll('div')).map(div => div.textContent);

        let formHTML = '<form id="editProblemForm">';
        currentProblems.forEach((problem, index) => {
            const match = problem.match(/(.*) \((\d+) นาที\)/);
            const description = match ? match[1].trim() : problem;
            const downtime = match ? parseInt(match[2]) : 0;
            formHTML += `
                <div>
                    <input type="text" name="description[]" value="${description}">
                    <input type="number" name="downtime[]" value="${downtime}" min="0"> นาที
                    <button type="button" onclick="removeProblem(this)">ลบ</button>
                </div>
            `;
        });
        formHTML += '<button type="button" onclick="addNewProblemField()">เพิ่มปัญหา</button>';
        formHTML += '<button type="submit">บันทึก</button></form>';

        showEditModal(formHTML);

        document.getElementById('editProblemForm').onsubmit = function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const problems = [];
            const descriptions = formData.getAll('description[]');
            const downtimes = formData.getAll('downtime[]');
            for (let i = 0; i < descriptions.length; i++) {
                if (descriptions[i] && downtimes[i]) {
                    problems.push({
                        description: descriptions[i],
                        downtime: parseInt(downtimes[i])
                    });
                }
            }
            saveProblem(null, machineCode, docNo, problems);
        };
    }
}

function addNewProblemField() {
    const form = document.getElementById('editProblemForm');
    const newField = document.createElement('div');
    newField.innerHTML = `
        <input type="text" name="description[]" placeholder="รายละเอียดปัญหา">
        <input type="number" name="downtime[]" placeholder="เวลาที่เสีย" min="0"> นาที
        <button type="button" onclick="removeProblem(this)">ลบ</button>
    `;
    form.insertBefore(newField, form.lastElementChild);
}

function removeProblem(button) {
    button.parentElement.remove();
}

function showEditModal(content) {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.style.position = 'fixed';
    modal.style.left = '50%';
    modal.style.top = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.padding = '20px';
    modal.style.border = '1px solid black';
    modal.style.zIndex = '1000';
    modal.innerHTML = content;
    document.body.appendChild(modal);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.remove();
}

async function refreshTableData() {
    const rows = document.querySelectorAll('#barChartTable tbody tr');
    const causeData = await fetchCauseData(selectedDate);

    rows.forEach(row => {
        const machineCode = row.getAttribute('data-machine');
        const docNo = row.getAttribute('data-docno');
        const relevantCause = causeData.find(c => c.MachineCode === machineCode && c.DocNo === docNo);

        if (relevantCause) {
            const problemDetailsCell = row.querySelector('.problem-details');
            const downtimeCell = row.querySelector('td:nth-child(7)'); // เปลี่ยนเป็น 7 เนื่องจากลำดับคอลัมน์เปลี่ยนไป

            if (problemDetailsCell && downtimeCell) {
                const causeText = relevantCause.Causes.join(', ');
                problemDetailsCell.textContent = causeText;
                problemDetailsCell.setAttribute('data-total-downtime', relevantCause.TotalDowntime);
                downtimeCell.textContent = relevantCause.TotalDowntime;
            }
        }

        const actionCell = row.querySelector('td:nth-child(8)'); // ปรับตามลำดับคอลัมน์จริง
        if (actionCell) {
            actionCell.innerHTML = `<button onclick="editProblem('${machineCode}', '${docNo}')">แก้ไขปัญหา</button>`;
        }
    });
        // เพิ่มการเรียกใช้ฟังก์ชันปรับความกว้าง header หลังจากอัปเดตข้อมูล
        adjustHeaderWidth();
}


function saveCause() {
    const causeData = [];
    // รวบรวมข้อมูล Cause จากตาราง
    document.querySelectorAll('#barChartTable tbody tr').forEach(row => {
        const docNo = row.getAttribute('data-docno');
        const causeInput = row.querySelector('input[name="cause"]');
        if (causeInput && causeInput.value) {
            causeData.push({
                date: selectedDate,
                machineCode: row.cells[0].textContent,
                docNo: docNo,
                cause: causeInput.value
            });
        }
    })
    
    fetch('/api/saveAllCause', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: causeData}),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert('บันทึก Cause สำเร็จ');
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึก Cause');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการบันทึก Cause');
    });
}

async function showMachineDetails(machineCode, date) {
    try {
        // Calculate time range
        const startDate = new Date(date);
        startDate.setHours(8, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(7, 59, 59, 999);

        // Add one more day to ensure we get all data
        const extendedEndDate = new Date(endDate);
        extendedEndDate.setDate(extendedEndDate.getDate() + 1);

        // Call the machineDetailsExtended API
        const response = await fetch(`http://192.168.1.214:5000/api/machineDetailsExtended?startDate=${startDate.toISOString()}&endDate=${extendedEndDate.toISOString()}&machineCode=${machineCode}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        let detailsHTML = `
            <html>
            <head>
                <title>รายละเอียด ${machineCode} (Annealing)</title>
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid black; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h2>รายละเอียดของ ${machineCode} (Annealing)</h2>
                <h3>ช่วงเวลา: ${formatDateThai(startDate)} ถึง ${formatDateThai(endDate)}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>DocNo</th>
                            <th>RSNCode</th>
                            <th>ItemType</th>
                            <th>ItemQty</th>
                            <th>ItemWeight</th>
                            <th>CoilNo</th>
                            <th>PrintTime</th>
                            <th>MachineCode</th>
                            <th>Remark</th>
                            <th>PartName</th>
                            <th>OrderWeight</th>
                            <th>ItemLen</th>
                            <th>SizeIn</th>
                            <th>SizeOut</th>
                            <th>Plan</th>
                            <th>Cause</th>
                            <th>Downtime</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                `;  
                
        data.forEach(item => {
            const printTime = new Date(item.PrintTime);
            if (printTime >= startDate && printTime <= endDate) {
                detailsHTML += `
                    <tr>
                        <td>${item.DocNo || ''}</td>
                        <td>${item.RSNCode || ''}</td>
                        <td>${item.ItemType || ''}</td>
                        <td>${item.ItemQty || ''}</td>
                        <td>${item.printWeight || ''}</td>
                        <td>${item.CoilNo || ''}</td>
                        <td>${formatDateThai(printTime)}</td>
                        <td data-machinecode="${item.MachineCode || ''}">${item.MachineCode || ''}</td>
                        <td><input type="text" style="width: 100%;" value="${item.Remark || ''}" id="remark-${item.DocNo}-${item.RSNCode}"></td>
                        <td>${item.PartName || ''}</td>
                        <td>${item.OrderWeight || ''}</td>
                        <td>${item.ItemLen || ''}</td>
                        <td>${item.SizeIn || ''}</td>
                        <td>${item.SizeOut || ''}</td>
                        <td>${item.Plan || ''}</td>
                        <td>${item.Cause || ''}</td>
                        <td>${item.Downtime || ''}</td>
                        <td><button onclick="saveRemark('${item.DocNo}', '${item.RSNCode}', this)">บันทึก</button></td>
                    </tr>                      
                `;
            }
        });
                
        detailsHTML += `
                </tbody>
            </table>
            <script>
            async function saveRemark(docNo, rsnCode, button) {
                const row = button.closest('tr');
                const remarkInput = row.querySelector('input[id^="remark-"]');
                const remark = remarkInput.value;
                const machineCodeCell = row.querySelector('td[data-machinecode]');
                let currentMachineCode = machineCodeCell.textContent.trim() || machineCodeCell.getAttribute('data-machinecode');

                // For Annealing, we don't need to check for specific machine code patterns
                const newMachineCode = currentMachineCode;

                console.log('Current MachineCode:', currentMachineCode);
                console.log('New MachineCode:', newMachineCode);

                try {
                    const response = await fetch('http://192.168.1.214:5000/api/updateRemark', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            docNo,
                            rsnCode,
                            remark,
                            currentMachineCode,
                            newMachineCode
                        }),
                    });
                    
                    if (!response.ok) throw new Error('Network response was not ok');
                    const result = await response.json();

                    // Update the row in the details table
                    machineCodeCell.textContent = newMachineCode;
                    machineCodeCell.setAttribute('data-machinecode', newMachineCode);
                    remarkInput.value = remark;

                    // Update the main table if it exists
                    if (window.opener && window.opener.updateMainTableRemark) {
                        window.opener.updateMainTableRemark(docNo, rsnCode, remark, newMachineCode);
                    }

                    alert('บันทึก Remark และอัปเดตข้อมูลเรียบร้อยแล้ว');
                } catch (error) {
                    console.error('Error saving remark:', error);
                    alert('เกิดข้อผิดพลาดในการบันทึก Remark: ' + error.message);
                }
            }
            </script>
        </body>
        </html>
        `;
        
        const detailsWindow = window.open('', 'Annealing Machine Details', 'width=1200,height=600');
        detailsWindow.document.write(detailsHTML);
        detailsWindow.document.close();
    } catch (error) {
        console.error('Error fetching annealing machine details:', error);
        alert(`เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด Annealing: ${error.message}`);
    }
}

function updateMainTableRemark(docNo, rsnCode, remark, newMachineCode) {
    const mainTableRow = document.querySelector(`#barChartTable tr[data-docno="${docNo}"]`);
    if (mainTableRow) {
        const machineCodeCell = mainTableRow.querySelector('td:first-child');
        const remarkCell = mainTableRow.querySelector('td:nth-child(6)');
        if (machineCodeCell && remarkCell) {
            machineCodeCell.textContent = newMachineCode;
            machineCodeCell.setAttribute('data-machinecode', newMachineCode);
            remarkCell.textContent = remark;
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    const dateElement = document.getElementById('selectedDate');
    if (dateElement) {
        dateElement.value = selectedDate;
    } else {
        console.error('selectedDate element not found');
    }

    fetchData();

    const filterButton = document.getElementById('dailyTableFilterButton');
    if (filterButton) {
        filterButton.addEventListener('click', () => {
            const dateElement = document.getElementById('selectedDate');
            if (dateElement) {
                selectedDate = dateElement.value;
                console.log('Filtering for date:', selectedDate);
                fetchData();
            } else {
                console.error('selectedDate element not found');
            }
        });
    } else {
        console.error('Filter button not found');
    }

    document.querySelector('#barChartTable').addEventListener('click', function(e) {
        if (e.target.classList.contains('view-details')) {
            const machineCode = e.target.getAttribute('data-machine');
            const date = e.target.getAttribute('data-date');
            showMachineDetails(machineCode, date);
        }
    });

    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToExcel);
    } else {
        console.error('Export button not found');
    }
});

async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const dateElement = document.getElementById('selectedDate');
    if (!dateElement) {
        alert('วันที่ไม่ถูกต้อง');
        return;
    }
    const selectedDate = dateElement.value;

    const worksheet = workbook.addWorksheet('Annealing Report');

    // กำหนด columns ใน excel 
    worksheet.columns = [
        { header: 'MachineCode', key: 'machineCode', width: 15 },
        { header: 'Actual', key: 'actual', width: 10 },
        { header: 'Plan', key: 'plan', width: 10 },
        { header: '%POP', key: 'pop', width: 10 },
        { header: 'MFGNo', key: 'mfgNo', width: 15 },
        { header: 'ปัญหาที่เกิด', key: 'problems', width: 30 },
        { header: 'เวลาสูญเสีย', key: 'totalDowntime', width: 15 },
        { header: 'Speed (m/s)', key: 'speed', width: 15 },
        { header: 'Remark', key: 'remark', width: 20 },
        { header: 'Order ที่เปิด', key: 'orderWeight', width: 15 },
        { header: 'ยาว', key: 'itemLen', width: 15 },
        { header: 'Grade', key: 'partName', width: 20 },       
        { header: 'SizeIn', key: 'sizeIn', width: 15 },
        { header: 'SizeOut', key: 'sizeOut', width: 15},
        { header: 'CustName', key: 'custName', width: 30 }
    ];

    // สร้าง style สำหรับ header
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008000' } },
        border: {
            top: { style: 'medium' },
            left: { style: 'medium' },
            bottom: { style: 'medium' },
            right: { style: 'medium' }
        }
    };

    // ใส่ style ให้ header
    worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
    });

    // สร้าง object เพื่อเก็บข้อมูลรวมของแต่ละ MachineCode
    const machineTotals = {};
    const machineFirstRow = {};

    // รวบรวมข้อมูลทั้งหมดก่อน
    const rows = document.querySelectorAll('#barChartTable tbody tr:not(.machine-separator)');
    let previousMachineCode = '';
    rows.forEach(row => {
        const machineCode = row.cells[0].textContent;
        const actual = parseFloat(row.cells[1].textContent) || 0;
        const planText = row.cells[2].textContent.trim();
        const plan = planText === '-' ? 0 : parseFloat(planText) || 0;

        if (!machineTotals[machineCode]) {
            machineTotals[machineCode] = { totalActual: 0, totalPlan: 0 };
            machineFirstRow[machineCode] = true;
        }
        machineTotals[machineCode].totalActual += actual;
        machineTotals[machineCode].totalPlan += plan;
    });

    // คำนวณ %POP สำหรับแต่ละ MachineCode
    for (const machineCode in machineTotals) {
        const { totalActual, totalPlan } = machineTotals[machineCode];
        const pop = totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(2) : '0.00';
        machineTotals[machineCode].pop = pop === '0.00' ? '0.00' : pop;
        // สี
        machineTotals[machineCode].popColor = parseFloat(pop) >= 95 ? { argb: 'FF90EE90' } : { argb: 'FFFF6347' };
    }

    // เพิ่มข้อมูลลงใน worksheet
    previousMachineCode = '';
    rows.forEach((row, index) => {
        const machineCode = row.cells[0].textContent;
        
        // เพิ่มเส้นแบ่งถ้า MachineCode เปลี่ยน
        if (machineCode.slice(0, 6) !== previousMachineCode.slice(0, 6) && previousMachineCode !== '') {
            const separatorRow = worksheet.addRow({});
            separatorRow.height = 3;
            separatorRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' }
            };
        }
        previousMachineCode = machineCode;

        const actual = row.cells[1].textContent;
        const plan = row.cells[2].textContent.trim();
        const docNo = row.cells[3].textContent;
        const remark = row.cells[5].textContent;
        const problemDetailsCell = row.querySelector('.problem-details');
        const problemsText = problemDetailsCell ? problemDetailsCell.textContent : '';
        const totalDowntime = row.cells[7].textContent;
        const orderWeight = row.cells[8].textContent;
        const itemLen = row.cells[9].textContent;
        const sizeIn = row.cells[10].textContent;
        const sizeOut = row.cells[11].textContent;
        const partName = row.cells[12].textContent;
        const custName = row.cells[4].textContent;
        
        let popValue = '';
        let popColor = { argb: 'FFFFFF' };
        if (machineFirstRow[machineCode]) {
            popValue = machineTotals[machineCode].pop + '%';
            popColor = machineTotals[machineCode].popColor;
            machineFirstRow[machineCode] = false;
        }

        // แยกปัญหาและรวมกลับเป็นข้อความเดียวโดยใช้ line break
        const problems = problemsText.split('\n').map(p => p.trim()).filter(p => p !== '');
        let formattedProblems = problems.join('\n');

        const excelRow = worksheet.addRow({
            machineCode, 
            actual, 
            plan, 
            pop: popValue,
            mfgNo: docNo, 
            problems: formattedProblems,
            totalDowntime, 
            speed: '', 
            remark,
            orderWeight,
            itemLen,
            partName,
            sizeIn,
            sizeOut,
            custName
        });

        // ใส่สีพื้นหลังสำหรับคอลัมน์ที่ต้องการ
        const bgColor = { argb: 'FFFFE9D9' }; // R=253,G=233,B=217
        ['machineCode', 'actual', 'plan'].forEach(key => {
            const cell = excelRow.getCell(key);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: bgColor
            };
        });

        // กำหนดสีพื้นหลังสำหรับคอลัมน์ %POP
        excelRow.getCell('pop').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: popColor
        };

        // ตั้งค่า text wrap สำหรับคอลัมน์ Problems
        excelRow.getCell('problems').alignment = { wrapText: true };
    });

    try {
        // สร้างไฟล์ Excel 
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);

        // สร้าง link และ trigger การดาวน์โหลด
        const link = document.createElement("a");
        link.href = url;
        link.download = `annealing_report_${selectedDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + error.message);
    }
}

async function fetchCauseData(date) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/getCauses?date=${formatDate(date)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching cause data:', error);
        return [];
    }
}

function adjustHeaderWidth() {
    const table = document.getElementById('barChartTable');
    const headerCells = table.querySelectorAll('thead th');
    const bodyCells = table.querySelectorAll('tbody tr:first-child td');

    headerCells.forEach((headerCell, index) => {
        if (bodyCells[index]) {
            const width = bodyCells[index].offsetWidth;
            headerCell.style.width = `${width}px`;
        }
    });
}

// function exportToPDF() {
//     const dateElement = document.getElementById('selectedDate');
//     const selectedDate = dateElement ? dateElement.value : 'Unknown Date';

//     // รวบรวมข้อมูลจากตาราง
//     const tableData = [];
//     const rows = document.querySelectorAll('#barChartTable tbody tr:not(.machine-separator)');
    
//     rows.forEach(row => {
//         const machineCode = row.cells[0].textContent;
//         const actual = row.cells[1].textContent;
//         const plan = row.cells[2].textContent;
//         const mfgNo = row.cells[3].textContent;
//         const custName = row.cells[4].textContent;
//         const remark = row.cells[5].textContent;
//         const problemDetailsCell = row.querySelector('.problem-details');
//         const problemsText = problemDetailsCell ? problemDetailsCell.textContent : '';
//         const totalDowntime = row.cells[7].textContent;
//         const orderWeight = row.cells[8].textContent;
//         const itemLen = row.cells[9].textContent;
//         const sizeIn = row.cells[10].textContent;
//         const sizeOut = row.cells[11].textContent;
//         const partName = row.cells[12].textContent;

//         // คำนวณ %POP
//         const actualValue = parseFloat(actual) || 0;
//         const planValue = plan === '-' ? 0 : (parseFloat(plan) || 0);
//         const pop = planValue > 0 ? ((actualValue / planValue) * 100).toFixed(2) + '%' : '0.00%';

//         tableData.push({
//             machineCode, actual, plan, pop, mfgNo, problems: problemsText, totalDowntime,
//             remark, orderWeight, itemLen, partName, sizeIn, sizeOut, custName
//         });
//     });

//     // ส่งข้อมูลไปยัง server
//     fetch('/api/export-pdf', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ tableData, selectedDate }),
//     })
//     .then(response => response.blob())
//     .then(blob => {
//         // สร้าง URL สำหรับ blob และเปิดในแท็บใหม่
//         const url = window.URL.createObjectURL(blob);
//         window.open(url, '_blank');
//     })
//     .catch(error => {
//         console.error('Error exporting to PDF:', error);
//         alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
//     });
// }