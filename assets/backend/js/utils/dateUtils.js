window.dateUtils = {
    DATE_FORMAT: {
        FULL_TIME: {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Bangkok'
        }
    },

    formatDateThai(dateString, format = this.DATE_FORMAT.FULL_TIME) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            date.setHours(date.getHours() - 7);
    
            const year = date.getFullYear(); // ลบ + 543 ออก
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
    
            return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.error('Error in formatDateThai:', error);
            return '';
        }
    },

    formatDate(date) {
        try {
            // ถ้าเป็น string ในรูปแบบ YYYY-MM-DD อยู่แล้ว ให้ส่งคืนค่าเดิม
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return date;
            }

            // แปลงเป็น Date object
            let dateObj;
            if (date instanceof Date) {
                dateObj = date;
            } else {
                dateObj = new Date(date);
            }

            // ตรวจสอบความถูกต้องของวันที่
            if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date for formatDate:', date);
                return null;
            }

            // แปลงเป็น Bangkok timezone
            const bangkokTime = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
            
            // จัดรูปแบบวันที่
            const year = bangkokTime.getFullYear();
            const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');
            const day = String(bangkokTime.getDate()).padStart(2, '0');

            const formattedDate = `${year}-${month}-${day}`;
            console.log('Formatted date:', formattedDate); // Debug log
            return formattedDate;

        } catch (error) {
            console.error('Error in formatDate:', error);
            return null;
        }
    },

    // Helper function for validating dates
    isValidDate(date) {
        if (!date) return false;
        const d = new Date(date);
        return !isNaN(d.getTime());
    },

    // Helper function for getting current date in YYYY-MM-DD format
    getCurrentDate() {
        const now = new Date();
        return this.formatDate(now);
    },

    // Helper function for parsing date string
    parseDate(dateString) {
        if (!dateString) return null;
        const parsed = new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
};

// Debug helper
console.log('dateUtils loaded:', {
    currentDate: window.dateUtils.getCurrentDate(),
    formatExample: window.dateUtils.formatDate(new Date())
});