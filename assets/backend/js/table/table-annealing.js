let selectedDate = new Date().toISOString().split('T')[0];
let allDetailData = [];

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

async function fetchDetailData(date, machineCode) {
    try {
        const startDate = new Date(date);
        startDate.setHours(8, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(7, 59, 59, 999);

        // แปลงเป็น ISO string และปรับ timezone
        const startDateString = startDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
        const endDateString = endDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });

        console.log('Fetching data for date range:', startDateString, 'to', endDateString);

        const apiUrl = `http://192.168.1.214:5000/api/machineAnnealing?startDate=${encodeURIComponent(startDateString)}&endDate=${encodeURIComponent(endDateString)}&machineCode=${machineCode}`;
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw data from API:', data);

        const filteredData = data.filter(item => {
            const printTime = new Date(item.PrintTime);
            console.log('Checking item:', item.DocNo, 'PrintTime:', printTime, 'MachineCode:', item.MachineCode);
            return printTime >= startDate && printTime <= endDate && item.MachineCode.startsWith(machineCode.slice(0, -1));
        });

        console.log('Filtered data:', filteredData);
        return filteredData;
    } catch (error) {
        console.error('Error fetching machine details:', error);
        return [];
    }
}


function populateDetailTable(data) {
    const tableBody = document.querySelector('#detailTable tbody');
    tableBody.innerHTML = '';

    data.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${formatDateThai(item.PrintTime)}</td>
            <td>${item.MachineCode || ''}</td>
            <td>${item.DocNo || ''}</td>
            <td>${item.PartName}</td>
            <td>${item.SizeOut}</td>
            <td>${item.CoilNo || ''}</td>
            <td>${item.printWeight || ''}</td>
            <td>${item.PlateNo || ''}</td>
            <td>${item.Plan || ''}</td>
            <td>${item.Cause || ''}</td>
            <td>${item.Downtime || ''}</td>
            <td><button onclick="saveRemark('${item.DocNo}', '${item.RSNCode}', this)">บันทึก</button></td>
        `;
    });

    if (data.length === 0) {
        const row = tableBody.insertRow();
        row.innerHTML = '<td colspan="14">ไม่พบข้อมูล WIP สำหรับช่วงเวลาที่เลือก</td>';
    }
}

function initDetailTable() {
    const tableContainer = document.getElementById('detailTableContainer');
    tableContainer.innerHTML = `
        <table id="detailTable" class="table table-bordered table-striped table-hover">
            <thead>
                <tr>
                    <th>เวลาที่ออก</th>
                    <th>No.หัวม้วน</th>
                    <th>MFG No.</th>
                    <th>Brand Name</th>
                    <th>SizeOut</th>
                    <th>CoilNo</th>
                    <th>น้ำหนัก(Kg.)</th>
                    <th>หมายเลขรีล</th>
                    <th>Plan</th>
                    <th>Cause</th>
                    <th>Downtime</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

async function showMachineDetails(date, machineCode) {
    selectedDate = date;
    const detailData = await fetchDetailData(date, machineCode);
    allDetailData = detailData;
    initDetailTable();
    populateDetailTable(detailData);
}

document.addEventListener('DOMContentLoaded', function() {
    const detailFilterButton = document.getElementById('detailFilterButton');
    const machineSelect = document.getElementById('machineSelect');
    const dateInput = document.getElementById('detailDateInput');
    const exportPDFButton = document.getElementById('exportPDFButton');
    if (exportPDFButton) {
        exportPDFButton.addEventListener('click', exportToPDF);
    } else {
        console.error('Export PDF button not found');
    }
    
    const exportExcelButton = document.getElementById('exportExcelButton');
    if (exportExcelButton) {
      exportExcelButton.addEventListener('click', exportToExcel);
    }

    if (detailFilterButton && machineSelect) {
        const machines = [
            { code: 'ANN%', name: 'ทุกเตา' },
            { code: 'ANN001%', name: 'เตาที่ 1' },
            { code: 'ANN002%', name: 'เตาที่ 2' },
            { code: 'ANN003%', name: 'เตาที่ 3' },
            { code: 'ANN004%', name: 'เตาที่ 4' },
            { code: 'ANN005%', name: 'เตาที่ 5' },
            { code: 'ANN006%', name: 'เตาที่ 6' }
        ];
        
        machines.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.code;
            option.textContent = machine.name;
            machineSelect.appendChild(option);
        });

        if (detailFilterButton) {
            detailFilterButton.addEventListener('click', () => {
                try {
                    if (dateInput && machineSelect) {
                        const date = dateInput.value;
                        const selectedMachineCode = machineSelect.value;
                        showMachineDetails(date, selectedMachineCode);
                    }
                } catch (error) {
                    console.error('Error in filter button click:', error);
                    alert('เกิดข้อผิดพลาดในการกรองข้อมูล: ' + error.message);
                }
            });
        }
    }
});

