document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadInitialData();
        initMonthFilter();
    } catch (error) {
        console.error('Error initializing:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
});

async function loadInitialData() {
    try {
        // ตั้งค่าเดือนปัจจุบันเป็นเดือนเริ่มต้น
        const monthInput = document.getElementById('filterDate');
        if (monthInput) {
            const today = new Date();
            const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            monthInput.value = currentYearMonth;

            // เรียก API และกรองข้อมูลตามเดือน
            await fetchAndDisplayData(currentYearMonth);
        } else {
            // ถ้าไม่มี month input ให้โหลดข้อมูลทั้งหมด
            await fetchAndDisplayData();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

async function fetchAndDisplayData(yearMonth = null) {
    try {
        // เรียก API ดึงข้อมูล
        const response = await fetch('/api/production/rework/data-records');
        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();

        // กรองข้อมูลตามเดือนที่เลือก (ถ้ามี)
        let filteredData = data;
        if (yearMonth) {
            filteredData = data.filter(record => {
                const recordDate = new Date(record.CreateDate);
                const recordYearMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
                return recordYearMonth === yearMonth;
            });
        }

        // นำข้อมูลมาแสดงผลที่เว็บ
        renderTable(filteredData);
        
        // คำนวณน้ำหนักรวมและจำนวนรายการ
        const totalWeight = filteredData.reduce((sum, record) => sum + (parseFloat(record.WeightIn) || 0), 0);
        const recordCount = filteredData.length;
        
        // แสดงสรุปข้อมูล
        updateSummary(recordCount, totalWeight);
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

function renderTable(data) {
    const tbody = document.querySelector('#reworkTable tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }
    tbody.innerHTML = '';

    if (data.length === 0) {
        // แสดงข้อความถ้าไม่มีข้อมูล
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">ไม่พบข้อมูลในช่วงเวลาที่เลือก</td></tr>`;
        return;
    }

    data.forEach(record => {
        const row = document.createElement('tr');
        
        // แปลงวันที่ให้อยู่ในรูปแบบที่อ่านง่าย
        const createDate = new Date(record.CreateDate);
        const formattedDate = formatDate(createDate);
        
        // กำหนดแถว
        row.innerHTML = `
            <td class="text-center">${formattedDate}</td>
            <td>${record.DocNo || '-'}</td>
            <td>${record.Grade || '-'}</td>
            <td>${record.SizeIn || '-'}</td>
            <td class="text-end">${formatNumber(record.WeightIn)}</td>
            <td>${record.CoilNo || '-'}</td>
            <td class="text-center">
                <span class="badge ${record.StatusRework ? 'bg-success' : 'bg-secondary'}">
                    ${record.StatusRework ? 'Rework' : 'No Rework'}
                </span>
            </td>
            <td>${record.MachineCode || '-'} ${record.Remark ? `<small class="text-muted">(${record.Remark})</small>` : ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function initMonthFilter() {
    const dateInput = document.getElementById('filterDate');
    if (!dateInput) {
        console.error('Month filter input not found');
        return;
    }

    // แปลง input type="date" เป็น month
    dateInput.type = 'month';
    
    // ตั้งเดือนปัจจุบัน
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    dateInput.value = currentYearMonth;
    
    // เพิ่ม event listener
    dateInput.addEventListener('change', () => {
        const selectedYearMonth = dateInput.value;
        fetchAndDisplayData(selectedYearMonth);
    });
}

function updateSummary(count, weight) {
    // อัพเดทข้อความในส่วนการ์ดด้านบน
    const summaryElement = document.getElementById('totalWeight');
    if (summaryElement) {
        summaryElement.textContent = `Rework ได้: ${count} รายการ (${formatNumber(weight)} kg)`;
    }
    
    // อัพเดทน้ำหนักรวมที่ส่วนท้ายตาราง
    const footerElement = document.getElementById('totalWeightFoot');
    if (footerElement) {
        footerElement.textContent = formatNumber(weight);
    }
}

// Utility Functions
function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatNumber(num) {
    if (!num) return '0.00';
    return parseFloat(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Export Excel
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadInitialData();
        initMonthFilter();
    } catch (error) {
        console.error('Error initializing:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
});

async function loadInitialData() {
    try {
        // ตั้งค่าเดือนปัจจุบันเป็นเดือนเริ่มต้น
        const monthInput = document.getElementById('filterDate');
        if (monthInput) {
            const today = new Date();
            const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            monthInput.value = currentYearMonth;

            // เรียก API และกรองข้อมูลตามเดือน
            await fetchAndDisplayData(currentYearMonth);
        } else {
            // ถ้าไม่มี month input ให้โหลดข้อมูลทั้งหมด
            await fetchAndDisplayData();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

async function fetchAndDisplayData(yearMonth = null) {
    try {
        // เรียก API ดึงข้อมูล
        const response = await fetch('/api/production/rework/data-records');
        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();

        // กรองข้อมูลตามเดือนที่เลือก (ถ้ามี)
        let filteredData = data;
        if (yearMonth) {
            filteredData = data.filter(record => {
                const recordDate = new Date(record.CreateDate);
                const recordYearMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
                return recordYearMonth === yearMonth;
            });
        }

        // นำข้อมูลมาแสดงผลที่เว็บ
        renderTable(filteredData);
        
        // คำนวณน้ำหนักรวมและจำนวนรายการ
        const totalWeight = filteredData.reduce((sum, record) => sum + (parseFloat(record.WeightIn) || 0), 0);
        const recordCount = filteredData.length;
        
        // แสดงสรุปข้อมูล
        updateSummary(recordCount, totalWeight);
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

function renderTable(data) {
    const tbody = document.querySelector('#reworkTable tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }
    tbody.innerHTML = '';

    if (data.length === 0) {
        // แสดงข้อความถ้าไม่มีข้อมูล
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">ไม่พบข้อมูลในช่วงเวลาที่เลือก</td></tr>`;
        return;
    }

    // ตรวจสอบโครงสร้างข้อมูลจากข้อมูลรายการแรก
    const hasRSNCodeRef2 = data.length > 0 && 'RSNCodeRef2' in data[0];
    const hasPlateNo = data.length > 0 && 'PlateNo' in data[0];
    
    // สร้างแถวข้อมูลแต่ละรายการ
    data.forEach(record => {
        const row = document.createElement('tr');
        
        // แปลงวันที่ให้อยู่ในรูปแบบที่อ่านง่าย
        const createDate = new Date(record.CreateDate);
        const formattedDate = formatDate(createDate);
        
        // กำหนดแถว - ปรับให้ตรวจสอบและแสดงเฉพาะฟิลด์ที่มีอยู่
        row.innerHTML = `
            <td class="text-center">${formattedDate}</td>
            <td>${record.DocNo || '-'}</td>
            <td>${record.Grade || '-'}</td>
            <td>${record.SizeIn || '-'}</td>
            <td class="text-end">${formatNumber(record.WeightIn)}</td>
            <td>${record.CoilNo || '-'}</td>
            <td>${record.MachineCode || '-'} ${record.Remark ? `<small class="text-muted">(${record.Remark})</small>` : ''}</td>
            <td class="text-center">
                <span class="badge ${record.StatusRework ? 'bg-success' : 'bg-secondary'}">
                    ${record.StatusRework ? 'Rework' : 'No Rework'}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function initMonthFilter() {
    const dateInput = document.getElementById('filterDate');
    if (!dateInput) {
        console.error('Month filter input not found');
        return;
    }

    // แปลง input type="date" เป็น month
    dateInput.type = 'month';
    
    // ตั้งเดือนปัจจุบัน
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    dateInput.value = currentYearMonth;
    
    // เพิ่ม event listener
    dateInput.addEventListener('change', () => {
        const selectedYearMonth = dateInput.value;
        fetchAndDisplayData(selectedYearMonth);
    });
}

function updateSummary(count, weight) {
    // อัพเดทข้อความในส่วนการ์ดด้านบน
    const summaryElement = document.getElementById('totalWeight');
    if (summaryElement) {
        summaryElement.textContent = `Rework ได้: ${count} รายการ (${formatNumber(weight)} kg)`;
    }
    
    // อัพเดทน้ำหนักรวมที่ส่วนท้ายตาราง
    const footerElement = document.getElementById('totalWeightFoot');
    if (footerElement) {
        footerElement.textContent = formatNumber(weight);
    }
}

// Utility Functions
function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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
        const rows = Array.from(document.querySelectorAll('#reworkTable tbody tr'))
            .filter(row => !row.querySelector('td[colspan]')); // กรองแถว "ไม่พบข้อมูล" ออก
            
        if (rows.length === 0) {
            alert('ไม่มีข้อมูลที่จะ export');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rework Records');

        // Add headers
        worksheet.columns = [
            { header: 'วันที่', key: 'date', width: 15 },
            { header: 'MFG No.', key: 'docNo', width: 15 },
            { header: 'Grade', key: 'grade', width: 15 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Weight', key: 'weight', width: 12, style: { numFmt: '#,##0.00' } },
            { header: 'Coil No', key: 'coilNo', width: 15 },
            { header: 'Plate No', key: 'plateNo', width: 15 },
            { header: 'RSN Code', key: 'rsnCode', width: 20 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'บันทึก', key: 'detail', width: 20 }
        ];

        // Add data
        rows.forEach(row => {
            // ตรวจสอบว่ามีข้อมูลครบทุกคอลัมน์หรือไม่
            const rowData = {
                date: row.cells[0].textContent,
                docNo: row.cells[1].textContent,
                grade: row.cells[2].textContent,
                size: row.cells[3].textContent,
                weight: parseFloat(row.cells[4].textContent.replace(/,/g, '')),
                coilNo: row.cells[5].textContent
            };
            
            // ตรวจสอบว่ามีคอลัมน์ที่เหลือหรือไม่
            if (row.cells.length > 6) rowData.plateNo = row.cells[6].textContent;
            if (row.cells.length > 7) rowData.rsnCode = row.cells[7].textContent;
            if (row.cells.length > 8) rowData.status = row.cells[8].textContent.trim();
            if (row.cells.length > 9) rowData.detail = row.cells[9].textContent;
            
            worksheet.addRow(rowData);
        });

        // Style headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008000' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Add borders to all cells
        for (let i = 1; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            row.eachCell({ includeEmpty: true }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }

        // Add summary row
        worksheet.addRow([]);
        
        const totalWeightElement = document.getElementById('totalWeight');
        const summaryText = totalWeightElement ? totalWeightElement.textContent : '';
        
        const summaryRow = worksheet.addRow(['รวมทั้งหมด', summaryText]);
        summaryRow.font = { bold: true };
        summaryRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9900' } };
        summaryRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9900' } };

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const monthInput = document.getElementById('filterDate');
        const period = monthInput ? monthInput.value : new Date().toISOString().split('T')[0];
        
        link.download = `Rework_Records_${period}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('เกิดข้อผิดพลาดในการ export ไฟล์');
    }
});