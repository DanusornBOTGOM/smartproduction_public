document.addEventListener('DOMContentLoaded', async (req, res) => {
    try {
        await loadInitialData(); // โหลดข้อมูลจาก API
        initDateFilter();
    } catch (error) {
        console.error('Error initializing:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
})

async function loadInitialData() {
    try {
        // ตั้งค่าวันที่ปัจจุบันเป็นวันที่เริ่มต้น
        const dateInput = document.getElementById('filterDate');
        if (dateInput) {
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            dateInput.value = formattedDate;

            // เรียก API พร้อมส่งพารามิเตอร์วันที่
            await fetchDataByDate(formattedDate);
        }

        // const response = await fetch('/api/production/reports/coa-records');
        // if (!response.ok) throw new Error('Failed to fetch data');

        // const data = await response.json();

        // // นำข้อมูลมาแสดงผลที่เว็บ
        // renderTable(data);
        // // คำนวนน้ำหนักรวม
        // const totalWeight = data.reduce((sum, record) => sum + (record.PrintWeight || 0), 0);
        // updateTotalWeightDisplay(totalWeight);
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

async function fetchDataByDate(date) {
    try {
        // ถ้ามีวันที่ให้ส่งพารามิเตอร์ไปด้วย
        const url = date ? `/api/production/reports/coa-records?date=${date}` : '/api/production/reports/coa-records';
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();
        // นำข้อมูลมาแสดงผล
        renderTable(data);

        // คำนวนน้ำหนักรวม
        const totalWeight = data.reduce((sum, record) => sum + (record.PrintWeight || 0), 0);
        
        // อัปเดตการแสดงผลน้ำหนักรวมและจำนวนรายการ
        const element = document.getElementById('totalWeight');
        if (element) {
            element.textContent = `ผลิตได้ : ${data.length} รายการ (${formatNumber(totalWeight)} kg)`;
        }
        
        // แสดงข้อความถ้าไม่มีข้อมูล
        if (data.length === 0) {
            showNoDataMessage();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

function initDateFilter() {
    const dateInput = document.getElementById('filterDate');
    if (!dateInput) {
        console.error('Date filter input not found');
        return;
    }

    // ตั้งวันที่ปัจจุบัน
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
    
    dateInput.addEventListener('change', filterTableByDate);
    // ไม่ต้องเรียก filterTableByDate() ที่นี่
}

function filterTableByDate() {
    const dateInput = document.getElementById('filterDate');
    
    if (!dateInput) {
        console.error('Date filter input not found');
        return;
    }

    const selectedDate = dateInput.value;
    fetchDataByDate(selectedDate);
}

function updateTotalWeightDisplay(weight) {
    const element = document.getElementById('totalWeight');
    if (element) {
        element.textContent = formatNumber(weight);
    }
}

function showNoDataMessage() {
    const tbody = document.querySelector('#dailyRecordsTable tbody');
    const message = document.createElement('tr');
    message.classList.add('no-data-message');
    message.innerHTML = `
        <td colspan="18" class="text-center">
            ไม่พบข้อมูลในวันที่เลือก
        </td>
    `;
    tbody.appendChild(message);
}

// cal เวลาต้ม
function calculateBoilingTime(TimeInManual, TimeOutManual) {
    if (!TimeInManual || !TimeOutManual) return 0;

    const startTime = new Date(TimeInManual);
    const endTime = new Date(TimeOutManual);
    const diffMinutes = Math.round((endTime - startTime) / (1000 * 60));

    return diffMinutes > 0 ? diffMinutes : 0;
}

// cal เวลาอบ
function calculateBakingTime(TimeInForm, TimeOutForm) {
    if (!TimeInForm || !TimeOutForm) return 0;

    const startTime = new Date(TimeInForm);
    const endTime = new Date(TimeOutForm);
    const diffMinutes = Math.round((endTime - startTime) / (1000 * 60));

    return diffMinutes > 0 ? diffMinutes : 0;
}

// Modal Edit
function showEditTimeModal(id, docNo, timeInManual, timeOutManual, timeInForm, timeOutForm, coilNo) {
    if (!id) {
        alert('ไม่สามารถแก้ไขได้ เนื่องจากไม่พบ ID');
        return;
    }

    const modal = document.createElement('div');

    modal.id = 'editTimeModal';
    modal.className = 'modal';
    modal.style.display = 'block';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">แก้ไขเวลา - ${docNo} (${coilNo || '-'})</h5>
                <button type="button" class="close" onclick="closeEditTimeModal()">&times;</button>
            </div>

            <div class='modal-body'>
                <input type="hidden" id="editRecordId" value="${id}">

                <h6>เวลาต้ม</h6>
                <div class="form-group">
                    <label>เวลาเข้า: (${formatDateTime(timeInManual)})</label>
                    <input type="datetime-local" id="editTimeIn" class="form-control" value="${formatDateTimeForInput(timeInManual)}">
                </div>

                <div class="form-group">
                    <label>เวลาออก: (${formatDateTime(timeOutManual)})</label>
                    <input type="datetime-local" id="editTimeOut" class="form-control" value="${formatDateTimeForInput(timeOutManual)}">
                </div>

                <h6>เวลาอบ</h6>
                <div class="form-group">
                    <label>เวลาเข้า: (${formatDateTime(timeInForm)})</label>
                    <input type="datetime-local" id="editTimeInForm" class="form-control" value="${formatDateTimeForInput(timeInForm)}">
                </div>

                <div class="form-group">
                    <label>เวลาออก: (${formatDateTime(timeOutForm)})</label>
                    <input type="datetime-local" id="editTimeOutForm" class="form-control" value="${formatDateTimeForInput(timeOutForm)}">
                </div>

                <button onclick="validateAndSaveTimeEdit()" class="btn btn-success">บันทึก</button>
                <button onclick="closeEditTimeModal()" class="btn btn-danger">ยกเลิก</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ตรวจสอบข้อมูลแก้ไขเวลา
function validateAndSaveTimeEdit() {
    const timeInStr = document.getElementById('editTimeIn').value;
    const timeOutStr = document.getElementById('editTimeOut').value;
    const timeInFormStr = document.getElementById('editTimeInForm').value;
    const timeOutFormStr = document.getElementById('editTimeOutForm').value;

    // boiling time
    if (!timeInStr || !timeOutStr) {
        alert('กรุณาบอกเวลาเข้าและเวลาออกให้ครบถ้วน');
        return;
    }

    const timeIn = new Date(timeInStr);
    const timeOut = new Date(timeOutStr);

    if (isNaN(timeIn.getTime()) || isNaN(timeOut.getTime())) {
        alert('รูปแบบเวลาไม่ถูกต้อง');
        return;
    }

    if (timeOut <= timeIn) {
        alert('เวลาออกต้องมากกว่าเวลาเข้า');
        return;
    }

    // คำนวณเวลาที่ใช้ในการต้ม (นาที)
    const boilDiffMinutes = Math.round((timeOut - timeIn) / (1000 * 60));

    if (boilDiffMinutes > 1440) {
        if (!confirm('เวลาที่ใช้ในการต้มมากกว่า 24 ชั่วโมง คุณต้องการบันทึกหรือไม่?')) {
            return;
        }
    }

    // ถ้ามีเวลาเข้าอบ ต้องมีเวลาออกอบ
    if (timeInFormStr && !timeOutFormStr) {
        alert('คุณได้ระบุเวลาเข้าเตาอบแล้ว กรุณาระบุเวลาออกจากเตาอบด้วย');
        return;
    }

    // ตรวจสอบเวลาอบ - ถ้ามีเวลาออกอบ ต้องมีเวลาเข้าอบด้วย
    if (!timeInFormStr && timeOutFormStr) {
        alert('คุณได้ระบุเวลาออกจากเตาอบแล้ว กรุณาระบุเวลาเข้าเตาอบด้วย');
        return;
    }    

    // Validate baking times only if both are provided
    if (timeInFormStr && timeOutFormStr) {
        const timeInForm = new Date(timeInFormStr);
        const timeOutForm = new Date(timeOutFormStr);

        if (isNaN(timeInForm.getTime()) || isNaN(timeOutForm.getTime())) {
            alert('รูปแบบเวลาอบไม่ถูกต้อง');
            return;
        }

        if (timeOutForm <= timeInForm) {
            alert('เวลาออกต้องมากกว่าเวลาเข้าสำหรับการอบ');
            return;
        }

        const bakeDiffMinutes = Math.round((timeOutForm - timeInForm) / (1000 * 60));

        if (bakeDiffMinutes > 1440) {
            if (!confirm('เวลาที่ใช้ในการอบมากกว่า 24 ชั่วโมง ต้องการบันทึกหรือไม่')) {
                return;
            }
        }
    }

    // ถ้าเงื่อนไขผ่านทั้งหมด ให้บันทึกข้อมูล
    saveTimeEdit();
}

function closeEditTimeModal() {
    const modal = document.getElementById('editTimeModal');

    if (modal) {
        modal.remove()
    }
}

async function saveTimeEdit() {
    const id = document.getElementById('editRecordId').value;
    let timeInManual = document.getElementById('editTimeIn').value;
    let timeOutManual = document.getElementById('editTimeOut').value;
    let timeInForm = document.getElementById('editTimeInForm').value;
    let timeOutForm = document.getElementById('editTimeOutForm').value;

    try {
        if (!id || id === 'undefined' || id === 'null') {
            alert('ไม่พบข้อมูล ID ที่ต้องการแก้ไข');
            return;
        }

        // แปลงเวลาจากฟอร์มให้เป็นรูปแบบเดียวกับที่เก็บในฐานข้อมูล
        const timeInDate = new Date(timeInManual);
        const timeOutDate = new Date(timeOutManual);
        
        // เพิ่ม 7 ชั่วโมงเพื่อแปลงเป็น UTC+7
        timeInDate.setHours(timeInDate.getHours() + 7);
        timeOutDate.setHours(timeOutDate.getHours() + 7);
        
        // แปลงเป็น ISO string
        timeInManual = timeInDate.toISOString();
        timeOutManual = timeOutDate.toISOString();
        
        // สำหรับเวลาอบ ตรวจสอบว่ามีการกรอกหรือไม่
        let timeInFormISO = null;
        let timeOutFormISO = null;
        
        if (timeInForm && timeOutForm) {
            const timeInFormDate = new Date(timeInForm);
            const timeOutFormDate = new Date(timeOutForm);
            
            timeInFormDate.setHours(timeInFormDate.getHours() + 7);
            timeOutFormDate.setHours(timeOutFormDate.getHours() + 7);
            
            timeInFormISO = timeInFormDate.toISOString();
            timeOutFormISO = timeOutFormDate.toISOString();
        }

        // แสดง loading
        const saveButton = document.querySelector('#editTimeModal .btn-success');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'กำลังบันทึก...';
        saveButton.disabled = true;

        const response = await fetch('/api/production/reports/update-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id,
                timeInManual,
                timeOutManual,
                timeInForm: timeInFormISO,
                timeOutForm: timeOutFormISO
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update time');
        }

        const result = await response.json();        

        if (result.success) {
            // อัปเดตแถวในตารางโดยตรง
            updateTableRow(id, timeInManual, timeOutManual, timeInFormISO, timeOutFormISO);

            alert('บันทึกการแก้ไขสำเร็จ');
            closeEditTimeModal();
        } else {
            throw new Error(result.message || 'Failed to update time');
        }
    } catch (error) {
        console.error('Error saving time:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล:' + error.message);

        // คืนค่าปุ่มบันทึก
        const saveButton = document.querySelector('#editTimeModal .btn-success');
        if (saveButton) {
            saveButton.textContent = 'บันทึก';
            saveButton.disabled = false;
        }
    }
}

// อัพเดทแถวในตารางโดยตรง
function updateTableRow(id, timeInManual, timeOutManual, timeInForm, timeOutForm) {
    // หาแถวที่ตรงกับ ID
    const rows = document.querySelectorAll('#dailyRecordsTable tbody tr');
    let foundRow = null;

    for (const row of rows) {
        const rowId = row.getAttribute('data-id');
        
        // ตรวจสอบว่าเป็นแถวที่ต้องการ
        if (rowId === id) {
            foundRow = row;
            break;
        }
    }

    if (foundRow) {
        // อัปเดตข้อมูลในแถว
        const timeInCell = foundRow.cells[9];  // ตำแหน่งของเซลล์เวลาเข้า
        const timeOutCell = foundRow.cells[10]; // ตำแหน่งของเซลล์เวลาออก
        const boilingTimeCell = foundRow.cells[8]; // ตำแหน่งของเซลล์เวลาต้ม

        const timeInFormCell = foundRow.cells[13];  // ตำแหน่งของเซลล์เวลาเข้าอบ
        const timeOutFormCell = foundRow.cells[14]; // ตำแหน่งของเซลล์เวลาออกอบ
        const bakingTimeCell = foundRow.cells[12];  // ตำแหน่งของเซลล์เวลาอบ
        
        // คำนวณเวลาต้มใหม่
        const boilingTime = calculateBoilingTime(timeInManual, timeOutManual);
        
        // อัปเดตข้อมูลในเซลล์
        timeInCell.textContent = formatDateTime(timeInManual);
        timeOutCell.textContent = formatDateTime(timeOutManual);
        boilingTimeCell.textContent = boilingTime;

        // อัปเดตแอตทริบิวต์ data-time
        timeInCell.setAttribute('data-time', timeInManual || '');
        timeOutCell.setAttribute('data-time', timeOutManual || '');

        // อัปเดตข้อมูลเวลาอบ กรณีเป็น null
        if (!timeInForm) {
            timeInFormCell.textContent = '-';
            timeInFormCell.setAttribute('data-time', '');
            bakingTimeCell.textContent = '0';
        } else {
            timeInFormCell.textContent = formatDateTime(timeInForm);
            timeInFormCell.setAttribute('data-time', timeInForm);
        }

        if (!timeOutForm) {
            timeOutFormCell.textContent = '-';
            timeOutFormCell.setAttribute('data-time', '');
            bakingTimeCell.textContent = '0';
        } else {
            timeOutFormCell.textContent = formatDateTime(timeOutForm);
            timeOutFormCell.setAttribute('data-time', timeOutForm);

            // คำนวนเวลาอบเฉพาะเมื่อมีข้อมูลครบ
            if (timeInForm) {
                const bakingTime = calculateBakingTime(timeInForm, timeOutForm);
                bakingTimeCell.textContent = bakingTime;
            }
        }
        
        // ไฮไลท์แถวที่มีการแก้ไข
        foundRow.classList.add('highlight-row');
        setTimeout(() => {
            foundRow.classList.remove('highlight-row');
        }, 3000);
    } else {
        // ถ้าไม่พบแถว ให้โหลดข้อมูลใหม่ทั้งหมด
        const dateInput = document.getElementById('filterDate');
        const currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        fetchDataByDate(currentDate);
    }
}

function renderTable(data) {
    const tbody = document.querySelector('#dailyRecordsTable tbody');

    if (!tbody) {
        console.error('Table body not found');
        return;
    }
    tbody.innerHTML = '';

    // ดูค่า keys ทั้งหมดของข้อมูลแรก
    if (data.length > 0) {
        console.log("Available keys in data:", Object.keys(data[0]));
        console.log("Sample record:", data[0]);
    }

    data.forEach((record, index) => {
        // เฉพาะ 6 ตัวแรก
        const heatNo = record.RSNCode ? record.RSNCode.split('-')[0] : '-';

        // ใช้ ID แทน id หรือใช้ DocNo เป็น key (ถ้าไม่มี ID)
        const recordId = record.ID || record.Id || record._id || record.DocNo; 
        
        console.log(`Record ${index}:`, { 
            foundId: recordId, 
            id: record.id, 
            ID: record.ID, 
            DocNo: record.DocNo 
        });

        const materialType = record.MaterialType === 0 ? 'วัตถุดิบ' : 
                            (record.MaterialType === 1 ? 'ลวดรีล' : record.MaterialType);
        const skinStatus = record.SkinStatus === 0 ? 'ผ่าน' : 
                            (record.SkinStatus === 1 ? 'ไม่ผ่าน' : record.SkinStatus);
        const boilingTime = calculateBoilingTime(record.TimeInManual, record.TimeOutManual);
        const bakingTime = calculateBakingTime(record.TimeInForm, record.TimeOutForm);
        const remark = record.Remark || '-';

        const row = document.createElement('tr');
        row.setAttribute('data-id', recordId);
        row.innerHTML = `
            <td>${record.DocNo || '-'}</td>
            <td>${record.CurrentStep || '-'}</td>
            <td>${record.Grade || '-'}</td>
            <td>${record.Size || '-'}</td>
            <td>${heatNo}</td>
            <td>${materialType}</td>
            <td>${record.CoilNo || '-'}</td>
            <td>${record.MachineCode || '-'}</td>
            <td>${boilingTime}</td>
            <td data-time="${record.TimeInManual || ''}">${formatDateTime(record.TimeInManual)}</td>
            <td data-time="${record.TimeOutManual || ''}">${formatDateTime(record.TimeOutManual)}</td>
            <td>${record.OvenNumber || '-'}</td>
            <td>${bakingTime}</td>
            <td data-time="${record.TimeInForm || ''}">${formatDateTime(record.TimeInForm)}</td>
            <td data-time="${record.TimeOutForm || ''}">${formatDateTime(record.TimeOutForm)}</td>
            <td>${formatNumber(record.PrintWeight) || '0'}</td>
            <td>${skinStatus}</td>
            <td>${remark}</td>
            <td>
                <button onclick="showEditTimeModal('${recordId}', '${record.DocNo}', '${record.TimeInManual || ''}', '${record.TimeOutManual || ''}', '${record.TimeInForm || ''}', '${record.TimeOutForm || ''}', '${record.CoilNo || ''}')" class="btn btn-primary btn-sm">
                    <i class="fas fa-edit"></i> แก้ไขเวลา
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    addClickHandlersToTimeCells();
}

// หลังจาก renderTable ถูกเรียก
function addClickHandlersToTimeCells() {
    const rows = document.querySelectorAll('#dailyRecordsTable tbody tr');

    rows.forEach(row => {
        const recordId = row.getAttribute('data-id');
        const docNo = row.cells[0].textContent;
        const coilNo = row.cells[6].textContent;

        // แก้ไขบ่อต้มเวลาเข้า
        row.cells[9].addEventListener('click', function() {
            showEditTimeModal(
                recordId, 
                docNo, 
                row.cells[9].getAttribute('data-time'), 
                row.cells[10].getAttribute('data-time'), 
                row.cells[13].getAttribute('data-time'),
                row.cells[14].getAttribute('data-time'),
                coilNo
            );
        });

        // เวลาออก
        row.cells[10].addEventListener('click', function() {
            showEditTimeModal(
                recordId, 
                docNo, 
                row.cells[9].getAttribute('data-time'), 
                row.cells[10].getAttribute('data-time'),
                row.cells[13].getAttribute('data-time'),
                row.cells[14].getAttribute('data-time'),
                coilNo
            );
        });

        // แก้ไขเวลาอบเข้า
        row.cells[13].addEventListener('click', function() {
            showEditTimeModal(
                recordId, 
                docNo, 
                row.cells[9].getAttribute('data-time'), 
                row.cells[10].getAttribute('data-time'), 
                row.cells[13].getAttribute('data-time'), 
                row.cells[14].getAttribute('data-time'), 
                coilNo
            );
        })

        // แก้ไขเวลาอบออก
        row.cells[14].addEventListener('click', function() {
            showEditTimeModal(
                recordId, 
                docNo, 
                row.cells[9].getAttribute('data-time'), 
                row.cells[10].getAttribute('data-time'), 
                row.cells[13].getAttribute('data-time'), 
                row.cells[14].getAttribute('data-time'), 
                coilNo
            );
        });        

        // cursor pointer ให้รู้ว่าคลิกได้
        row.cells[9].style.cursor = 'pointer';
        row.cells[10].style.cursor = 'pointer';
        row.cells[13].style.cursor = 'pointer';
        row.cells[14].style.cursor = 'pointer';
    });
}

// แปลงรูปแบบเวลา
function formatDateTimeForInput(dateStr) {
    if (!dateStr) return '';

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // เพิ่ม 7 ชั่วโมงเพื่อแปลงจาก UTC เป็นเวลาไทย
        date.setHours(date.getHours() - 7);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error('Error formatting date for input:', error, 'for value:', dateStr);
        return '';
    }
}

function formatDateTimeForOutPut(dateStr) {
    if (!dateStr) return 0;

    const date = new Date(dateStr);

    return date.toISOString().slice(0, 16);
}

// Utility
function formatDateTime(dateStr) {
    if (!dateStr) return '-';

    try {
        const date = new Date(dateStr);

        // ตรวจสอบว่า date เป็นค่าที่ถูกต้องหรือไม่
        if (isNaN(date.getTime())) {
            return '-';
        }

        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        }).format(date).replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2').replace(/,/g, '');
    } catch (error) {
        console.error('Error formatting date:', error, 'for value:', dateStr);
        return '-';
    }
}

function formatNumber(num) {
    if (!num) return '0.00';
    return parseFloat(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// Export Excel
document.getElementById('exportExcel')?.addEventListener('click', async () => {
    try {
        const rows = Array.from(document.querySelectorAll('#dailyRecordsTable tbody tr'))
            .filter(row => row.style.display !== 'none');
            
        // if (rows.length === 0) {
        //     showToast('warning', 'ไม่มีข้อมูลที่จะ export');
        //     return;
        // }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Coating Daily Report');

        worksheet.columns = [
            { header: 'MFG No.', key: 'docNo', width: 10},
            { header: 'Step', key: 'currentStep', with: 5},
            { header: 'Grade', key: 'grade', width: 15 },
            { header: 'Size', key: 'size', width: 5 },
            { header: 'Heat No.', key: 'heatNo', width: 10},
            { header: 'ประเภท', key: 'materialType', width: 10},
            { header: 'CoilNo', key: 'coilNo', width: 10},
            { header: 'Machine', key: 'machine', width: 10},
            { header: 'เวลาต้ม', key: 'boilingTime', width: 10},
            { header: 'เวลาเข้า', key: 'timeIn', width: 15},
            { header: 'เวลาออก', key: 'timeOut', width: 15},
            { header: 'ตู้อบที่', key: 'ovenNo', width: 10},
            { header: 'เวลาอบ', key: 'bakingTime', width: 10},
            { header: 'เวลาเข้าอบ', key: 'timeInOven', width: 15},
            { header: 'เวลาออกอบ', key: 'timeOutOven', width: 15},
            { header: 'Weight', key: 'weight', width: 10, style: { numFmt: '#,#0.0' } },
            { header: 'สภาพผิว', key: 'skinStatus', width: 10 },
            { header: 'หมายเหตุ', key: 'remark', width: 10 }
        ];

        // Add data
        rows.forEach(row => {
            worksheet.addRow({
                docNo: row.cells[0].textContent,
                currentStep: row.cells[1].textContent,
                grade: row.cells[2].textContent,
                size: row.cells[3].textContent,
                heatNo: row.cells[4].textContent,
                materialType: row.cells[5].textContent,
                coilNo: row.cells[6].textContent,
                machine: row.cells[7].textContent,
                boilingTime: row.cells[8].textContent,
                timeIn: row.cells[9].textContent,
                timeOut: row.cells[10].textContent,
                ovenNo: row.cells[11].textContent,
                bakingTime: row.cells[12].textContent,
                timeInOven: row.cells[13].textContent,
                timeOutOven: row.cells[14].textContent,
                weight: parseFloat(row.cells[15].textContent.replace(/,/g, '')),
                skinStatus: row.cells[16].textContent,
                remark: row.cells[17].textContent
            });
        });

        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008000' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: {
                top: { style: 'medium' },
                left: { style: 'medium' },
                bottom: { style: 'medium' },
                right: { style: 'medium' }
            }
        };

        // border แถวข้อมูล
        rows.forEach((_, index) => {
            // index + 2 เพราะ row แรกคือ header
            const row = worksheet.getRow(index + 2);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Style headers
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });
        // worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // สรุปท้ายตาราง
        worksheet.addRow([]);
        worksheet.addRow(['']);

        const totalWeightElement = document.getElementById('totalWeight');
        const totalWeight = totalWeightElement ?
            parseFloat(totalWeightElement.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;

        // สรุปผลิต
        worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'น้ำหนักออกรวม(kg.)', 
            totalWeight.toFixed(1)])

        // สีครอบคลุม 3 เซลล์
        for(let i = 16; i <= 16; i++) {
            worksheet.getRow(worksheet.rowCount).getCell(i).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F81BD' }
            };
            worksheet.getRow(worksheet.rowCount).getCell(i).font = {
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
        }

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const selectedDate = document.getElementById('filterDate').value;
        link.download = `Coating_Records_${selectedDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        // showToast('error', 'เกิดข้อผิดพลาดในการ export ไฟล์');
    }
});