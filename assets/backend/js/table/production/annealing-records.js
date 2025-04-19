
// let dataTable;

window.addEventListener('load', function() {
    initDataTable();
    initDateFilter();
    initExportButtons();
    
    // calculateShiftSummary หลังจากโหลดหน้า
    calculateShiftSummary();
});

function initDataTable() {
    if(typeof $.fn.DataTable === 'function') {
        dataTable = $('#annealingTable').DataTable({
            order: [[16, 'desc']],
            language: {
                "processing": "กำลังดำเนินการ...",
                "lengthMenu": "แสดง _MENU_ แถว",
                "zeroRecords": "ไม่พบข้อมูล",
                "info": "แสดงหน้า _PAGE_ จาก _PAGES_",
                "infoEmpty": "ไม่พบข้อมูล",
                "infoFiltered": "(กรองข้อมูล _MAX_ ทุกแถว)",
                "search": "ค้นหา:",
                "paginate": {
                    "first": "หน้าแรก",
                    "previous": "ก่อนหน้า",
                    "next": "ถัดไป",
                    "last": "หน้าสุดท้าย"
                }
            }
        });
    } else {
        console.error('DataTable plugin not loaded');
    }
}

// คำนวนผลรวม
function calculateShiftSummary() {
    let morningCount = 0;
    let morningWeight = 0;
    let nightCount = 0;
    let nightWeight = 0;

    const rows = document.querySelectorAll('#annealingTable tbody tr');
    rows.forEach(row => {
        const printTimeStr = row.cells[9].textContent; // ตำแหน่งของ PrintTime (อาจต้องปรับ)
        const printTime = new Date(printTimeStr);
        const weight = parseFloat(row.cells[14].textContent) || 0; // ตำแหน่งของ PrintWeight (อาจต้องปรับ)
        
        const hour = printTime.getHours();
        
        if (hour >= 8 && hour < 20) {
            morningCount++;
            morningWeight += weight;
        } else {
            nightCount++;
            nightWeight += weight;
        }
    });

    // อัพเดทผลรวมกะ
    document.getElementById('morningShiftSummary').textContent = 
        `กะเช้า (08:00-19:59): ${morningCount} รายการ (${morningWeight.toFixed(2)} kg)`;
    document.getElementById('nightShiftSummary').textContent = 
        `กะดึก (20:00-07:59): ${nightCount} รายการ (${nightWeight.toFixed(2)} kg)`;
}

function initDateFilter() {
    const dateInput = document.getElementById('startDate');

    if (!dateInput) {
        console.error('Date input not found');
        return;
    }

    // ฟังก์ชันกรองข้อมูล
    function filterData() {
        const selectedDate = dateInput.value;
        if (selectedDate) {
            window.location.href = `/production/annealing/records?date=${selectedDate}`;
        }
    }

    // เรียกใช้ filterData เมื่อมีการเปลี่ยนแปลงวันที่
    dateInput.addEventListener('change', function() {
        filterData();
    });
    
    // คำนวณผลรวมกะเมื่อโหลดหน้า
    calculateShiftSummary();
}

