const moment = require('moment');

const DATE_FORMAT = {
    FULL_TIME: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok'
    },
    SHORT_DATE: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Bangkok'
    },
    DATABASE_DATE: 'YYYY-MM-DD',
    DATABASE_DATETIME: 'YYYY-MM-DD HH:mm:ss'
};

/**
 * แปลงวันที่เป็นรูปแบบภาษาไทย
 */
function formatDateThai(dateString, format = DATE_FORMAT.FULL_TIME) {
    if (!dateString) return '';
    try {
        // รับวันที่จากฐานข้อมูล (UTC) และแปลงเป็น local time
        const date = new Date(dateString);
        
        // ปรับวันที่กลับไป 7 ชั่วโมง
        date.setHours(date.getHours() - 7);
        
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Bangkok'
        };
        
        const year = date.getFullYear(); // ใช้ปี ค.ศ. โดยตรง
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

/**
 * แปลงวันที่เป็นรูปแบบ YYYY-MM-DD
 */
function formatDate(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', date);
        return '';
    }
    const bangkokTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    return moment(bangkokTime).format(DATE_FORMAT.DATABASE_DATE);
}

/**
 * แปลงวันที่เป็น moment object ในโซน Asia/Bangkok
 */
function parseDate(dateString) {
    return moment.tz(dateString, 'Asia/Bangkok');
}

/**
 * รับวันที่และคืนค่า start date (8:00) และ end date (7:59 ของวันถัดไป)
 */
function getStartEndDates(date) {
    const momentDate = moment.tz(date, 'Asia/Bangkok');
    
    const startDate = momentDate.clone().hour(8).minute(0).second(0).millisecond(0);
    const endDate = momentDate.clone().add(1, 'days').hour(7).minute(59).second(59).millisecond(999);

    return {
        startDate: startDate.toDate(),
        endDate: endDate.toDate()
    };
}

/**
 * แปลงวันที่เป็นรูปแบบสำหรับ database
 */
function formatForDatabase(date) {
    return moment(date).format(DATE_FORMAT.DATABASE_DATETIME);
}

/**
 * ตรวจสอบความถูกต้องของวันที่
 */
function isValidDate(date) {
    try {
        const d = new Date(date);
        return !isNaN(d.getTime());
    } catch (error) {
        return false;
    }
}

/**
 * คำนวณความแตกต่างระหว่างวันที่
 */
function getDateDiff(date1, date2, unit = 'days') {
    const d1 = moment(date1);
    const d2 = moment(date2);
    return d2.diff(d1, unit);
}

/**
 * เพิ่มหรือลดวัน
 */
function addDays(date, days) {
    return moment(date).add(days, 'days').toDate();
}

/**
 * รับวันแรกของเดือน
 */
function getFirstDayOfMonth(date) {
    return moment(date).startOf('month').toDate();
}

/**
 * รับวันสุดท้ายของเดือน
 */
function getLastDayOfMonth(date) {
    return moment(date).endOf('month').toDate();
}

/**
 * แปลงวันที่จาก timezone หนึ่งไปอีก timezone หนึ่ง
 */
function convertTimezone(date, fromZone, toZone) {
    return moment.tz(date, fromZone).tz(toZone).toDate();
}

module.exports = {
    DATE_FORMAT,
    formatDateThai,
    formatDate,
    parseDate,
    getStartEndDates,
    formatForDatabase,
    isValidDate,
    getDateDiff,
    addDays,
    getFirstDayOfMonth,
    getLastDayOfMonth,
    convertTimezone
};