let selectedDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
let allData = [];
const SECTION = '';
let isInitialLoad = true;
let rawData = [];

function clearTable() {
    const tableBody = document.querySelector('#barChartTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
    } else {
        console.error('Table body not found');
    }
}

async function fetchData() {
    try {
        const url = new URL('http://192.168.1.214:5000/api/bar1/v2/tableDaily');
        url.searchParams.append('date', selectedDate);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Raw data from API:', result);

        if (result.success && result.data) {
            // กรองข้อมูล
            const filteredData = result.data.filter(item => 
                item.MachineCode !== 'COM002' || item.MachineCode === 'CUT022'
            );

            // ดึงข้อมูล Cause
            const causeData = await fetchCauseDataMswAll(selectedDate);
            console.log('Cause data after fetching:', causeData);

            allData = filteredData.map(item => {
                const baseMachineCode = item.MachineCode.split('-')[0];
                const causes = causeData[baseMachineCode] || [];
                return {
                    ...item,
                    MachineCode: baseMachineCode,
                    Actual: parseFloat(item.Actual) || 0,
                    Plan: parseFloat(item.Plan) || 0,
                    Causes: Array.isArray(causes) ? causes.map(c => ({ 
                        description: c.description, 
                        downtime: c.downtime,
                        notes: c.notes,
                        breakdownId: c.breakdownId,
                        id: c.id
                    })) : [],
                    TotalDowntime: Array.isArray(causes) ? 
                        causes.reduce((sum, c) => sum + (parseFloat(c.downtime) || 0), 0) : 0
                };
            });

            if (allData.length === 0) {
                clearTable();
                document.querySelector('#barChartTable tbody').innerHTML = 
                    '<tr><td colspan="15">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
            } else {
                const groupedData = groupDataByMachineAndDoc(allData);
                populateBarChartTable(groupedData);
                adjustHeaderWidth();
            }
        }
    } catch (error) {
        console.error('Error in fetchData:', error);
        document.querySelector('#barChartTable tbody').innerHTML = 
            `<tr><td colspan="15">เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}</td></tr>`;
    }
}


