let selectedDate = new Date().toISOString().split('T')[0];
let allDetailData = [];

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateThai(date) {
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

async function fetchDetailData(startDate, endDate, machineCode) {
    try {
        const url = new URL('/api/wasteChartData', window.location.origin);
        url.searchParams.append('startDate', startDate);
        url.searchParams.append('endDate', endDate);
        url.searchParams.append('machineCodePrefix', machineCode);
        
        console.log('Fetching data from API:', url.toString());

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw data received:', data);

        // กรองข้อมูลตาม machineCode และวันที่
        const filteredData = data.details.filter(item => {
            const itemDate = new Date(item.PrintTime);
            return itemDate >= new Date(startDate) && itemDate <= new Date(endDate) &&
                   (machineCode.endsWith('%') ? item.MachineCode.startsWith(machineCode.slice(0, -1)) : item.MachineCode === machineCode);
        });

        console.log('Filtered data:', filteredData);
        return filteredData;
    } catch (error) {
        console.error('Error fetching detail data:', error);
        return [];
    }
}

// Infinite Scroll 
async function populateDetailTable(data, startIndex = 0, itemsPerPage = 20) {
    const tableBody = document.querySelector('#detailTable tbody');
    if (!tableBody) {
        console.error('Table body not found');
        return false;
    }

    const endIndex = startIndex + itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);

    pageData.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.DocNo || ''}</td>
            <td>${formatDateThai(item.PrintTime)}</td>
            <td>${item.MachineCode || ''}</td>
            <td>${item.PartName || ''}</td>
            <td>${item.WasteQuantity || ''}</td>
            <td>${item.NCCode || ''}</td>
            <td>${item.SizeIn || ''}</td>
            <td>${item.SizeOut || ''}</td>
            <td>${item.ItemLen || ''}</td>
            <td>${item.CoilNo || ''}</td>
            <td>${item.Remark || ''}</td>
        `;
    });

    if (data.length === 0 && startIndex === 0) {
        const row = tableBody.insertRow();
        row.innerHTML = '<td colspan="11">ไม่พบข้อมูล NCR สำหรับช่วงเวลาที่เลือก</td>';
    }

    return endIndex < data.length;
}

let currentIndex = 20;
const itemsPerPage = 20;

function infiniteScrollHandler() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (allDetailData && currentIndex < allDetailData.length) {
            showLoadingMore();
            populateDetailTable(allDetailData, currentIndex, itemsPerPage).then(() => {
                currentIndex += itemsPerPage;
                hideLoadingMore();
            });
        }
    }
}

function hideLoadingMore() {
    const loadingMore = document.getElementById('loadingMore');
    if (loadingMore) {
        loadingMore.remove();
    }
}

function showLoadingMore() {
    const container = document.getElementById('detailTableContainer');
    if (!container) return;

    const loadingMore = document.createElement('div');
    loadingMore.id = 'loadingMore';
    loadingMore.textContent = 'กำลังโหลดข้อมูลเพิ่มเติม...';
    loadingMore.style.textAlign = 'center';
    loadingMore.style.padding = '10px';
    container.appendChild(loadingMore);
}

// function updatePagination(totalItems, currentPage, itemsPerPage) {
//     const totalPages = Math.ceil(totalItems / itemsPerPage);
//     const paginationElement = document.getElementById('pagination');
//     if (!paginationElement) return;

//     let paginationHTML = '';
//     for (let i = 1; i <= totalPages; i++) {
//         paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
//             <a class="page-link" href="#" data-page="${i}">${i}</a>
//         </li>`;
//     }

//     paginationElement.innerHTML = paginationHTML;

//     paginationElement.addEventListener('click', (e) => {
//         e.preventDefault();
//         if (e.target.tagName === 'A') {
//             const page = parseInt(e.target.getAttribute('data-page'));
//             populateDetailTable(allDetailData, page, itemsPerPage);
//         }
//     });
// }

function updateMachineNameDisplay(machineCode) {
    const machineNameElement = document.getElementById('currentMachineName');
    if (machineNameElement) {
        const machineSelect = document.getElementById('machineSelect');
        if (machineSelect) {
            const selectedOption = machineSelect.querySelector(`option[value="${machineCode}"]`);
            if (selectedOption) {
                machineNameElement.textContent = `ข้อมูลของ: ${selectedOption.textContent}`;
            } else {
                machineNameElement.textContent = `ข้อมูลของ: ${machineCode}`;
            }
        } else {
            machineNameElement.textContent = `ข้อมูลของ: ${machineCode}`;
        }
    }
}