window.exportToExcel = async function() {
    const workbook = new ExcelJS.Workbook();
    const dateElement = document.getElementById('detailDateInput');
    if (!dateElement || !dateElement.value) {
        alert('กรุณาเลือกวันที่');
        return;
    }
    const selectedDate = dateElement.value;

    const worksheet = workbook.addWorksheet('Annealing Report');

    // กำหนด columns ใน excel 
    const columns = [
        { header: 'เวลาที่ออก', key: 'printTime', width: 20 },
        { header: 'No.หัวม้วน', key: 'machineCode', width: 15 },
        { header: 'MFG No.', key: 'docNo', width: 20 },
        { header: 'GRADE', key: 'partName', width: 20 },
        { header: 'SizeOut', key: 'sizeOut', width: 15 },
        { header: 'CoilNo', key: 'coilNo', width: 15 },
        { header: 'น้ำหนัก(Kg.)', key: 'printWeight', width: 15 },
        { header: 'หมายเลขรีล', key: 'plateNo', width: 15 },
        { header: 'Plan', key: 'plan', width: 10 },
        { header: 'Cause', key: 'cause', width: 20 },
        { header: 'Downtime', key: 'downtime', width: 15 }
    ];

    worksheet.columns = columns;

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

    // ใส่สีคอลัมน์แรก
    worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
    });

    // เพิ่มข้อมูลลงใน worksheet
    const rows = document.querySelectorAll('#detailTable tbody tr');
    let morningTotalWeight = 0;
    let nightTotalWeight = 0;
    let morningRows = [];
    let nightRows = [];

    rows.forEach((row) => {
        const printTimeStr = row.cells[0].textContent;
        const printTime = new Date(printTimeStr)

        if (isNaN(printTime.getTime())) {
            console.error('Invalid date:', printTimeStr);
            return; // ข้ามแถวนี้ถ้าวันที่ไม่ถูกต้อง
        } 

        const rowData = {
            printTime: printTimeStr,
            machineCode: row.cells[1].textContent,
            docNo: row.cells[2].textContent,
            partName: row.cells[3].textContent,
            sizeOut: row.cells[4].textContent,
            coilNo: row.cells[5].textContent,
            printWeight: parseFloat(row.cells[6].textContent) || 0,
            plateNo: parseFloat(row.cells[7].textContent) || 0,
            plan: row.cells[8].textContent,
            cause: row.cells[9].textContent,
            downtime: row.cells[10].textContent
        };

        //แยกข้อมูลตามกะ
        const hour = printTime.getHours();
        if (hour >= 8 && hour < 20) {
            morningRows.push(rowData);
            morningTotalWeight += rowData.printWeight;
        } else {
            nightRows.push(rowData);
            nightTotalWeight += rowData.printWeight;
        }
    });

    // ข้อมูลกะเช้า
    worksheet.addRow(['กะเช้า']).eachCell((cell) => {
        cell.font = { bold: true, size: 14 };
    });
    const morningHeaderRow = worksheet.addRow(columns.map(col => col.header));
    morningHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
    })
    morningRows.forEach(row => worksheet.addRow(row));

    // สรุปแต่ละกะ
    const summaryStyle = { 
        font: { bold: true }, 
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00'} } 
    };
    worksheet.addRow(['รวมน้ำหนัก (กะเช้า)', '', '', '', '', '', morningTotalWeight.toFixed(1)]).eachCell((cell) => {
        cell.style = summaryStyle;
    });

    // ข้อมูลกะดึก
    worksheet.addRow([]);
    worksheet.addRow(['กะดึก']).eachCell((cell) => {
        cell.font = { bold: true, size: 14 };
    })
    const nightHeaderRow = worksheet.addRow(columns.map(col => col.header));
    nightHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
    })
    nightRows.forEach(row => worksheet.addRow(row));

    worksheet.addRow(['รวมน้ำหนัก (กะดึก)', '', '', '', '', '', nightTotalWeight.toFixed(1)]).eachCell((cell) => {
        cell.style = summaryStyle;
    });

    // total weight ในแต่ละ กะ
    worksheet.addRow([]);
    worksheet.addRow(['รวมน้ำหนักทั้ง 2 กะ', '', '', '', '', '', (morningTotalWeight + nightTotalWeight).toFixed(1)]).eachCell((cell) => {
        cell.style = { ...summaryStyle, font: { ...summaryStyle.font, size: 14 } };
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


function exportToPDF() {
    console.log('Exporting to PDF...');
    const { jsPDF } = window.jspdf;
    
    // สร้าง PDF ด้วยการรองรับ Unicode
    const doc = new jsPDF('l', 'mm', 'a4', true);

    const dateElement = document.getElementById('detailDateInput');
    if (!dateElement || !dateElement.value) {
        alert('กรุณาเลือกวันที่');
        return;
    } 
    const selectedDate = dateElement.value;

    // ใช้ฟอนต์ที่มาพร้อมกับ Font Awesome
    doc.setFont("helvetica", "normal");
    
    // เพิ่มหัวข้อ
    doc.setFontSize(12);
    doc.text(`Annealing Report - ${selectedDate}`, 14, 10);

    // เตรียมข้อมูลสำหรับตาราง
    const headers = [
        'TimeOut', 'Machine', 'MFG No.', 'Brand Name', 'SizeOut', 
        'CoilNo', 'Actual(Kg.)', 'Reel Number', 'Plan', 'Cause', 'Downtime'
    ];

    const rows = document.querySelectorAll('#detailTable tbody tr');
    let morningData = [];
    let nightData = [];
    let morningTotalWeight = 0;
    let nightTotalWeight = 0;

    rows.forEach(row => {
        const printTime = new Date(row.cells[0].textContent);
        const rowData = [
            row.cells[0].textContent,
            row.cells[1].textContent,
            row.cells[2].textContent,
            row.cells[3].textContent,
            row.cells[4].textContent,
            row.cells[5].textContent,
            parseFloat(row.cells[6].textContent) || 0,
            row.cells[7].textContent,
            row.cells[8].textContent,
            row.cells[9].textContent,
            row.cells[10].textContent
        ]
    
        const weight = parseFloat(row.cells[6].textContent) || 0;
        if (printTime.getHours() >= 8 && printTime.getHours() < 20) {
            morningData.push(rowData);
            morningTotalWeight += weight;
        } else {
            nightData.push(rowData);
            nightTotalWeight += weight;
        }
    
    });

    // คำนวณความกว้างตาราง 
    const pageWidth = doc.internal.pageSize.width;
    const margins = 20; // ระยะของซ้ายและขวา
    const tableWidth = pageWidth - margins;
    
    const tableStyle = {
        headStyles: {}, // ใช้สีดั้งเดิมของ library
        bodyStyles: {},
        alternateRowStyles: {},
        tableLineColor: [0, 0, 0], // สีดำสำหรับเส้นตาราง
        tableLineWidth: 0.2, // เพิ่มความหนาของเส้นนอกตาราง
        styles: { 
            fontSize: 7, 
            cellPadding: 1.15,
            lineColor: [0, 0, 0], // สีดำสำหรับเส้นในตาราง
            lineWidth: 0.1 // ความหนาของเส้นในตาราง
        },
    columnStyles: {
        0: { cellWidth: tableWidth * 0.09 },  // TimeOut
        1: { cellWidth: tableWidth * 0.08 },  // Machine
        2: { cellWidth: tableWidth * 0.10 },  // MFG No.
        3: { cellWidth: tableWidth * 0.12 },  // Brand Name
        4: { cellWidth: tableWidth * 0.08 },  // SizeOut
        5: { cellWidth: tableWidth * 0.08 },  // CoilNo
        6: { cellWidth: tableWidth * 0.08 },  // Actual(Kg.)
        7: { cellWidth: tableWidth * 0.09 },  // Reel Number
        8: { cellWidth: tableWidth * 0.08 },  // Plan
        9: { cellWidth: tableWidth * 0.12 },  // Cause
        10: { cellWidth: tableWidth * 0.08 }  // Downtime
    },
    margin: { left: 10, right: 10 }
};

    // ตารางกะเช้า
    doc.setFontSize(14);
    doc.text("Morning shift(08:00-20:00)", 14, 20);
    doc.autoTable({
        head: [headers],
        body: morningData,
        startY: 25,
        ...tableStyle
    });

    // สรุปกะเช้า
    const morningEndY = doc.lastAutoTable.finalY + 5;
    doc.setFillColor(255, 255, 0); //เหลือง
    doc.rect(10, morningEndY, 280, 8, 'F');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Sum Morning-Shift(08:00-20:00): ${(morningTotalWeight.toFixed(1))} Kg.`, 14, morningEndY + 6);

    // ตารางกะดึก 
    doc.setFontSize(14);
    doc.text("Night shift(20:00-08:00)", 14, morningEndY + 15);
    doc.autoTable({
        head: [headers],
        body: nightData,
        startY: morningEndY + 20,
        ...tableStyle
    });

    // สรุปกะดึก
    const nightEndY = doc.lastAutoTable.finalY + 5;
    doc.setFillColor(255, 255, 0); //เหลือง
    doc.rect(10, nightEndY, 280, 8, 'F');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Sum Night-Shift(20:00-08:00): ${nightTotalWeight.toFixed(1)} Kg.`, 14, nightEndY + 6);

    // สรุปรวมทั้ง 2 กะ
    const totalEndY = nightEndY + 15;
    doc.setFillColor(150, 250, 100); //เหลือง
    doc.rect(10, totalEndY, 280, 8, 'F');
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Sum Today;s Totals : ${(morningTotalWeight + nightTotalWeight).toFixed(1)} Kg.`, 14, totalEndY + 6);

    // เพิ่ม Footer
    // doc.setFontSize(10);
    // doc.setTextColor(0);
    // const pageCount = doc.internal.getNumberOfPages();
    // for (let i = 1; i <= pageCount; i++) {
    //     doc.setPage(i);
    //     const pageHeight = doc.internal.pageSize.height;
    //     doc.text(`หน้า ${i} จาก ${pageCount}`, 14, pageHeight - 10);
    // }

    // บันทึก PDF
    doc.save(`Annealing_Report_${selectedDate}.pdf`);
    console.log('PDF created and download initiated');
}