async function initPage() {
    await fetchData();
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
    const problemsByMachine = {};

    data.forEach(item => {
        if (item.ItemType !== 'NG') {
            const key = `${item.MachineCode}-${item.DocNo}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    MachineCode: item.MachineCode,
                    DocNo: item.DocNo,
                    Actual: 0,
                    Plan: parseFloat(item.Plan) || 0,
                    PrintTime: item.PrintTime,
                    CustName: item.CustName,
                    Remark: item.Remark,
                    OrderWeight: item.OrderWeight || item.ItemWeight || '',
                    ItemLen: item.ItemLen || '',
                    SizeIn: item.SizeIn || '',
                    SizeOut: item.SizeOut || '',
                    PartName: item.PartName || ''
                };
            }
            groupedData[key].Actual += parseFloat(item.Actual) || 0;

            if (!problemsByMachine[item.MachineCode]) {
                problemsByMachine[item.MachineCode] = new Set();
            }
            if (item.Causes && Array.isArray(item.Causes)) {
                item.Causes.forEach(cause => {
                    problemsByMachine[item.MachineCode].add(JSON.stringify(cause));
                });
            }
        }
    });

    Object.values(groupedData).forEach(item => {
        if (problemsByMachine[item.MachineCode]) {
            item.Causes = Array.from(problemsByMachine[item.MachineCode])
                .map(causeString => JSON.parse(causeString));
            item.TotalDowntime = item.Causes.reduce((sum, cause) => 
                sum + (parseInt(cause.downtime) || 0), 0);
            problemsByMachine[item.MachineCode] = null;
        }
    });

    // เรียงลำดับตาม MachineCode
    return Object.values(groupedData).sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));
}

function truncateText(text, maxLength = 30) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}


function populateBarChartTable(groupedData) {
    const tableBody = document.querySelector('#barChartTable tbody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }

    tableBody.innerHTML = '';
    if (groupedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="15">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
        return;
    }

    let isAlternateColor = false;
    let lastMachineCode = null;

    groupedData.forEach((item, index) => {
        if (item.MachineCode.startsWith('COM') || item.MachineCode === 'CUT022') {
            if (item.MachineCode !== lastMachineCode) {
                if (index !== 0) {
                    tableBody.innerHTML += `<tr class="machine-separator"><td colspan="15"></td></tr>`;
                }
                isAlternateColor = !isAlternateColor;
            }
        }

        const planValue = item.Plan > 0 ? item.Plan.toFixed(1) : '-';
        const actualValue = isNaN(item.Actual) ? '-' : parseFloat(item.Actual).toFixed(1);

        let causeHTML = '';
        let totalDowntime = 0;
        
        if (Array.isArray(item.Causes) && item.Causes.length > 0) {
            causeHTML = item.Causes.map(cause => {
                if (cause && cause.description) {
                    const downtime = parseFloat(cause.downtime) || 0;
                    totalDowntime += downtime;
                    return `
                        <div data-breakdownid="${cause.breakdownId || ''}" 
                             data-id="${cause.id || ''}" 
                             data-notes="${cause.notes || ''}">
                            ${cause.description} (${downtime} นาที)
                        </div>
                    `;
                }
                return '';
            }).join('');
        } else {
            causeHTML = '<div></div>';
        }

        const notesAttribute = Array.isArray(item.Causes) 
            ? item.Causes.map(c => c.notes).filter(Boolean).join('; ')
            : '';

        const row = `
        <tr class="${isAlternateColor ? 'alternate-row' : ''}" 
                data-machine="${item.MachineCode}" 
                data-date="${selectedDate}" 
                data-docno="${item.DocNo || ''}">
            <td>${item.MachineCode}</td>
            <td>${actualValue}</td>
            <td>${planValue}</td>
            <td>${item.DocNo || ''}</td>
            <td title="${item.CustName || ''}">${item.CustName || ''}</td>
            <td>${item.Remark || '-'}</td>
            <td class="problem-column">
                <div class="problem-details" data-notes="${notesAttribute}">
                    ${causeHTML}
                </div>
            </td>
            <td>${totalDowntime}</td>
            <td>${item.OrderWeight}</td>
            <td>${item.ItemLen}</td>
            <td>${item.SizeIn}</td>
            <td>${item.SizeOut}</td>
            <td>${item.PartName}</td>
            <td>
                <button onclick="editProblem('${item.MachineCode}', '${selectedDate}', '${item.DocNo || ''}')" 
                        class="btn btn-success">บันทึก/แก้ไข</button>
            </td>
            <td>
                <button class="btn btn-primary btn-sm view-details" 
                        data-machine="${item.MachineCode}" 
                        data-date="${selectedDate}">
                    รายละเอียด
                </button>
            </td>
        </tr>        
        `;
        tableBody.innerHTML += row;

        lastMachineCode = item.MachineCode;
    });

    adjustHeaderWidth();
    adjustProblemDetails();
    
    // เพิ่ม event listener สำหรับปุ่ม toggle
    const toggleButtons = document.querySelectorAll('.toggle-full-details');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const fullDetails = this.nextElementSibling;
            const shortDetails = this.previousElementSibling;
            if (fullDetails.style.display === 'none') {
                fullDetails.style.display = 'block';
                shortDetails.style.display = 'none';
                this.textContent = 'ซ่อนรายละเอียด';
            } else {
                fullDetails.style.display = 'none';
                shortDetails.style.display = 'block';
                this.textContent = 'แสดงเพิ่มเติม';
            }
            e.stopPropagation(); // ป้องกันการ bubble ของ event
        });
    });
}

// เพิ่มสไตล์ CSS
// เพิ่มสไตล์ CSS
const style = document.createElement('style');
style.textContent = `
    .problem-edit-row {
        display: flex;
        margin-bottom: 10px;
        align-items: center;
    }
    .problem-edit-row.header-row {
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 2px solid #ccc;
        padding-bottom: 5px;
    }
    .problem-edit-row.header-row div {
        padding: 5px;
    }
    .description-input {
        flex: 2;
        margin-right: 10px;
        max-width: 160px;
    }
    .downtime-input {
        width: 80px;
        margin-right: 10px;
    }
    .notes-input {
        flex: 3;
        min-width: 600px;
    }
    #editProblemForm button {
        margin-top: 10px;
        margin-right: 10px;
    }
    #editModal {
        display: flex;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.4);
        justify-content: center;
        align-items: center;
    }
    .modal-content {
        background-color: #fefefe;
        padding: 20px;
        border: 1px solid #888;
        width: 90%;
        max-width: 1200px;
        position: relative;
    }
    .close {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        position: absolute;
        right: 10px;
        top: 5px;
    }
    .close:hover,
    .close:focus {
        color: black;
        text-decoration: none;
        cursor: pointer;
    }
`;
document.head.appendChild(style);

            // `/(.*) \((\d+) นาที\)(?: - (.*))?/`
            // 1. `(.*)` - จับคู่และบันทึกข้อความใดๆ (รายละเอียดปัญหา)
            // 2. ` \(` - ตามด้วยวงเล็บเปิด
            // 3. `(\d+)` - จับคู่และบันทึกตัวเลขหนึ่งหลักขึ้นไป (เวลา downtime)
            // 4. ` นาที\)` - ตามด้วยคำว่า "นาที" และวงเล็บปิด
            // 5. `(?: - (.*))?` - ส่วนนี้เป็นกลุ่มที่ไม่จับคู่ (non-capturing group) ซึ่งเป็นตัวเลือก (optional):
            //    - `(?:...)` - กลุ่มที่ไม่จับคู่
            //    - ` - ` - ตามด้วยเครื่องหมายขีดกลางและช่องว่าง
            //    - `(.*)` - จับคู่และบันทึกข้อความใดๆ (notes)
            //    - `?` - ทำให้กลุ่มทั้งหมดเป็นตัวเลือก

            // ทำไมมันถึงได้ผล:
            // 1. มันจับคู่รูปแบบทั้งหมดของข้อความ รวมถึงส่วน notes ที่อาจมีหรือไม่มีก็ได้
            // 2. `(?: - (.*))?` ทำให้สามารถจับคู่ notes ได้โดยไม่จำเป็นต้องมี notes เสมอไป
            // 3. ถ้ามี notes, มันจะถูกจับคู่และบันทึกไว้ในกลุ่มที่ 3 ของ match

            // ตัวอย่างการทำงาน:
            // - "ปัญหา A (30 นาที)" -> match[1] = "ปัญหา A", match[2] = "30", match[3] = undefined
            // - "ปัญหา B (45 นาที) - หมายเหตุ" -> match[1] = "ปัญหา B", match[2] = "45", match[3] = "หมายเหตุ"

            // การเพิ่ม `(?: - (.*))?` ทำให้ regular expression สามารถรองรับทั้งกรณีที่มีและไม่มี notes ได้อย่างยืดหยุ่น ทำให้สามารถดึงข้อมูล notes ได้อย่างถูกต้องในทุกกรณี
// ปุ่มบันทึก/แก้ไข
function editProblem(machineCode, date, docNo) {
    // เพิ่มการตรวจสอบพารามิเตอร์
    if (!machineCode || !date || !docNo) {
        console.error('Missing required parameters:', { machineCode, date, docNo });
        return;
    }

    const row = document.querySelector(`#barChartTable tr[data-machine="${machineCode}"][data-date="${date}"]`);
    if (!row) {
        console.error('Row not found:', { machineCode, date, docNo });
        return;
    }

    const problemDetailsCell = row.querySelector('.problem-column .problem-details');
    let currentProblems = Array.from(problemDetailsCell.querySelectorAll('div')).map((div, index) => {
        const match = div.textContent.match(/(.*) \((\d+) นาที\)/);
        console.log(`Processing problem ${index}:`, { text: div.textContent, match });
        return {
            description: match ? match[1].trim() : div.textContent,
            downtime: match ? parseInt(match[2]) : 0,
            id: div.dataset.id || null,
            breakdownId: div.dataset.breakdownid || null,
            originalDowntime: match ? parseInt(match[2]) : 0,
            notes: div.dataset.notes || '',
            index: index
        };
    });

    console.log('Current problems:', currentProblems);

    let formHTML = `
        <h2>แก้ไขปัญหา</h2>
        <form id="editProblemForm">
            <div class="problem-edit-row header-row">
                <div class="description-input">Cause</div>
                <div class="downtime-input">Downtime</div>
                <div class="notes-input">Notes</div>
            </div>
    `;

    // แสดงเฉพาะปัญหาที่มีข้อมูล
    currentProblems.forEach((problem, index) => {
        if (problem.description.trim()) {  // เพิ่มการตรวจสอบ
            formHTML += `
                <div class="problem-edit-row">
                    <input type="text" name="description[]" value="${problem.description}" readonly class="description-input">
                    <input type="number" name="downtime[]" value="${problem.downtime}" min="0" class="downtime-input">
                    <input type="text" name="notes[]" value="${problem.notes}" placeholder="Notes" class="notes-input">
                    <input type="hidden" name="id[]" value="${problem.id || ''}">
                    <input type="hidden" name="breakdownId[]" value="${problem.breakdownId || ''}">
                    <input type="hidden" name="originalDowntime[]" value="${problem.originalDowntime}">
                    <input type="hidden" name="index[]" value="${index}">
                </div>
            `;
        }
    });

    formHTML += `
            <button type="button" onclick="addNewProblemField()" class="btn btn-secondary">เพิ่มปัญหา</button>
            <button type="submit" class="btn btn-primary">บันทึก</button>
        </form>
    `;

    showEditModal(formHTML);

    document.getElementById('editProblemForm').onsubmit = function(e) {
        e.preventDefault();
        console.log('Form submitted');

        const formData = new FormData(e.target);
        const problems = [];
        const descriptions = formData.getAll('description[]');
        const downtimes = formData.getAll('downtime[]');
        const notes = formData.getAll('notes[]');
        const ids = formData.getAll('id[]');
        const breakdownIds = formData.getAll('breakdownId[]');
        const originalDowntimes = formData.getAll('originalDowntime[]');
        const indices = formData.getAll('index[]');

        let hasChanges = false;

        for (let i = 0; i < descriptions.length; i++) {
            const currentDowntime = parseInt(downtimes[i]);
            const originalDowntime = parseInt(originalDowntimes[i]);
            const currentNotes = notes[i];
            
            console.log(`Processing form field ${i}:`, {
                description: descriptions[i],
                currentDowntime,
                originalDowntime,
                notes: currentNotes,
                id: ids[i],
                breakdownId: breakdownIds[i]
            });

            // ตรวจสอบการเปลี่ยนแปลง
            if (currentDowntime !== originalDowntime || !ids[i] || currentNotes !== currentProblems[i]?.notes) {
                // เพิ่มการตรวจสอบ description ไม่ให้ว่าง
                if (descriptions[i].trim()) {
                    problems.push({
                        id: ids[i] || null,
                        breakdownId: breakdownIds[i] || null,
                        description: descriptions[i],
                        downtime: currentDowntime,
                        notes: currentNotes,
                        originalDowntime: originalDowntime,
                        index: parseInt(indices[i])
                    });
                    hasChanges = true;
                }
            }
        }

        console.log('Form processing result:', {
            hasChanges,
            problems
        });

        if (hasChanges) {
            saveProblem(machineCode, date, docNo, problems);
        } else {
            console.log('No changes detected');
            alert('ไม่มีการเปลี่ยนแปลงข้อมูล');
            closeEditModal();
        }
    };
}

