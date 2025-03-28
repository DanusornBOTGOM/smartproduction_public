let selectedDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
let allData = [];
const SECTION = '';
let isInitialLoad = true;
let rawData = [];

function formatDate(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', date);
        return '';
    }
    const bangkokTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
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
        const url = new URL(
            "http://192.168.1.214:5000/api/combinedDashboardProfile"
        );
        url.searchParams.append("date", formatDate(selectedDate));
        url.searchParams.append("machineCodePrefix", "PRO");

        console.log("Fetching data with URL:", url.toString());

        // Fix: Remove Promise.all since we're only fetching one URL
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw data from API:", data);

        // ดึงข้อมูล Cause
        const causeData = await fetchCauseDataMswAll(selectedDate);
        console.log('Cause data:', causeData);

        if (Array.isArray(data)) {
            allData = data.filter(item => 
                (item.MachineCode.startsWith('PRO'))
            ).map(item => {
                const baseMachineCode = item.MachineCode.split('-')[0];
                const causes = causeData[baseMachineCode] || [];
                return { 
                    ...item,
                    MachineCode: baseMachineCode,
                    Actual: parseFloat(item.Actual),
                    Plan: parseFloat(item.Plan) || 0,
                    Causes: Array.isArray(causes) ? causes.map(c => ({ 
                        description: c.description, 
                        downtime: c.downtime,
                        notes: c.notes,
                        breakdownId: c.breakdownId,
                        id: c.id
                    })) : [],
                    TotalDowntime: Array.isArray(causes) ? causes.reduce((sum, c) => sum + (parseFloat(c.downtime) || 0), 0) : 0
                };
            });
            console.log('Mapped allData:', allData);
    
            if (allData.length === 0) {
                console.log('No data received for the selected date');
                clearTable();
                document.querySelector('#barChartTable tbody').innerHTML = '<tr><td colspan="15">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
            } else {
                const groupedData = groupDataByMachineAndDoc(allData);
                populateBarChartTable(groupedData, selectedDate);
                adjustHeaderWidth();
            }
        } else {
            console.log('No data received for the selected date');
            clearTable();
            document.querySelector('#barChartTable tbody').innerHTML = '<tr><td colspan="15">ไม่พบข้อมูลสำหรับวันที่เลือก</td></tr>';
        }

        if (isInitialLoad) {
            const dateElement = document.getElementById('selectedDate');
            if (dateElement) {
                selectedDate = dateElement.value;
            }
            isInitialLoad = false;
        }

    } catch (error) {
        console.error('Error in fetchData:', error);
        document.querySelector('#barChartTable tbody').innerHTML = `<tr><td colspan="15">เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}</td></tr>`;
    }
}

async function initPage() {
    await fetchData();
}

// เรียกใช้ initPage เมื่อหน้าเว็บโหลด
window.addEventListener("load", initPage);

function parseCauseString(causeString) {
    if (!causeString) return [];

    return causeString.split('; ').map((problem) => {
        const match = problem.match(/(.*) \((\d+) นาที\)/);
        if (match) {
            return {
                description: match[1].trim(),
                downtime: parseInt(match[2]),
            };
        }
        return { description: problem, downtime: 0 };
    });
}

function groupDataByMachineAndDoc(data) {
    console.log("Raw data received:", data);
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
                    SizeIn : item.SizeIn || '',
                    SizeOut: item.SizeOut || '',
                    PartName: item.PartName || '',
                };
            }
            groupedData[key].Actual += parseFloat(item.Actual) || 0;

            // อัพเดทข้อมูลอื่นๆ ทุกครั้งที่พบข้อมูลใหม่
            groupedData[key].CustName = item.CustName || groupedData[key].CustName;
            groupedData[key].OrderWeight = item.OrderWeight || item.ItemWeight || groupedData[key].OrderWeight;
            groupedData[key].ItemLen = item.ItemLen || groupedData[key].ItemLen;
            groupedData[key].SizeIn = item.SizeIn || groupedData[key].SizeIn;
            groupedData[key].SizeOut = item.SizeOut || groupedData[key].SizeOut;
            groupedData[key].PartName = item.PartName || groupedData[key].PartName;

            // Collect problems for each machine 
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

    // ให้คอลัมน์ปัญหาไปอยู่ แถวแรกของ MachineCode นั้นๆ
    Object.values(groupedData).forEach(item => {
        if (problemsByMachine[item.MachineCode]) {
            item.Causes = Array.from(problemsByMachine[item.MachineCode])
                .map(causeString => JSON.parse(causeString));
            item.TotalDowntime = item.Causes.reduce((sum, cause) => sum + (parseInt(cause.downtime) || 0), 0);
            // เคลียร์ปัญหาสำหรับ Machine ที่เป็น duplicates
            problemsByMachine[item.MachineCode] = null;
        }
    });

    console.log('Grouped data:', groupedData);
    return Object.values(groupedData);
}