function initDetailTable() {
    const tableContainer = document.getElementById('detailTableContainer');
    if (!tableContainer) {
        console.error('Table container not found');
        return;
    }

    tableContainer.innerHTML = `
        <table id="detailTable" class="table table-bordered table-striped table-hover">
            <thead>
                <tr>
                    <th>MFG No.</th>
                    <th>เวลา</th>
                    <th>Mc.</th>
                    <th>เกรด</th>
                    <th>จำนวนของเสีย(Kg.)</th>
                    <th>Code</th>
                    <th>ขนาดเข้า</th>
                    <th>ขนาดออก</th>
                    <th>ความยาวเพลา</th>
                    <th>Coil No</th>
                    <th>หมายเหตุ</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

async function showMachineDetails(machineCode, startDate, endDate) {
    console.log('Showing machine details:', machineCode, startDate, endDate);
    showLoadingIndicator();
    try {
        initDetailTable();
        const cacheKey = `${machineCode}-${startDate}-${endDate}`;
        let detailData = getCachedData(cacheKey);

        if (!detailData) {
            detailData = await fetchDetailData(startDate, endDate, machineCode);
            cacheData(cacheKey, detailData);
        }

        allDetailData = detailData;
        currentIndex = 20; // Reset currentIndex
        
        // ล้างข้อมูลเก่าและโหลดข้อมูลใหม่ 20 รายการแรก
        const tableBody = document.querySelector('#detailTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '';
        }
        await populateDetailTable(detailData, 0, 20);

        updateMachineNameDisplay(machineCode);
        
        // ตั้งค่า Infinite Scroll ใหม่
        window.removeEventListener('scroll', infiniteScrollHandler);
        window.addEventListener('scroll', infiniteScrollHandler);
    } catch (error) {
        console.error('Error in showMachineDetails:', error);
        alert('เกิดข้อผิดพลาดในการแสดงข้อมูล: ' + error.message);
    } finally {
        hideLoadingIndicator();
    }
}

const dataCache = new Map();

function getCachedData(key) {
    const cachedItem = dataCache.get(key);
    if (cachedItem && Date.now() - cachedItem.timestamp < 5 * 60 * 1000) { // 5 minutes cache
        return cachedItem.data;
    }
    return null;
}

function cacheData(key, data) {
    dataCache.set(key, { data, timestamp: Date.now() });
}

function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const detailFilterButton = document.getElementById('detailFilterButton');
    const machineSelect = document.getElementById('machineSelect');
    const exportExcelButton = document.getElementById('exportExcelButton');

    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', exportToExcel)
    }

    if (machineSelect) {
        const machines = [
            { code: 'CUT%', name: 'ทุกเครื่องตัดเพลา' },
            { code: 'CUT001', name: 'เครื่องตัดเพลา No.1' },
            { code: 'CUT002', name: 'เครื่องตัดเพลา No.2' },
            { code: 'CO2%', name: 'เครื่องกรอลวด'},
            { code: 'PAP%', name: 'เครื่องกรอถัง'}
        ];

        machines.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.code;
            option.textContent = machine.name;
            machineSelect.appendChild(option);
        });

        // ตั้งค่าเริ่มต้นให้เลือก "ทุกเครื่องตัดเพลา"
        machineSelect.value = 'CUT%';
    } else {
        console.error('Machine select element not found');
    }

    if (detailFilterButton) {
        detailFilterButton.addEventListener('click', handleFilterClick);
    } else {
        console.error('Detail filter button not found');
    }

    // เรียก initializeWasteChart ซึ่งจะตั้งค่าวันที่และเรียก showMachineDetails
    initializeWasteChart();
});

async function initializeWasteChart() {
    showLoadingIndicator();
    try {
        const { startDate, endDate } = await setInitialDates();
        await showMachineDetails('CUT%', startDate, endDate);
        if (typeof createOrUpdateWasteChart === 'function') {
            await createOrUpdateWasteChart();
        }
    } catch (error) {
        console.error('Error initializing waste chart:', error);
    } finally {
        hideLoadingIndicator();
    }
}

    // ตอนนี้ใช้เวลาของเครื่อง Client 
    function formatDateForInput(date) {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().split('T')[0];
    }

    // ใช้เขตเวลา Asis/Bangkok เสมอไม่ขึ้นกับ timezone ของเครื่อง client
    // function formatDateForInput(date) {
    //     const options = { 
    //       year: 'numeric', 
    //       month: '2-digit', 
    //       day: '2-digit',
    //       timeZone: 'Asia/Bangkok'
    //     };
    //     const [day, month, year] = date.toLocaleDateString('th-TH', options).split('/');
    //     return `${year}-${month}-${day}`;
    //   }

function setInitialDates() {
    return new Promise(resolve => {
        const startDatePicker = document.getElementById('wasteStart');
        const endDatePicker = document.getElementById('wasteEnd');
        
        if (!startDatePicker || !endDatePicker) {
            console.error("Waste date picker elements not found");
            resolve({ startDate: null, endDate: null });
            return;
        }

        const currentDate = new Date();
        
        startDatePicker.value = formatDateForInput(currentDate);
        endDatePicker.value = formatDateForInput(currentDate);
        
        resolve({ startDate: startDatePicker.value, endDate: endDatePicker.value });
    });
}

function handleFilterClick() {
    try {
        const selectedMachineCode = document.getElementById('machineSelect').value;
        const startDate = document.getElementById('wasteStart').value;
        const endDate = document.getElementById('wasteEnd').value;
        console.log('Filter clicked. Date range:', startDate, 'to', endDate, 'Machine:', selectedMachineCode);
        showMachineDetails(selectedMachineCode, startDate, endDate);
    } catch (error) {
        console.error('Error in filter button click', error);
        alert('เกิดข้อผิดพลาดในการกรองข้อมูล: ' + error.message);
    }
}

window.exportToExcel = async function () {
    const workbook = new ExcelJs.Workbook();
    const startDate = document.getElementById('wasteStart').value;
    const endDate = document.getElementById('wasteEnd').value;
    if (!startDate || !endDate) {
        alert('กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด');
        return;
    }
    const selectedDate = dateElement.value;

    const worksheet = workbook.addWorksheet('BAR2 Report-NCR');

    const columns = [
        { header: 'MFG No.', key: 'DocNo', width: 20},
        { header: 'เวลา', key: 'printTime', width: 20},
        { header: 'Machine', key: 'MachineCode', width: 15},
        { header: 'เกรด', key: 'PartName', width: '20'},
        { header: 'จำนวนของเสีย(Kg.)', key: 'printWeight', width: 15},
        { header: 'ขนาดเข้า', key: 'SizeIn', width: 15},
        { header: 'ขนาดออก', key: 'SizeOut', width: 15},
        { header: 'เพลายาว', key: 'ItemLen', width: 15},
        { header: 'Coil No', key: 'CoilNo', width: 15},
        { header: 'หมายเหตุ', key: 'Remark', width: 20}
    ];

    worksheet.columns = columns;

    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFF'} },
        fill: { type: 'pattern', pattern: 'sold', fgColor: { argb: 'FF008000'} },
        border: {
            top: { style: 'medium'},
            left: { style: 'medium'},
            bottom: { syle: 'medium'},
            right: { style: 'medium'}
        }
    };

    // สีคอลัมน์แรก
    worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
    });

    let ncrTotalWeight = 0;
 
    // เพิ่มข้อมูลลงใน worksheet
    allDetailData.forEach((item) => {
        worksheet.addRow({
            DocNo: item.DocNo,
            printTime: formatDateThai(item.PrintTime),
            MachineCode: item.MachineCode,
            PartName: item.PartName,
            printWeight: item.printWeight,
            SizeIn: item.SizeIn,
            SizeOut: item.SizeOut,
            ItemLen: item.ItemLen,
            CoilNo: item.CoilNo,
            Remark: item.Remark
        });

        const weight = parseFloat(item.printWeight);
        if (!isNaN(weight)) {
            ncrTotalWeight += weight;
        }
    });

    // สรุป
    const summaryStyle = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
    };
    worksheet.addRow(['รวมน้ำหนักของเสีย', '', '', '', '', '', '', ncrTotalWeight.toFixed(1)]).eachCell((cell) => {
        cell.style = summaryStyle;
    });

    try {
        // สร้างไฟล์
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);

        // สร้าง link และ trigger การดาวน์โหลด
        const link = document.createElement("a");
        link.href = url;
        link.download = `BAR2 Report-NCR_${startDate}_to_${endDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error in exporting to Excel', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + error.message);
    }
};