function addNewProblemField() {
    const form = document.getElementById('editProblemForm');
    const newField = document.createElement('div');
    newField.className = 'problem-edit-row';
    newField.innerHTML = `
        <input type="text" name="description[]" placeholder="Cause" class="description-input">
        <input type="number" name="downtime[]" value="0" min="0" class="downtime-input">
        <input type="text" name="notes[]" placeholder="Notes" class="notes-input">
        <input type="hidden" name="id[]" value="">
        <input type="hidden" name="breakdownId[]" value="">
        <input type="hidden" name="originalDowntime[]" value="0">
        <input type="hidden" name="index[]" value="${form.querySelectorAll('.problem-edit-row').length - 1}">
        <button type="button" onclick="removeProblem(this)" class="btn btn-danger btn-sm">ลบ</button>
    `;
    form.insertBefore(newField, form.querySelector('button[type="button"]'));
}

function removeProblem(button) {
    button.parentElement.remove();
}

function showEditModal(content) {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            ${content}
        </div>
    `;
    document.body.appendChild(modal);

    // เพิ่ม event listener สำหรับปุ่มปิด
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = closeEditModal;

    // เพิ่ม event listener สำหรับการคลิกนอก modal เพื่อปิด
    window.onclick = function(event) {
        if (event.target == modal) {
            closeEditModal();
        }
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
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

async function saveCause(data) {
    try {
        const response = await fetch('http://192.168.1.214:5000/api/bar1/v2/saveCause', { // เปลี่ยนเป็น v2
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data }),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
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

// function ในของปุ่มรายละเอียด พวก CoilNo. ย่อยๆ
async function showMachineDetails(machineCode, date) {
    try {
        // เพิ่มการคำนวณ startDate และ endDate
        const startDate = new Date(date);
        startDate.setHours(8, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(7, 59, 59, 999);
        const response = await fetch(`http://192.168.1.214:5000/api/bar1/v2/machineDetails?machineCode=${machineCode}&date=${date}`); // เปลี่ยนเป็น v2
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        let detailsHTML = `
            <html>
            <head>
                <title>รายละเอียด ${machineCode} (COM)</title>
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid black; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h2>รายละเอียดของ ${machineCode} (COM)</h2>
                <h3>ช่วงเวลา: ${formatDateThai(startDate)} ถึง ${formatDateThai(endDate)}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>DocNo</th>
                            <th>RSNCode</th>
                            <th>ItemType</th>
                            <th>น้ำหนักออก(Kg.)</th>
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
                            <th>notes</th>
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
                        <td>${item.printWeight || ''}</td>
                        <td>${item.CoilNo || ''}</td>
                        <td>${dateUtils.formatDateThai(item.PrintTime)}</td>
                        <td data-machinecode="${item.MachineCode || ''}">${item.MachineCode || ''}</td>
                        <td><input type="text" style="width: 100%;" value="${item.Remark || ''}" id="remark-${item.DocNo}-${item.RSNCode}"></td>
                        <td>${item.PartName || ''}</td>
                        <td>${item.OrderWeight || ''}</td>
                        <td>${item.ItemLen || ''}</td>
                        <td>${item.SizeIn || ''}</td>
                        <td>${item.SizeOut || ''}</td>
                        <td>${item.Plan || ''}</td>
                        <td>${item.notes}</td>
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

                // Check if Remark contains 'Combine'
                const comMatch = remark.match(/COM\\d{3}/);
                const newMachineCode = comMatch ? comMatch[0] : currentMachineCode;

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
                    
                    console.log('Full response:', response);

                    const responseText = await response.text();
                    console.log('Response text:', responseText);

                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                        throw new Error('Invalid JSON response from server');
                    }

                    if (!response.ok) {
                        throw new Error(result.error || 'Unknown server error');
                    }

                    // Update the row in the details table
                    machineCodeCell.textContent = result.updatedData.newMachineCode;
                    machineCodeCell.setAttribute('data-machinecode', result.updatedData.newMachineCode);
                    remarkInput.value = result.updatedData.remark;

                    // Update the main table if it exists
                    if (window.opener && window.opener.updateMainTableRemark) {
                        window.opener.updateMainTableRemark(docNo, rsnCode, result.updatedData.remark, result.updatedData.newMachineCode);
                    }

                    alert('บันทึก Remark และอัปเดตข้อมูลเรียบร้อยแล้ว');
                } catch (error) {
                    console.error('Error saving remark:', error);
                    alert(\`เกิดข้อผิดพลาดในการบันทึก Remark: \${error.message}\`);
                }
            }
            </script>
        </body>
        </html>
        `;
        
        const detailsWindow = window.open('', 'Combine Machine Details', 'width=1200,height=600');
        detailsWindow.document.write(detailsHTML);
        detailsWindow.document.close();
    } catch (error) {
        console.error('Error fetching Combine machine details:', error);
        alert(`เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด Combine: ${error.message}`);
    }
}

