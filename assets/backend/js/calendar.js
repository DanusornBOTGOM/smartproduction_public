document.addEventListener('DOMContentLoaded', function() {
    // ตัวแปรสำหรับ DOM elements
    const modalElement = document.getElementById('eventModal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const editEventBtn = document.getElementById('editEventBtn');
    const calendarEl = document.getElementById('calendar');
    const machineCodeSelect = document.getElementById('machineCode');
    
    // ตรวจสอบความพร้อมของ libraries
    if (typeof FullCalendar === 'undefined') {
        displayErrorMessage('ไม่สามารถโหลดปฏิทินได้ กรุณาตรวจสอบการเชื่อมต่อเครือข่าย');
        return;
    }
    
    // ตั้งค่า Modal สำหรับแสดงรายละเอียดกิจกรรม
    const eventModal = createCustomModal(modalElement, modalBackdrop);
    
    // สร้างปฏิทิน
    const calendar = createCalendar(calendarEl, machineCodeSelect, eventModal, editEventBtn);
    
    // เริ่มการแสดงผลปฏิทิน
    initializeCalendar(calendar);
    
    // ตั้งค่า Event Listeners
    setupEventListeners(calendar, machineCodeSelect);
});

function createCustomModal(modalElement, modalBackdrop) {
    const modal = {
        show: function() {
            modalElement.style.display = 'block';
            modalBackdrop.style.display = 'block';
            document.body.style.overflow = 'hidden';
        },
        hide: function() {
            modalElement.style.display = 'none';
            modalBackdrop.style.display = 'none';
            document.body.style.overflow = '';
        }
    };
    
    // เพิ่ม event listeners สำหรับปุ่มปิด modal
    const closeButtons = modalElement.querySelectorAll('.btn-close, .btn-secondary');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => modal.hide());
    });
    
    // ปิด modal เมื่อคลิกที่ backdrop
    modalBackdrop.addEventListener('click', () => modal.hide());
    
    return modal;
}

function displayErrorMessage(message) {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        calendarEl.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

function createCalendar(calendarEl, machineCodeSelect, eventModal, editEventBtn) {
    return new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'th',
        height: 'auto',
        aspectRatio: 1.5,
        navLinks: true,
        selectable: true,
        nowIndicator: true,
        dayMaxEvents: true,
        timeZone: 'local',
        
        // รูปแบบการแสดงผลกิจกรรม
        eventDidMount: function(info) {
            removeEventStyles(info.el);
        },
        
        // ดึงข้อมูลกิจกรรมจาก API
        events: function(info, successCallback, failureCallback) {
            fetchEvents(info, machineCodeSelect.value, successCallback, failureCallback);
        },
        
        // คลิกที่กิจกรรม
        eventClick: function(info) {
            handleEventClick(info, eventModal, editEventBtn);
        },
        
        // คลิกที่วันว่าง
        dateClick: function(info) {
            handleDateClick(info, machineCodeSelect.value);
        }
    });
}

function initializeCalendar(calendar) {
    try {
        calendar.render();
        console.log("Calendar rendered successfully");
        
        // บังคับให้หน้าจอมีการ rendering ใหม่ (เพื่อแก้ปัญหา render บางครั้ง)
        setTimeout(() => {
            calendar.updateSize();
        }, 500);
    } catch (e) {
        console.error("Error rendering calendar:", e);
        displayErrorMessage('เกิดข้อผิดพลาดในการแสดงปฏิทิน: ' + e.message);
    }
}

function setupEventListeners(calendar, machineCodeSelect) {
    // อัพเดทปฏิทินเมื่อมีการเปลี่ยนเครื่องจักร
    machineCodeSelect.addEventListener('change', function() {
        console.log("Machine changed, refreshing events");
        calendar.refetchEvents();
    });
    
    // ตั้งค่า Observer สำหรับติดตามการเปลี่ยนแปลงของ DOM
    setupMutationObserver();
}

/**
 * ตั้งค่า Mutation Observer สำหรับติดตามการเปลี่ยนแปลงของ DOM
 */
function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList && (
                            node.classList.contains('fc-daygrid-day') || 
                            node.classList.contains('fc-event'))) {
                            
                            node.style.pointerEvents = 'auto';
                            node.style.cursor = 'pointer';
                        }
                    }
                });
            }
        });
    });
    
    // เริ่มสังเกตการเปลี่ยนแปลงหลังจากที่หน้าเว็บโหลดเสร็จ
    window.addEventListener('load', () => {
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            observer.observe(calendarEl, {
                childList: true,
                subtree: true
            });
        }
    });
}

function removeEventStyles(eventElement) {
    // ลบสีพื้นหลัง
    eventElement.style.backgroundColor = 'transparent';
    eventElement.style.borderColor = 'transparent';
    
    // ปรับรูปแบบข้อความ
    const eventContent = eventElement.querySelector('.fc-event-title');
    if (eventContent) {
        eventContent.style.fontWeight = 'normal';
        eventContent.style.color = '#333';
    }
}

function fetchEvents(info, machineCode, successCallback, failureCallback) {
    // แสดง loading spinner
    document.body.classList.add('loading');
    
    // สร้าง URL สำหรับ API
    const apiUrl = buildApiUrl(info, machineCode);
    
    // เรียก API
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => processApiResponse(data, successCallback, failureCallback))
        .catch(error => handleApiError(error, failureCallback))
        .finally(() => {
            // ซ่อน loading spinner
            document.body.classList.remove('loading');
        });
}