function initExportButtons() {
    const exportPDFBtn = document.getElementById('exportPDF');
    const exportExcelBtn = document.getElementById('exportExcel');
    
    if(exportPDFBtn) exportPDFBtn.addEventListener('click', exportToPDF);
    if(exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
}

window.onload = function() {
    if($.fn.DataTable) {
        $('#annealingTable').DataTable({
            order: [[16, 'desc']],
            language: {
                "processing": "กำลังดำเนินการ...",
                "lengthMenu": "แสดง _MENU_ แถว",
                "zeroRecords": "ไม่พบข้อมูล",
                "info": "แสดงหน้า _PAGE_ จาก _PAGES_",
                "infoEmpty": "ไม่พบข้อมูล",
                "infoFiltered": "(กรองข้อมูล _MAX_ ทุกแถว)",
                "search": "ค้นหา:",
                "paginate": {
                    "first": "หน้าแรก",
                    "previous": "ก่อนหน้า",
                    "next": "ถัดไป",
                    "last": "หน้าสุดท้าย"
                }
            }
        });
    }
}

if (typeof jQuery != 'undefined') {
    $(window).on('load', function() {
        $('#annealingTable').DataTable({
            order: [[16, 'desc']],
            language: {
                "processing": "กำลังดำเนินการ...",
                "lengthMenu": "แสดง _MENU_ แถว",
                "zeroRecords": "ไม่พบข้อมูล",
                "info": "แสดงหน้า _PAGE_ จาก _PAGES_",
                "infoEmpty": "ไม่พบข้อมูล",
                "infoFiltered": "(กรองข้อมูล _MAX_ ทุกแถว)",
                "search": "ค้นหา:",
                "paginate": {
                    "first": "หน้าแรก",
                    "previous": "ก่อนหน้า",
                    "next": "ถัดไป",
                    "last": "หน้าสุดท้าย"
                }
            }
        });
    });
}

async function exportToExcel() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cleaning Report');
        
        worksheet.columns = [
            { header: 'MFG', key: 'mfg', width: 12 },
            { header: 'Grade', key: 'grade', width: 12 },
            { header: 'Size', key: 'size', width: 8 },
            { header: 'CoilNo', key: 'coilNo', width: 10 },
            { header: 'Step', key: 'step', width: 8 },
            { header: 'ป้ายแทน', key: 'labelNo', width: 12 },
            { header: 'รีล', key: 'reel', width: 10 },
            { header: 'บ่อ', key: 'pool', width: 8 },
            { header: 'เริ่มล้าง', key: 'startTime', width: 18 },
            { header: 'ล้างจบ', key: 'endTime', width: 18 },
            { 
                header: 'สะอาด', 
                key: 'clean', 
                width: 8,
                style: {
                    alignment: { 
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                }
            },
            { 
                header: 'รอย', 
                key: 'wound', 
                width: 8,
                style: {
                    alignment: { 
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                }
            },
            { 
                header: 'สนิม', 
                key: 'rust', 
                width: 8,
                style: {
                    alignment: { 
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                }
            },
            { 
                header: 'ไม่คดงอ', 
                key: 'bend', 
                width: 8,
                style: {
                    alignment: { 
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                }
            },
            { header: 'WeightOut', key: 'weightOut', width: 10 },
            { header: 'บันทึก', key: 'createDate', width: 15 },
            { 
                header: 'สถานะ', 
                key: 'status', 
                width: 8,
                style: {
                    alignment: { 
                        vertical: 'middle',
                        horizontal: 'center'
                    }
                }
            }
        ];

        const visibleRows = Array.from(document.querySelectorAll('#annealingTable tbody tr'))
            .filter(row => row.style.display !== 'none')
            .map(row => ({
                mfg: row.cells[0].textContent,
                grade: row.cells[1].textContent,
                size: row.cells[2].textContent,
                coilNo: row.cells[3].textContent,
                step: row.cells[4].textContent,
                labelNo: row.cells[5].textContent,
                reel: row.cells[6].textContent,
                pool: row.cells[7].textContent,
                startTime: row.cells[8].textContent,
                endTime: row.cells[9].textContent,
                clean: row.cells[10].textContent,
                wound: row.cells[11].textContent,
                rust: row.cells[12].textContent,
                bend: row.cells[13].textContent,
                weightOut: parseFloat(row.cells[14].textContent) || 0,
                createDate: row.cells[15].textContent,
                status: row.cells[16].textContent
            }));

// เพิ่มข้อมูล
worksheet.addRows(visibleRows);

// เพิ่ม border ให้กับทุกเซลล์ในข้อมูล
visibleRows.forEach((_, index) => {
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

// ใส่สี header คงเดิม
worksheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
});

// สรุปกะท้ายตาราง
worksheet.addRow([]);
worksheet.addRow(['']);

// สร้างแถวสรุปการผลิต
worksheet.addRow(['' ,'', '' ,'', '' ,'', '' ,'', '' ,'','' ,'','' ,'','สรุปการผลิต']);
// จัดรูปแบบสีให้ครอบคลุม 3 เซลล์
for(let i = 15; i <= 17; i++) {
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

// สร้างแถวกะเช้า
worksheet.addRow(['' ,'', '' ,'', '' ,'', '' ,'', '' ,'','' ,'','' ,'', document.getElementById('morningShiftSummary').textContent]);
// จัดรูปแบบสีให้ครอบคลุม 3 เซลล์
for(let i = 15; i <= 17; i++) {
    worksheet.getRow(worksheet.rowCount).getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB8CCE4' }
    };
}

// สร้างแถวกะดึก
worksheet.addRow(['' ,'', '' ,'', '' ,'', '' ,'', '' ,'','' ,'','' ,'', document.getElementById('nightShiftSummary').textContent]);
// จัดรูปแบบสีให้ครอบคลุม 3 เซลล์
for(let i = 15; i <= 17; i++) {
    worksheet.getRow(worksheet.rowCount).getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB8CCE4' }
    };
}
        
        
        // สร้างและดาวน์โหลดไฟล์
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        
        const selectedDate = document.getElementById('startDate').value;
        link.download = `Cleaning_Report_${selectedDate}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + error.message);
    }
}

// PDF Export
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFont('helvetica');
    doc.setLanguage('th');
    
    doc.setFontSize(16);
    doc.text('PRODUCTION REPORT (CLEANING)', 15, 15);
    doc.setFontSize(12); 
    doc.text('รายงานการล้างลวดประจำวันและการตรวจสอบคุณภาพ', 15, 25);

    const headers = [['MFG', 'Grade', 'Size', 'WeightIN', 'CoilNo', 'Step', 'ป้ายแทน', 'รีล', 'บ่อ', 
                     'เริ่มล้าง', 'ล้างจบ', 'สะอาด', 'รอย', 'สนิม', 'คดงอ', 'WeightOut', 'บันทึก', 'สถานะ']];

    const data = [];
    document.querySelectorAll('#annealingTable tbody tr').forEach(row => {
        data.push([...Array(18)].map((_, i) => row.cells[i].textContent.trim()));
    });

    doc.autoTable({
        head: headers,
        body: data,
        startY: 35,
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2
        },
        columnStyles: {
            0: {cellWidth: 20},
            9: {cellWidth: 25},
            10: {cellWidth: 25}
        }
    });

    // เพิ่มสรุปกะท้ายตาราง
    const summaryY = doc.autoTable.previous.finalY + 10;
    doc.setFontSize(12);
    doc.text('สรุปการผลิต:', 15, summaryY);
    doc.text(document.getElementById('morningShiftSummary').textContent, 15, summaryY + 7);
    doc.text(document.getElementById('nightShiftSummary').textContent, 15, summaryY + 14);

    const date = document.getElementById('startDate').value;
    doc.save(`Cleaning_Report_${date}.pdf`);
}