async function updateRemark(docNo, rsnCode, remark, currentMachineCode, newMachineCode) {
    try {
        const response = await fetch('http://192.168.1.214:5000/api/bar1/v2/updateRemark', { // เปลี่ยนเป็น v2
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

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

async function saveRemark(docNo, rsnCode, button) {
    const row = button.closest('tr');
    const remarkInput = row.querySelector('input[id^="remark-"]');
    const remark = remarkInput.value;
    const machineCodeCell = row.querySelector('td[data-machinecode]');
    let currentMachineCode = machineCodeCell.textContent.trim() || machineCodeCell.getAttribute('data-machinecode');

    // Check if Remark contains 'Combine'
    const comMatch = remark.match(/COM\d{3}/);
    const newMachineCode = comMatch ? comMatch[0] : currentMachineCode;

    console.log('Current MachineCode:', currentMachineCode);
    console.log('New MachineCode:', newMachineCode);

    try {
        const response = await fetch('http://192.168.1.214:5000/api/bar1/v2/updateRemark', {
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
        
        console.log('Full response:', response);

        const responseText = await response.text();
        console.log('Response text:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            throw new Error('Invalid JSON response from server');
        }

        if (!response.ok) {
            throw new Error(result.error || 'Unknown server error');
        }

        // Update the row in the details table
        machineCodeCell.textContent = result.updatedData.newMachineCode;
        machineCodeCell.setAttribute('data-machinecode', result.updatedData.newMachineCode);
        remarkInput.value = result.updatedData.remark;

        // Update the main table if it exists
        if (window.opener && window.opener.updateMainTableRemark) {
            window.opener.updateMainTableRemark(docNo, rsnCode, result.updatedData.remark, result.updatedData.newMachineCode);
        }

        alert('บันทึก Remark และอัปเดตข้อมูลเรียบร้อยแล้ว');
    } catch (error) {
        console.error('Error saving remark:', error);
        alert(`เกิดข้อผิดพลาดในการบันทึก Remark: ${error.message}`);
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

function setupEventListeners() {
    setupFilterButton();
    setupExportButton();
    setupTableClickListener();
}

function setupFilterButton() {
    const filterButton = document.getElementById('dailyTableFilterButton');
    if (filterButton) {
        filterButton.addEventListener('click', handleFilterClick);
    } else {
        console.error('Filter button not found');
    }
}

function setupExportButton() {
    const exportButton = document.getElementById('exportButton');
    if (!exportButton) {
        // เปลี่ยนจาก console.error เป็น console.log เพราะอาจไม่ได้ใช้ปุ่มนี้
        console.log('Export button not found - skipping setup');
        return;
    }
    exportButton.addEventListener('click', exportToExcel);
}

function setupTableClickListener() {
    const table = document.querySelector('#barChartTable');
    if (table) {
        table.addEventListener('click', function(e) {
            if (e.target.classList.contains('view-details')) {
                const machineCode = e.target.getAttribute('data-machine');
                const date = e.target.getAttribute('data-date');
                if (machineCode && date) {
                    showMachineDetails(machineCode, date);
                } else {
                    console.error('Missing machine code or date for details view');
                }
            }
        });
    } else {
        console.error('Table not found');
    }
}

function handleFilterClick() {
    const dateElement = document.getElementById('selectedDate');
    if (dateElement && dateElement.value) {
        // แปลงวันที่เป็นรูปแบบ ISO string
        const selectedDateObj = new Date(dateElement.value);
        selectedDate = selectedDateObj.toISOString().split('T')[0];
        console.log('Filtering for date:', selectedDate);
        fetchData().then(() => {
            adjustProblemDetails();
            adjustHeaderWidth();
            // อัปเดตค่าใน input field หลังจาก fetch ข้อมูลเสร็จ
            dateElement.value = selectedDate;
        });
    } else {
        console.error('selectedDate element not found or empty');
    }
}

function handleTableClick(e) {
    if (e.target.classList.contains('view-details')) {
        const machineCode = e.target.getAttribute('data-machine');
        const date = e.target.getAttribute('data-date');
        showMachineDetails(machineCode, date);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    await new Promise(resolve => setTimeout(resolve, 50));
    await fetchData();
    setupEventListeners();
    adjustHeaderWidth(); // เพิ่มบรรทัดนี้
});

// ฟังก์ชันสำหรับปรับความกว้างของ header และ content
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

function adjustProblemDetails() {
    const problemDetails = document.querySelectorAll('.problem-details');
    problemDetails.forEach(cell => {
        cell.title = cell.textContent.trim();
    });
}


function updateTableWithNewCauses(newCauses) {
    newCauses.forEach(cause => {
        const row = document.querySelector(`#barChartTable tr[data-docno="${cause.docNo}"]`);
        if (row) {
            const causeInput = row.querySelector('.cause-input');
            if (causeInput) {
                causeInput.value = cause.cause;
            }
        }
    });
}

async function updateCauses(date, machineCode, docNo, problems) {
    try {
        const response = await fetch('http://192.168.1.214:5000/api/bar1/v2/updateCauses', { // เปลี่ยนเป็น v2
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date,
                machineCode,
                docNo,
                problems
            }),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// รับข้อมูลปัญหา จัดรูปแบบ ส่งไปยัง API
async function saveProblem(machineCode, date, docNo, problems) {
    try {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toISOString().split('T')[0]; // ใช้ ISO format โดยตรง

        console.log('Saving with date:', formattedDate);

        const response = await fetch('http://192.168.1.214:5000/api/bar1/v2/updateCausesMswAll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: formattedDate,
                machineCode,
                docNo,
                problems: problems.map(p => ({
                    ...p,
                    notes: p.notes || ''
                }))
            }),
        });

        const result = await response.json();
        if (result.success) {
            await updateProblemDisplay(machineCode, formattedDate, result.updatedProblems);
            closeEditModal();
            alert('บันทึกข้อมูลเรียบร้อยแล้ว');
            await fetchData();
        } else {
            throw new Error(result.error || result.message || 'Failed to update problems');
        }
    } catch (error) {
        console.error('Error saving problems:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกปัญหา: ' + error.message);
    }
}

async function fetchCauseDataMswAll(date) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/bar1/v2/getCausesMswAll?date=${date}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw cause data MswAll:', data);
        
        // จัดกลุ่มข้อมูลตาม MachineCode
        const groupedData = data.reduce((acc, item) => {
            if (item && item.MachineCode) {
                const machineCode = item.MachineCode.split('-')[0];
                if (!acc[machineCode]) {
                    acc[machineCode] = [];
                }
                acc[machineCode].push({
                    description: item.Cause,
                    downtime: item.Downtime,
                    notes: item.notes,
                    breakdownId: item.breakdownId,
                    id: item.ID
                });
            }
            return acc;
        }, {});
        
        console.log('Grouped cause data:', groupedData);
        return groupedData;
    } catch (error) {
        console.error('Error fetching cause data MswAll:', error);
        return {};
    }
}

function updateProblemDisplay(machineCode, date, problems) {
    console.log('Updating problem display:', { machineCode, date, problems });
    const row = document.querySelector(`#barChartTable tr[data-machine="${machineCode}"][data-date="${date}"]`);
    if (row) {
        const problemDetailsCell = row.querySelector('.problem-details');
        const downtimeCell = row.querySelector('td:nth-child(8)');
        
        let totalDowntime = 0;
        let problemsHTML = '';

        if (Array.isArray(problems) && problems.length > 0) {
            problemsHTML = problems.map(p => {
                const downtime = parseInt(p.downtime) || 0;
                totalDowntime += downtime;
                return `<div data-breakdownid="${p.breakdownId || ''}" data-id="${p.id || ''}">${p.description} (${downtime} นาที)${p.notes ? ` - ${p.notes}` : ''}</div>`;
            }).join('');
        } else {
            problemsHTML = '<div></div>';
        }
        
        problemDetailsCell.innerHTML = problemsHTML;
        problemDetailsCell.setAttribute('data-total-downtime', totalDowntime);
        downtimeCell.textContent = totalDowntime;
    } else {
        console.error('Row not found for updating problem display');
    }
}


async function updateProblemDisplay(machineCode, date, problems) {
    const row = document.querySelector(`#barChartTable tr[data-machine="${machineCode}"][data-date="${date}"]`);
    if (row) {
        const problemDetailsCell = row.querySelector('.problem-details');
        const downtimeCell = row.querySelector('td:nth-child(8)');
        
        let totalDowntime = 0;
        let problemsHTML = '';

        if (Array.isArray(problems) && problems.length > 0) {
            problemsHTML = problems.map(p => {
                const downtime = parseInt(p.downtime) || 0;
                totalDowntime += downtime;
                return `<div data-breakdownid="${p.breakdownId || ''}" data-id="${p.id || ''}">${p.description} (${downtime} นาที)${p.notes ? ` - ${p.notes}` : ''}</div>`;
            }).join('');
        } else {
            problemsHTML = '<div></div>';
        }
        
        problemDetailsCell.innerHTML = problemsHTML;
        problemDetailsCell.setAttribute('data-total-downtime', totalDowntime);
        downtimeCell.textContent = totalDowntime;
    }
}

function updateTotalDowntime(docNo) {
    const row = document.querySelector(`#barChartTable tr[data-docno="${docNo}"]`);
    if (row) {
        const problemDetailsCell = row.querySelector('.problem-details');
        const totalDowntime = parseInt(problemDetailsCell.getAttribute('data-total-downtime')) || 0;
        const downtimeCell = row.querySelector('td:nth-child(8)');
        if (downtimeCell) {
            downtimeCell.textContent = totalDowntime;
        }
    }
}


async function fetchCauseData(date) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/bar1/v2/getCauseData?date=${formatDate(date)}`); // เปลี่ยนเป็น v2
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching cause data:', error);
        return [];
    }
}


async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const dateElement = document.getElementById('selectedDate');
    if (!dateElement) {
        alert('วันที่ไม่ถูกต้อง');
        return;
    }
    const selectedDate = dateElement.value;

    const worksheet = workbook.addWorksheet('แผนก Combine (BAR1) Report');

    // Define Excel columns
    worksheet.columns = [
        { header: 'MachineCode', key: 'machineCode', width: 13 },
        { header: 'Actual', key: 'actual', width: 8, style: { numFmt: '#,##0.00' } },
        { header: 'Plan', key: 'plan', width: 8, style: { numFmt: '#,##0' } },
        { header: '%POP', key: 'pop', width: 8, style: { numFmt: '0.0%'} },
        { header: 'MFGNo', key: 'mfgNo', width: 11 },
        { header: 'Remark', key: 'remark', width: 10 },
        { header: 'ปัญหาที่เกิด', key: 'problems', width: 60 },
        { header: 'เวลาสูญเสียรวม', key: 'totalDowntime', width: 15 , style: { numFmt: '#,##0' } },
        { header: 'Order', key: 'orderWeight', width: 5 },
        { header: 'ยาว', key: 'itemLen', width: 6 },
        { header: 'SizeIn', key: 'sizeIn', width: 5 },
        { header: 'SizeOut', key: 'sizeOut', width: 5},
        { header: 'Grade', key: 'partName', width: 5 },
        { header: 'ลูกค้า', key: 'custName', width: 15 },
        { header: 'หมายเหตุ', key: 'notes', width: 60 }
    ];

    function formatText(text, isNotes = false) {
        if (isNotes) {
            const items = text.split(';').map(item => item.trim()).filter(item => item !== '');
            return items.map((item, index) => `${index + 1}. ${item}`).join('\n\n');
        } else {
            return text.split('\n').map(line => line.trim()).filter(line => line !== '').join('\n');
        }
    }

    // Apply header style
    worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008000' } };
        cell.border = {
            top: { style: 'medium' },
            left: { style: 'medium' },
            bottom: { style: 'medium' },
            right: { style: 'medium' }
        };
    });

    const rows = document.querySelectorAll('#barChartTable tbody tr:not(.machine-separator)');

    function calculateCellHeight(text, columnWidth, isNotes = false) {
        if (!text) return 15;
        const characterWidth = 7;
        const rowHeight = 15;
        const charactersPerLine = Math.floor((columnWidth * 7) / characterWidth);
        const lines = text.split('\n').reduce((count, line) => {
            return count + Math.max(1, Math.ceil(line.length / charactersPerLine));
        }, 0);
        return Math.max(rowHeight, Math.min(lines * rowHeight, isNotes ? rowHeight * 30 : rowHeight * 20));
    }

    function calculateColumnWidth(text) {
        if (!text) return 10;
        const lines = text.split('\n');
        return Math.min(Math.max(...lines.map(line => line.length)), 50);
    }

    function setPOPCell(worksheet, row, popValue) {
        const popCell = worksheet.getCell(`D${row}`);
        popCell.alignment = { vertical: 'middle', horizontal: 'center' };
        popCell.value = popValue;
        popCell.numFmt = '0.0%';
        popCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: popValue === 0 ? 'FF90EE90' : (popValue >= 0.95 ? 'FF90EE90' : 'FFFF6347') }
        };
    }

    let machineTotalDowntime = {};
    let machineGroupDimensions = {};
    let machineTotals = {};
    let machineNotes = {};

    // First pass: calculate dimensions for each machine group
    rows.forEach((row) => {
        const cells = row.cells;
        const machineCode = cells[0]?.textContent?.trim().split('-')[0] || '';
        const downtime = parseFloat(cells[7]?.textContent) || 0;
        if (!machineTotalDowntime[machineCode]) {
            machineTotalDowntime[machineCode] = 0;
        }
        machineTotalDowntime[machineCode] += downtime;

        const actual = parseFloat(cells[1]?.textContent) || 0;
        const planText = cells[2]?.textContent?.trim() || '';
        const plan = planText === '-' ? 0 : parseFloat(planText) || 0;
        const problemDetailsCell = row.querySelector('.problem-details');
        const problemsText = problemDetailsCell ? formatText(problemDetailsCell.textContent) : '';
        const notesText = problemDetailsCell ? problemDetailsCell.getAttribute('data-notes') || '' : '';
    
        if (!machineGroupDimensions[machineCode]) {
            machineGroupDimensions[machineCode] = {
                maxWidth: 0,
                totalHeight: 0,
                problemsText: '',
                notesHeight: 0
            };
            machineTotals[machineCode] = { actual: 0, plan: 0 };
            machineNotes[machineCode] = [];
        }

        machineTotals[machineCode].actual += actual;
        machineTotals[machineCode].plan += plan;

        machineGroupDimensions[machineCode].maxWidth = Math.max(
            machineGroupDimensions[machineCode].maxWidth,
            calculateColumnWidth(problemsText)
        );
        machineGroupDimensions[machineCode].problemsText += (machineGroupDimensions[machineCode].problemsText ? '\n' : '') + problemsText;
        if (notesText) {
            machineNotes[machineCode].push(notesText);
        }
    });

    // Calculate total height and POP for each machine group
    Object.keys(machineGroupDimensions).forEach(machineCode => {
        const dim = machineGroupDimensions[machineCode];
        dim.totalHeight = calculateCellHeight(dim.problemsText, dim.maxWidth);
        const totals = machineTotals[machineCode];
        dim.pop = totals.plan > 0 ? totals.actual / totals.plan : 0;
    });

    // Second pass: set data and apply dimensions
    let rowIndex = 2;
    let lastMachineCode = null;
    let mergeStartRow = 2;
    let popMergeStartRow = 2;
    let downtimeMergeStartRow = 2;
    let notesStartRow = 2;

    rows.forEach((row, index) => {
        const cells = row.cells;
        if (!cells || cells.length === 0) return;

        const machineCode = cells[0]?.textContent?.trim().split('-')[0] || '';
        const actual = parseFloat(cells[1]?.textContent) || 0;
        const planText = cells[2]?.textContent?.trim() || '';
        const plan = planText === '-' ? 0 : parseFloat(planText) || 0;
        const docNo = cells[3]?.textContent?.trim() || '';
        const custName = cells[4]?.textContent?.trim() || '';
        const remark = cells[5]?.textContent?.trim() || '-';
        const problemDetailsCell = row.querySelector('.problem-details');
        const problemsText = problemDetailsCell ? formatText(problemDetailsCell.textContent) : '';
        const downtime = parseFloat(cells[7]?.textContent) || '';
        const orderWeight = parseFloat(cells[8]?.textContent) || '-';
        const itemLen = parseFloat(cells[9]?.textContent) || '-';
        const sizeIn = parseFloat(cells[10]?.textContent) || '-';
        const sizeOut = parseFloat(cells[11]?.textContent) || '-';
        const grade = cells[12]?.textContent?.trim() || '-';

        if (machineCode !== lastMachineCode) {
            if (lastMachineCode !== null) {
                setPOPCell(worksheet, popMergeStartRow, machineGroupDimensions[lastMachineCode].pop);
                if (popMergeStartRow < rowIndex - 1) {
                    worksheet.mergeCells(`D${popMergeStartRow}:D${rowIndex - 1}`);
                }

                worksheet.mergeCells(`H${downtimeMergeStartRow}:H${rowIndex - 1}`);
                const downtimeCell = worksheet.getCell(`H${downtimeMergeStartRow}`);
                downtimeCell.alignment = { vertical: 'middle', horizontal: 'center' };
                downtimeCell.value = machineTotalDowntime[lastMachineCode];

                worksheet.mergeCells(`G${mergeStartRow}:G${rowIndex - 1}`);
                const problemCell = worksheet.getCell(`G${mergeStartRow}`);
                problemCell.alignment = { 
                    wrapText: true, 
                    vertical: 'top', 
                    horizontal: 'left' 
                };
                problemCell.value = formatText(machineGroupDimensions[lastMachineCode].problemsText);

                worksheet.mergeCells(`O${notesStartRow}:O${rowIndex - 1}`);
                const notesCell = worksheet.getCell(`O${notesStartRow}`);
                notesCell.alignment = { 
                    wrapText: true, 
                    vertical: 'top', 
                    horizontal: 'left' 
                };
                notesCell.value = formatText(machineNotes[lastMachineCode].join('; '), true);

                const separatorRow = worksheet.addRow({});
                separatorRow.height = 3;
                for (let i = 1; i <= worksheet.columns.length; i++) {
                    separatorRow.getCell(i).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF000000' }
                    };
                }
                rowIndex++;

                const notesText = machineNotes[lastMachineCode] && machineNotes[lastMachineCode].length > 0 
                    ? formatText(machineNotes[lastMachineCode].join('; '), true)
                    : '';
                const groupHeight = Math.max(
                    calculateCellHeight(machineGroupDimensions[lastMachineCode].problemsText, worksheet.getColumn('G').width),
                    calculateCellHeight(notesText, worksheet.getColumn('O').width, true)
                );
                const rowCount = rowIndex - mergeStartRow - 1;
                const rowHeight = Math.max(15, Math.ceil(groupHeight / rowCount));
                for (let i = mergeStartRow; i < rowIndex - 1; i++) {
                    worksheet.getRow(i).height = rowHeight;
                }
            }

            mergeStartRow = rowIndex;
            popMergeStartRow = rowIndex;
            downtimeMergeStartRow = rowIndex;
            notesStartRow = rowIndex;
        }

        const excelRow = worksheet.addRow({
            machineCode,
            actual,
            plan,
            pop: machineGroupDimensions[machineCode].pop,
            mfgNo: docNo,
            remark,
            problems: '',
            totalDowntime: '',
            orderWeight,
            itemLen,
            sizeIn,
            sizeOut,
            partName: grade,
            custName,
            notes: ''
        });

        const bgColor = { argb: 'FFFFE9D9' };
        ['A', 'B', 'C'].forEach(col => {
            const cell = worksheet.getCell(`${col}${rowIndex}`);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: bgColor
            };
        });

        rowIndex++;
        lastMachineCode = machineCode;
    });

    // Handle the last machine group
    if (lastMachineCode !== null) {
        setPOPCell(worksheet, popMergeStartRow, machineGroupDimensions[lastMachineCode].pop);
        if (popMergeStartRow < rowIndex - 1) {
            worksheet.mergeCells(`D${popMergeStartRow}:D${rowIndex - 1}`);
        }

        worksheet.mergeCells(`H${downtimeMergeStartRow}:H${rowIndex - 1}`);
        const downtimeCell = worksheet.getCell(`H${downtimeMergeStartRow}`);
        downtimeCell.alignment = { vertical: 'middle', horizontal: 'center' };
        downtimeCell.value = machineTotalDowntime[lastMachineCode];

        worksheet.mergeCells(`G${mergeStartRow}:G${rowIndex - 1}`);
        const problemCell = worksheet.getCell(`G${mergeStartRow}`);
        problemCell.alignment = { 
            wrapText: true, 
            vertical: 'top', 
            horizontal: 'left' 
        };
        problemCell.value = formatText(machineGroupDimensions[lastMachineCode].problemsText);

        worksheet.mergeCells(`O${notesStartRow}:O${rowIndex - 1}`);
        const notesCell = worksheet.getCell(`O${notesStartRow}`);
        notesCell.alignment = { 
            wrapText: true, 
            vertical: 'top', 
            horizontal: 'left' 
        };
        notesCell.value = formatText(machineNotes[lastMachineCode].join('\n'), true);

        const notesText = machineNotes[lastMachineCode] && machineNotes[lastMachineCode].length > 0 
            ? formatText(machineNotes[lastMachineCode].join('; '), true)
            : '';
        const groupHeight = Math.max(
            calculateCellHeight(machineGroupDimensions[lastMachineCode].problemsText, worksheet.getColumn('G').width),
            calculateCellHeight(notesText, worksheet.getColumn('O').width, true)
        );
        const rowCount = rowIndex - mergeStartRow;
        const rowHeight = Math.max(15, Math.ceil(groupHeight / rowCount));
        for (let i = mergeStartRow; i < rowIndex; i++) {
            worksheet.getRow(i).height = rowHeight;
        }
    }

    // Set column widths
    worksheet.columns.forEach((column) => {
        if (column.key === 'problems') {
            column.width = Math.max(...Object.values(machineGroupDimensions).map(dim => dim.maxWidth)) + 2;
        } else if (column.key === 'custName') {
            column.width = 15;
        } else if (column.key === 'pop') {
            column.width = 8; // กำหนดความกว้างคงที่สำหรับคอลัมน์ %POP
        } else if (column.key === 'notes') {
            column.width = 60; // กำหนดความกว้างคงที่สำหรับคอลัมน์ Notes
        } else if (column.key === 'partName') {
            column.width = 8; // กำหนดความกว้า��คงที่สำหรับคอลัมน์ Part Name
        } else {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 1;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(maxLength + 2, 30);
        }
    });

    try {
        // Create Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);

        // Create link and trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = `Combine_report_${selectedDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error in exportToExcel:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + error.message);
    }
}