function populateBarChartTable(groupedData, selectedDate) {
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
        if (item.MachineCode !== lastMachineCode) {
            if (index !== 0) {
                tableBody.innerHTML += `<tr class="machine-separator"><td colspan="15"></td></tr>`;
            }
            isAlternateColor = !isAlternateColor;
        }

        const planValue = item.Plan > 0 ? item.Plan.toFixed(1) : "-";
        const actualValue = typeof item.Actual === 'number' && !isNaN(item.Actual) ? item.Actual.toFixed(1) : "0";

        let causeHTML = '';
        let totalDowntime = 0;

        if (Array.isArray(item.Causes) && item.Causes.length > 0) {
            causeHTML = item.Causes.map(cause => {
                if (cause && cause.description) {
                    const downtime = parseFloat(cause.downtime) || 0;
                    totalDowntime += downtime;
                    return `
                        <div data-breakdownid="${cause.breakdownId || ''}" data-id="${cause.id || ''}" data-notes="${cause.notes || ''}">
                            ${cause.description} (${downtime} นาที)
                        </div>
                    `;
                }
                return '';
            }).join('');
        }

        const notesAttribute = Array.isArray(item.Causes)
            ? item.Causes.map(c => c.notes).filter(Boolean).join('; ')
            : '';

        // สร้าง HTML สำหรับแถว
        const row = `
        <tr class="${isAlternateColor ? "alternate-row" : ''}" data-machine="${item.MachineCode}" data-date="${item.Date || selectedDate}" data-docno="${item.DocNo || ''}" >
            <td>${item.MachineCode}</td>
            <td>${actualValue}</td>
            <td>${planValue}</td>
            <td>${item.DocNo || ''}</td>
            <td title="${item.CustName || ''}">${item.CustName || ''}</td>
            <td>${item.Remark || ''}</td>
            <td class="problem-column">
                <div class="problem-details" data-notes="${notesAttribute}">${causeHTML}</div>
            </td>
            <td>${totalDowntime || '0'}</td>
            <td>${item.OrderWeight || "-"}</td>
            <td>${item.ItemLen || '-'}</td>            
            <td>${item.SizeIn || "-"}</td>
            <td>${item.SizeOut || "-"}</td>
            <td>${item.PartName || "-"}</td>
            <td>
                <button onclick="editProblem('${item.MachineCode}', '${item.Date || selectedDate}', '${item.DocNo || ''}')" class="btn btn-success">บันทึก/แก้ไข</button>
            </td>
            <td>
                <button class="btn btn-primary btn-sm view-details" data-machine="${item.MachineCode}" data-date="${item.Date || selectedDate}">
                    ดูรายละเอียด
                </button>
            </td>
        </tr>
        `;
        tableBody.innerHTML += row;

        lastMachineCode = item.MachineCode;
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

async function editProblem(machineCode, date, docNo) {
    const row = document.querySelector(`#barChartTable tr[data-machine="${machineCode}"][data-date="${date}"]`);

    if (row) {
        const problemDetailsCell = row.querySelector('.problem-column .problem-details');
        let currentProblems = [];

        if (problemDetailsCell) {
            const problemDivs = problemDetailsCell.querySelectorAll('div');
            if (problemDivs.length > 0) {
                currentProblems = Array.from(problemDivs).map((div, index) => {
                    const match = div.textContent.match(/(.*) \((\d+) นาที\)/);
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
            }
        }

        // เรียกดึงข้อมูลรหัสสาเหตุ
        const breakdownCauses = await fetchBreakdownCauses();
        console.log('Fetched breakdown causes:', breakdownCauses);

        let formHTML = `
        <h2>แก้ไขปัญหา</h2>
        <form id="editProblemForm">
            <div class="problem-edit-row header-row">
                <div class="description-input">Cause</div>
                <div class="downtime-input">Downtime</div>
                <div class="notes-input">Notes</div>
                <div style="width: 60px;">Action</div>
            </div>
        `;

        if (currentProblems.length > 0) {
            currentProblems.forEach((problem, index) => {
                formHTML += `
                    <div class="problem-edit-row">
                        <select name="description[]" class="description-input">
                            <option value="">-- เลือกรหัสสาเหตุ --</option>
                            ${breakdownCauses.map(cause => `
                                <option value="${cause.CauseCode}"
                                    ${cause.Description === problem.description ? 'selected' : ''}>
                                    ${cause.CauseCode} - ${cause.Description}
                                </option>
                            `).join('')}
                        </select>
                        <input type="number" name="downtime[]" value="${problem.downtime}" min="0" class="downtime-input">
                        <input type="text" name="notes[]" value="${problem.notes}" placeholder="Notes" class="notes-input">
                        <input type="hidden" name="id[]" value="${problem.id || ''}">
                        <input type="hidden" name="breakdownId[]" value="${problem.breakdownId || ''}">
                        <input type="hidden" name="originalDowntime[]" value="${problem.originalDowntime}">
                        <input type="hidden" name="index[]" value="${index}">
                        <button type="button" onclick="removeProblem(this)" class="btn btn-danger btn-sm">ลบ</button>
                    </div>
                `;
            });
        }

        formHTML += `
            <button type="button" onclick="addNewProblemField()" class="btn btn-secondary">เพิ่มปัญหา</button>
            <button type="submit" class="btn btn-primary">บันทึก</button>
        </form>
        `;     
        
        showEditModal(formHTML);

        document.getElementById('editProblemForm').onsubmit = function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const problems = [];
            const causeCodes = formData.getAll('description[]')
            //const descriptions = formData.getAll('description[]');
            const downtimes = formData.getAll('downtime[]');
            const notes = formData.getAll('notes[]');
            const ids = formData.getAll('id[]');
            const breakdownIds = formData.getAll('breakdownId[]');
            const originalDowntimes = formData.getAll('originalDowntime[]');
            const indices = formData.getAll('index[]');
    
            let hasChanges = false;
            let deletedProblems = []; // เพิ่มตัวแปรสำหรับเก็บปัญหาที่ถูกลบ
    
            // ตรวจสอบปัญหาที่ถูกลบ
            currentProblems.forEach(problem => {
                const stillExists = ids.some(id => id === problem.id);
                if (!stillExists && problem.id) {
                    deletedProblems.push(problem.id);
                    hasChanges = true;
                }
            });
    
            for (let i = 0; i < causeCodes.length; i++) {
                const currentDowntime = parseInt(downtimes[i]);
                const originalDowntime = parseInt(originalDowntimes[i]);
                const currentNotes = notes[i];
                const currentCauseCode = causeCodes[i]
                
                console.log(`Problem ${i}: ID: ${ids[i]}, BreakdownID: ${breakdownIds[i]}, Current downtime: ${currentDowntime}, Original downtime: ${originalDowntime}, Notes: ${currentNotes}`);
    
                if (currentDowntime !== originalDowntime || !ids[i] || currentNotes !== currentProblems[i]?.notes || currentCauseCode !== currentProblems[i]?.causeCode) {

                    // ดึง description จาก causeCode ที่เลือก
                    const selectedCause = breakdownCauses.find(cause => cause.CauseCode === currentCauseCode);
                    const description = selectedCause ? selectedCause.Description : '';


                    problems.push({
                        id: ids[i] || null,
                        breakdownId: breakdownIds[i] || null,
                        causeCode: currentCauseCode,
                        description: description, // เพิ่ม description ที่ได้จาก causeCode
                        downtime: currentDowntime,
                        notes: currentNotes,
                        originalDowntime: originalDowntime,
                        index: parseInt(indices[i])
                    });
                    hasChanges = true;
                }
            }
    
            console.log('Has changes:', hasChanges);
            console.log('Problems to be saved:', problems);
            console.log('Problems to be deleted:', deletedProblems);
    
            if (hasChanges) {
                saveProblem(machineCode, date, docNo, problems, deletedProblems);
            } else {
                alert('ไม่มีการเปลี่ยนแปลงข้อมูล');
                closeEditModal();
            }
        };
    }
}

// ดึงข้อมูลรหัสสาเหตุ
async function fetchBreakdownCauses() {
    try {
        const response = await fetch('/api/breakdown-causes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched breakdown causes:', data);
        return data;
    } catch (error) {
        console.error('Error fetching breakdown causes:', error);
        // ส่งค่า array ว่างกลับเมื่อเกิดข้อผิดพลาด เพื่อไม่ให้เกิด error ในส่วนอื่น
        return [];
    }
}

async function addNewProblemField() {
    const form = document.getElementById("editProblemForm");
    if (!form) return;

    // ดึงข้อมูล BreakdownCauses
    let breakdownCauses;
    try {
        breakdownCauses = await fetchBreakdownCauses();
    } catch (error) {
        console.error('Error fetching breakdown causes:', error);
        breakdownCauses = [];
    }

    const newField = document.createElement("div");
    newField.className = 'problem-edit-row';
    newField.innerHTML = `
        <select name="description[]" class="description-input">
            <option value="">-- เลือกรหัสสาเหตุ --</option>
            ${breakdownCauses.map(cause => `
                <option value="${cause.CauseCode}">
                    ${cause.CauseCode} - ${cause.Description}
                </option>
            `).join('')}
        </select>
        <input type="number" name="downtime[]" value="0" min="0" class="downtime-input">
        <input type="text" name="notes[]" placeholder="Notes" class="notes-input">
        <input type="hidden" name="id[]" value="">
        <input type="hidden" name="breakdownId[]" value="">
        <input type="hidden" name="originalDowntime[]" value="0">
        <input type="hidden" name="index[]" value="${document.querySelectorAll('.problem-edit-row').length - 1}">
        <button type="button" onclick="removeProblem(this)" class="btn btn-danger btn-sm">ลบ</button>
    `;

    // หาตำแหน่งที่จะแทรก element ใหม่
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        // แทรกก่อนปุ่ม Submit
        form.insertBefore(newField, submitButton);
    } else {
        // ถ้าไม่พบปุ่ม Submit ให้เพิ่มต่อท้าย form
        form.appendChild(newField);
    }
}

function removeProblem(button) {
    button.closest('.problem-edit-row').remove();
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
    const rows = document.querySelectorAll("#barChartTable tbody tr");
    const causeData = await fetchCauseData(selectedDate);

    rows.forEach((row) => {
        const machineCode = row.getAttribute("data-machine");
        const docNo = row.getAttribute("data-docno");
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

        const actionCell = row.querySelector("td:nth-child(8)"); // ปรับตามลำดับคอลัมน์จริง
        if (actionCell) {
            actionCell.innerHTML = `<button onclick="editProblem('${machineCode}', '${docNo}')">แก้ไขปัญหา</button>`;
        }
    });

    // ฟังก์ชันปรับความกว้าง header หลังจากอัปเดตข้อมูล
    adjustHeaderWidth();
}

function saveCause() {
    const causeData = [];

    // รวบรวมข้อมูล Cause จากตาราง
    document.querySelectorAll("#barChartTable tbody tr").forEach((row) => {
        const docNo = row.getAttribute("data-docno");
        const causeInput = row.querySelector('input[name="cause"]');
        if (causeInput && causeInput.value) {
            causeData.push({
                date: selectedDate,
                machineCode: row.cells[0].textContent,
                docNo: docNo,
                cause: causeInput.value,
            });
        }
    });

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
        // Calculate time range
        const startDate = new Date(date);
        startDate.setHours(8, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(7, 59, 59, 999);

        // Add one more day to ensure we get all data
        const extendedEndDate = new Date(endDate);
        extendedEndDate.setDate(extendedEndDate.getDate() + 1);

        const response = await fetch(
            `http://192.168.1.214:5000/api/machineDetailsExtended?startDate=${startDate.toISOString()}&endDate=${extendedEndDate.toISOString()}&machineCode=${machineCode}&type=profile` // เพิ่ม type=profile
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        let detailsHTML = `
            <html>
            <head>
                <title>รายละเอียด ${machineCode} (Profile)</title>
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid black; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h2>รายละเอียดของ ${machineCode} (Profile)</h2>
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

                // For Profile, we don't need to check for specific machine code patterns
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

        const detailsWindow = window.open(
            "",
            "Profile Machine Details",
            "width=1200,height=600"
        );
        detailsWindow.document.write(detailsHTML);
        detailsWindow.document.close();
    } catch (error) {
        console.error("Error fetching profile machine details:", error);
        alert(`เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด Profile: ${error.message}`);
    }
}

async function saveRemark(docNo, rsnCode, button) {
    const row = button.closest("tr");
    const remark = row.querySelector('input[data-docno]').value;
    const currentMachineCode = row.querySelector('td[data-machinecode]').getAttribute('data-machinecode');
    const currentSectionID = row.querySelector('td[data-sectionid]').getAttribute('data-sectionid');

    let newMachineCode = currentMachineCode;
    let newSectionID = currentSectionID

    // Check if Remark contains 'PRO'
    const proMatch = remark.match(/PRO\d{3}/);
    if (proMatch) {
        newMachineCode = proMatch[0];
        newSectionID = 'P' + newMachineCode.slice(-2);
    }

    try {
        const response = await fetch('http://192.168.1.214:5000/api/updateRemark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                docNo, 
                outRSNCode, 
                remark, 
                newMachineCode, 
                newSectionID 
            }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        alert('บันทึก Remark และอัปเดตข้อมูลเรียบร้อยแล้ว');
        
        // Update the row in the details table
        row.querySelector('td[data-machinecode]').textContent = newMachineCode;
        row.querySelector('td[data-machinecode]').setAttribute('data-machinecode', newMachineCode);
        row.querySelector('td[data-sectionid]').textContent = newSectionID;
        row.querySelector('td[data-sectionid]').setAttribute('data-sectionid', newSectionID);

        if (window.opener && window.opener.updateMainTableRemark) {
            window.opener.updateMainTableRemark(docNo, remark, newMachineCode, newSectionID);
        }
    } catch (error) {
        alert('เกิดข้อผิดพลาดในการบันทึก Remark: ' + error.message);
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
        const content = cell.querySelector('.problem-content');
        if (content && content.scrollHeight > content.clientHeight) {
            cell.title = content.textContent;
        }
    });
}

let isSaving = false;

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

async function fetchCauseDataMswAll(date) {
    try {
        const response = await fetch(`http://192.168.1.214:5000/api/getCausesMswAll?date=${formatDate(date)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw cause data MswAll:', data);
        
        // จัดกลุ่มข้อมูลตาม MachineCode และ DocNo
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

async function saveProblem(machineCode, date, docNo, problems, deletedProblems) {
    try {
        const response = await fetch('http://192.168.1.214:5000/api/updateCausesMswAll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date,
                machineCode,
                docNo,
                problems: problems.map(p => ({
                    ...p,
                    notes: p.notes || ''
                })),
                deletedProblems: deletedProblems // เพิ่มรายการ ID ของปัญหาที่ถูกลบ
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Server response:', result);

        if (result.success) {
            await updateProblemDisplay(machineCode, date, result.updateProblems);
            closeEditModal();
            alert('บันทึกข้อมูลเรียบร้อยแล้ว');
            await fetchData(); 
        } else {
            throw new Error(result.message || 'Failed to update problems');
        }
    } catch (error) {
        console.error('Error saving problems:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกปัญหา: ' + error.message);
    }
}


function updateProblemDisplay(machineCode, date, problems) {
    console.log('Updating problem display:', { machineCode, date, problems });
    const row = document.querySelector(`#barChartTable tr[data-machine="${machineCode}"][data-date="${date}"]`);

    if (row) {
        const problemDetailsCell = row.querySelector(".problem-details");
        const downtimeCell = row.querySelector("td:nth-child(8)"); // ปรับตามลำดับคอลัมน์จริง

        let totalDowntime = 0;
        let problemsHTML = '';

        if (Array.isArray(problems) && problems.length > 0) {
            problemsHTML = problems.map((p) => {
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
        const response = await fetch(`http://192.168.1.214:5000/api/getCausesMswAll?date=${formatDate(date)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw cause data MswAll:', data);
        return data;
    } catch (error) {
        console.error('Error fetching cause data MswAll:', error);
        return [];
    }
}

// ปุ่มกดแก้ไข ModalPlanRowEdit
async function editPlan() {
    const selectedDate = document.getElementById('selectedDate').value;
    if (!selectedDate) {
        alert('กรุณาเลือกวันที่');
        return;
    }

    // ดึงค่า department จาก data attribute หรือตัวแปรที่กำหนดในแต่ละหน้า
    const department = document.getElementById('editPlanButton').dataset.department;
    await loadPlanData(selectedDate, department);
}

// โหลดข้อมูล Plan ของ ModalPlanRow
async function loadPlanData(date, department) {
    try {
        closeEditModalPlanRow(); // ปิด Modal เก่าก่อนโหลดใหม่
        const response = await fetch(`http://192.168.1.214:5000/api/getPlanData?date=${date}&department=${department}`);

        if (!response.ok) {
            throw new Error('Failed to load plan data');
        }

        const planData = await response.json();
        showPlanEditModal(planData, date, department);
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

// แสดง ModalPlanRowEdit
function showPlanEditModal(planData, date, department) {
    const modal = document.createElement('div');
    modal.id = 'planEditModal';
    modal.className = 'modal';

    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>แก้ไข Plan แผนก ${department} วันที่ ${date}</h2>
                <button type="button" class="close" onclick="closeEditModalPlanRow()">&times;</button>
            </div>

            <div class="modal-body">
                <table class="table" id="planEditTable">
                    <thead>
                        <tr>
                            <th>DocNo</th>
                            <th>MachineCode</th>
                            <th>ProductionQuantity</th>
                            <th>Step</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${planData.map(plan => `
                            <tr data-no="${plan.No}">
                                <td>${plan.DocNo}</td>
                                <td>
                                    <select class="form-control" name="machineCode">
                                        ${getMachineOptionsForDepartment(department, plan.MachineCode)}  
                                    </select>
                                </td>
                                <td>
                                    <input type="number" class="form-control"
                                           name="quantity" value="${plan.ProductionQuantity || 0}">
                                </td>
                                <td>
                                    <input type="number" class="form-control"
                                           name="step" value="${plan.Step || 0}">
                                </td>
                                <td>
                                    <button onclick="updatePlanRow('${plan.No || ''}')" 
                                            class="btn btn-warning btn-sm">อัพเดท</button>
                                    <button onclick="deletePlanRow('${plan.No || ''}')" 
                                            class="btn btn-danger btn-sm">ลบ</button>
                                </td>
                            </tr>
                            
                        `).join('') }
                    </tbody>

                    <button onclick="addNewPlanRow()" class="btn btn-success">
                        <i class="fas fa-plus"></i>เพิ่ม Plan ใหม่
                    </button>
                </table>            
            </div>

        </div>
    `;

    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
}

// Modal สร้าง PlanRow
function createPlanRow(plan) {
    const department = document.getElementById('editplanButton').dataset.department;
    return `
        <tr data-docno="${plan.No}">
            <td>${plan.DocNo}</td>
            <td>
                <select class="form-control machine-code-select" name="machineCode">
                    ${getMachineOptionsForDepartment(department)}            
                </select>
            </td>
            <td>
                <input type="number" class="form-control" name="quantity"
                       value="${plan.ProductionQuantity || 0}">
            </td>
           <td>
                <input type="number" class="form-control" name="step"
                       value="${plan.Step || 0}">
            </td>            
            <td>
                <button onclick="updatePlanRow('${plan.DocNo}')" class="btn btn-warning btn-sm me-2">อัพเดท</button>
                <button onclick="deletePlanRow('${plan.DocNo}')" class="btn btn-danger btn-sm me-2">ลบ</button>
            </td>        
        </tr>
    `;
}

// Modal PlanRow เพิ่มแถวใหม่
function addNewPlanRow() {
    const tbody = document.querySelector('#planEditTable tbody');
    const department = document.getElementById('editPlanButton').dataset.department;
    const newRow = document.createElement('tr');
    newRow.classList.add('new-plan-row');

    // สร้าง options สำหรับ MachineCode ตามแผนก
    const machineOptions = getMachineOptionsForDepartment(department);

    newRow.innerHTML = `
        <td><input type="text" class="form-control" name="newDocNo" required></td>
        <td>
            <select class="form-control machine-code-select" name="newMachineCode" required>
                ${machineOptions}
            </select>
        </td>
        <td><input type="number" class="form-control" name="newQuantity" required></td>
        <td><input type="number" class="form-control" name="newStep" required></td>
        <td>
            <button onclick="saveNewPlan(this)" class="btn btn-success btn-sm">บันทึก</button>
            <button onclick="cancelNewPlan(this)" class="btn btn-danger btn-sm">ยกเลิก</button>            
        </td>
    `;

    // แถวใหม่อยู่บนสุด
    tbody.insertBefore(newRow, tbody.firstChild);
}

function getMachineOptionsForDepartment(department, selectedMachine = '') {
    const machineCodeMap = {
        'PRO': ['PRO003', 'PRO004', 'PRO005', 'PRO006', 'PRO007', 'PRO008', 'PRO011', 'PRO012', 'PRO014', 'PRO015', 'PRO016', 'PRO017', 'PRO018', 'PRO019', 'PRO020']
    };

    const machines = machineCodeMap[department] || [];
    return machines.map(machine => {
        const isSelected = machine === selectedMachine;
        return `
            <option value="${machine}" ${isSelected ? 'selected' : ''}>
                ${machine}
            </option>
        `;
    }).join('');
}

function cancelNewPlan(button) {
    button.closest('tr').remove();
}

async function saveNewPlan(button) {
    const row = button.closest('tr');
    const department = document.getElementById('editPlanButton').dataset.department;
    const data = {
        docNo: row.querySelector('[name="newDocNo"]').value,
        machineCode: row.querySelector('[name="newMachineCode"]').value,
        productionQuantity: parseFloat(row.querySelector('[name="newQuantity"]').value),
        step: parseInt(row.querySelector('[name="newStep"]').value),
        date: document.getElementById('selectedDate').value,
        department: department
    };

    if (!data.docNo || !data.machineCode || !data.productionQuantity) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    try {
        const response = await fetch('http://192.168.1.214:5000/api/addNewPlan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save plan')
        }

        alert('เพิ่มข้อมูลสำเร็จ');
        // รีโหลดข้อมูลใน modal แทนที่จะปิด modal
        const date = document.getElementById('selectedDate').value;
        const department = document.getElementById('editPlanButton').dataset.department;
        // รีโหลดข้อมูลใน modal โดยตรง
        const response2 = await fetch(`http://192.168.1.214:5000/api/getPlanData?date=${date}&department=${department}`);

        if (!response2.ok) {
            throw new Error('Failed to reload data plan');
        }

        const planData = await response2.json();

        // อัพเดท tbody ของตารางหลัก
        const tbody = document.querySelector('#planEditTable tbody');
        tbody.innerHTML = planData.map(plan => `
            <tr data-no="${plan.No}">
                <td>${plan.DocNo}</td>
                <td>
                    <select class="form-control" name="machineCode">
                        ${getMachineOptionsForDepartment(department, plan.MachineCode)}
                    </select>
                </td>
                <td>
                    <input type="number" class="form-control" name="quantity" value="${plan.ProductionQuantity || 0}">
                </td>
                <td>
                    <input type="number" class="form-control" name="step" value="${plan.Step || 0}">
                </td>
                <td>
                    <button onclick="updatePlanRow('${plan.No}')" class="btn btn-warning btn-sm">อัพเดท</button>
                    <button onclick="deletePlanRow('${plan.No}')" class="btn btn-danger btn-sm">ลบ</button>
                </td>
            </tr>
        `).join('');

        // รีโหลดตารางหลัก
        await fetchData();
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการเพิ่มข้อมูล');
    }
}

async function deletePlanRow(planNo) {
    if (confirm('ต้องการลบข้อมูลนี้ใช่หรือไม่')) {
        try {
            const response = await fetch('http://192.168.1.214:5000/api/deletePlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ No: planNo })
            });
            
            if (!response.ok) {
                throw new Error('Failed to deleted plan');
            }

            alert('ลบข้อมูลสำเร็จ');
            const date = document.getElementById('selectedDate').value;
            const department = document.getElementById('editPlanButton').dataset.department
            // รีโหลดข้อมูลใน modal
            const response2 = await fetch(`http://192.168.1.214:5000/api/getPlanData?date=${date}&department=${department}`);
            
            if (!response2.ok) {
                throw new Error('Failed to reload plan data');
            }

            const planData = await response2.json();

            // อัพเดท tbody โดยตรง
            const tbody = document.querySelector('#planEditTable tbody');
            tbody.innerHTML = planData.map(plan => `
                <tr data-no="${plan.No}">
                    <td>${plan.DocNo}</td>
                    <td>
                        <select class="form-control" name="machineCode">
                            ${getMachineOptionsForDepartment(department, plan.MachineCode)}
                        </select>
                    </td>
                    <td>
                        <input type="number" class="form-control" name="quantity" value="${plan.ProductionQuantity || 0}">
                    </td>
                    <td>
                        <input type="number" class="form-control" name="step" value="${plan.Step || 0}">
                    </td>
                    <td>
                        <button onclick="updatePlanRow('${plan.No}')" class="btn btn-warning btn-sm">อัพเดท</button>
                        <button onclick="deletePlanRow('${plan.No}')" class="btn btn-danger btn-sm">ลบ</button>
                    </td>
                </tr>
            `).join('');

            await fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลากในการลบข้อมูล');
        }
    }
}

function closeEditModalPlanRow() {
    const modal = document.getElementById('planEditModal');

    if (modal) {
        modal.remove();
    }
}

async function updatePlanRow(planNo) {  
    
    // หาแถวโดยใช้ data-no attribute
    const row = document.querySelector(`tr[data-no="${planNo}"]`);
    console.log('Found row:', row);

    if (!row) {
        console.error('Row not found for No:', planNo);
        return;
    }

    const machineCodeSelect = row.querySelector('select[name="machineCode"]');
    const quantityInput = row.querySelector('input[name="quantity"]');
    const stepInput = row.querySelector('input[name="step"]');

    if (!machineCodeSelect || !quantityInput || !stepInput) {
        console.error('Required inputs not found');
        return;
    }

    const department = document.getElementById('editPlanButton').dataset.department;
    const data = {
        No: planNo,
        machineCode: row.querySelector('[name="machineCode"]').value,
        productionQuantity: parseFloat(row.querySelector('[name="quantity"]').value),
        step: parseInt(row.querySelector('[name="step"]').value),
        department: department
    };

    try {
        const response = await fetch('http://192.168.1.214:5000/api/updatePlan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to update plan')
        }

        alert('อัพเดทข้อมูลสำเร็จ');
        const date = document.getElementById('selectedDate').value;
        const department = document.getElementById('editPlanButton').dataset.department;
        // รีโหลดข้อมูลใน modal โดยตรง
        const response2 = await fetch(`http://192.168.1.214:5000/api/getPlanData?date=${date}&department=${department}`);
        if (!response2.ok) {
            throw new Error('Failed to reload plan data');
        }

        const planData = await response2.json();

        // อัพเดท tbody ของตารางโดยตรง
        const tbody = document.querySelector('#planEditTable tbody');
        tbody.innerHTML = planData.map(plan => `
            <tr data-no="${plan.No}">
                <td>${plan.DocNo}</td>
                <td>
                    <select class="form-control" name="machineCode">
                        ${getMachineOptionsForDepartment(department, plan.MachineCode)}
                    </select>
                </td>
                <td>
                    <input type="number" class="form-control" name="quantity" value="${plan.ProductionQuantity || 0}">
                </td>
                <td>
                    <input type="number" class="form-control" name="step" value="${plan.Step || 0}">
                </td>
                <td>
                    <button onclick="updatePlanRow('${plan.No}')" class="btn btn-warning btn-sm">อัพเดท</button>
                    <button onclick="deletePlanRow('${plan.No}')" class="btn btn-danger btn-sm">ลบ</button>
                </td>
            </tr>
        `).join('');

        await fetchData(); // รีโหลดตารางหลัก
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลากในการอัพเดทข้อมูล');
    }
}




function removeProblem(button) {
    button.parentElement.remove();
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
    if (exportButton) {
        exportButton.addEventListener('click', exportToExcel);
    } else {
        console.error('Export button not found');
    }
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
        selectedDate = dateElement.value;
        console.log('Filtering for date:', selectedDate);
        fetchData().then(() => {
            adjustProblemDetails();
            adjustHeaderWidth();
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
    await new Promise(resolve => setTimeout(resolve, 300));

    // จัดการ sticky header
    const table = document.getElementById('barChartTable');
    const thead = table.querySelector('thead');
    thead.classList.add('sticky-header');
    
    const dateElement = document.getElementById('selectedDate');
    if (dateElement) {
        if (!selectedDate) {
            const today = new Date();
            selectedDate = formatDate(today);
        }
        dateElement.value = selectedDate;
        console.log('Initial date set:', selectedDate);
        
        await fetchData();
        adjustProblemDetails();
        adjustHeaderWidth();
    } else {
        console.error('selectedDate element not found');
    }

    setupEventListeners();
});



async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const dateElement = document.getElementById('selectedDate');
    if (!dateElement) {
        alert('วันที่ไม่ถูกต้อง');
        return;
    }
    const selectedDate = dateElement.value;

    const worksheet = workbook.addWorksheet('Profile Report');

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
        { header: 'Order', key: 'orderWeight', width: 10 },
        { header: 'ยาว', key: 'itemLen', width: 10 },
        { header: 'SizeIn', key: 'sizeIn', width: 10 },
        { header: 'SizeOut', key: 'sizeOut', width: 10},
        { header: 'Grade', key: 'partName', width: 10 },
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
        const machineCode = cells[0]?.textContent?.trim() || '';
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

    // เรียงลำดับตาม machineCode
    const sortOrder = ['CUT', 'DRA022', 'CO2', 'PAP'];
    const rowsArray = Array.from(rows);
    rowsArray.sort((a, b) => {
        const machineA = a.cells[0].textContent.trim();
        const machineB = b.cells[0].textContent.trim();
        const groupA = sortOrder.find(prefix => machineA.startsWith(prefix)) || machineA;
        const groupB = sortOrder.find(prefix => machineB.startsWith(prefix)) || machineB;
        return sortOrder.indexOf(groupA) - sortOrder.indexOf(groupB) || machineA.localeCompare(machineB);
    });

    rowsArray.forEach((row, index) => {
        const cells = row.cells;
        if (!cells || cells.length === 0) return;

        const machineCode = cells[0]?.textContent?.trim() || '';
        const actual = parseFloat(cells[1]?.textContent) || 0;
        const planText = cells[2]?.textContent?.trim() || '';
        const plan = planText === '-' ? 0 : parseFloat(planText) || 0;
        const docNo = cells[3]?.textContent?.trim() || '';
        const custName = cells[4]?.textContent?.trim() || '';
        const remark = cells[5]?.textContent?.trim() || '-';
        const problemDetailsCell = row.querySelector('.problem-details');
        const problemsText = problemDetailsCell ? formatText(problemDetailsCell.textContent) : '';
        const downtime = parseFloat(cells[7]?.textContent) || '';
        const orderWeight = cells[8]?.textContent?.trim() || '-';
        const itemLen = cells[9]?.textContent?.trim() || '-';
        const sizeIn = cells[10]?.textContent?.trim() || '-';
        const sizeOut = cells[11]?.textContent?.trim() || '-';
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
            column.width = 8;
        } else if (column.key === 'notes') {
            column.width = 60;
        } else if (column.key === 'partName') {
            column.width = 8;
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
        link.download = `Proflie_report_${selectedDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error in exportToExcel:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + error.message);
    }
}