function handleApiError(error, failureCallback) {
    console.error('API error:', error);
    failureCallback(error);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
}

function buildApiUrl(info, machineCode) {
    const formattedStartDate = formatDateForAPI(info.start);
    const formattedEndDate = formatDateForAPI(info.end);
    
    return `/api/production/workshift/calendar-data?machineCode=${machineCode}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`;
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function processApiResponse(data, successCallback, failureCallback) {
    console.log("API data received:", data);
    
    if (data[0] === '00') {
        // แสดงข้อมูลดิบก่อนแปลง
        console.log("Raw events data:", data[2]);
        
        const events = transformEventsData(data[2]);
        console.log("Formatted events:", events);
        successCallback(events);
    } else {
        console.warn("API returned error:", data[1]);
        failureCallback(new Error(data[1]));
        alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + data[1]);
    }
}

function transformEventsData(eventsData) {
    return eventsData.map(event => {
        // แยกข้อมูลจากชื่อกิจกรรม - ตัดตัวเลขวันที่ออกจากข้างหน้า
        const machineCode = extractMachineCode(event.title);
        
        // แปลงเวลาเริ่มต้นและสิ้นสุด
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);
        
        const startHour = startTime.getHours().toString().padStart(2, '0');
        const endHour = endTime.getHours().toString().padStart(2, '0');
        
        // ดึงชั่วโมงการทำงานจาก location
        const hours = extractWorkingHours(event.location);
        
        // สร้างชื่อใหม่
        const newTitle = `${machineCode} ${startHour} - ${endHour} (${hours})`;
        
        return {
            id: event.id,
            title: newTitle,
            start: event.start,
            end: event.end,
            extendedProps: {
                machine: machineCode,
                duration: event.location,
                startHour: startHour,
                endHour: endHour,
                hours: hours,
                originalTitle: event.title
            }
        };
    });
}

function transformEventsData(eventsData) {
    return eventsData.map(event => {
        // แยกข้อมูลจากชื่อกิจกรรม - ตัดตัวเลขวันที่ออกจากข้างหน้า
        const machineCode = extractMachineCode(event.title);
        
        // แปลงเวลาเริ่มต้นและสิ้นสุด
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);
        
        const startHour = startTime.getHours().toString().padStart(2, '0');
        const endHour = endTime.getHours().toString().padStart(2, '0');
        
        // ดึงชั่วโมงการทำงานจาก location
        const hours = extractWorkingHours(event.location);
        
        // สร้างชื่อใหม่
        const newTitle = `${machineCode} ${startHour} - ${endHour} (${hours})`;
        
        return {
            id: event.id,
            title: newTitle,
            start: event.start,
            end: event.end,
            extendedProps: {
                machine: machineCode,
                duration: event.location,
                startHour: startHour,
                endHour: endHour,
                hours: hours,
                originalTitle: event.title
            }
        };
    });
}

function extractMachineCode(title) {
    const titleParts = title.split(' ');
    
    if (titleParts.length > 1) {
        // ตรวจสอบว่าส่วนแรกเป็นตัวเลขหรือไม่
        if (/^\d+$/.test(titleParts[0])) {
            // ถ้าส่วนแรกเป็นตัวเลข (เช่น "08") ให้ใช้ส่วนที่ 2
            return titleParts[1];
        }
        // ถ้าส่วนแรกไม่ใช่ตัวเลข ให้ใช้ส่วนแรก
        return titleParts[0];
    }
    
    // ถ้ามีแค่ส่วนเดียว ใช้ทั้งหมด
    return title;
}

function extractWorkingHours(locationText) {
    if (!locationText) return "Nhr";
    
    const match = locationText.match(/(\d+)\s*ชั่วโมง/);
    if (match && match[1]) {
        return match[1] + "hr";
    }
    
    return "Nhr";
}

function handleEventClick(info, eventModal, editEventBtn) {
    console.log("Event clicked:", info.event);
    
    // ยกเลิก default action ถ้ามี
    if (info.jsEvent) {
        info.jsEvent.preventDefault();
    }
    
    try {
        // กำหนดข้อมูลใน modal
        document.getElementById('eventMachine').textContent = info.event.extendedProps.machine;
        document.getElementById('eventDate').textContent = new Date(info.event.start).toLocaleDateString('th-TH');
        document.getElementById('eventStart').textContent = new Date(info.event.start).toLocaleString('th-TH');
        document.getElementById('eventEnd').textContent = new Date(info.event.end).toLocaleString('th-TH');
        document.getElementById('eventDuration').textContent = info.event.extendedProps.duration;
        
        // กำหนด URL สำหรับปุ่มแก้ไข
        editEventBtn.href = `/api/production/workshift/edit/${info.event.id}`;
        
        // แสดง modal
        eventModal.show();
    } catch (error) {
        console.error("Error showing modal:", error);
    }
}

/**จัดการเมื่อมีการคลิกที่วันว่าง **/
function handleDateClick(info, machineCode) {
    console.log("Date clicked:", info.dateStr);
    
    // ถามผู้ใช้ก่อนเด้งไปหน้าเพิ่มข้อมูล
    if (confirm(`คุณต้องการเพิ่มเวลาทำงานสำหรับวันที่ ${info.dateStr} หรือไม่?`)) {
        window.location.href = `/api/production/workshift/add?machineCode=${machineCode}&workdate=${info.dateStr}`;
    }
}