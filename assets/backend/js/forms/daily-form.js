function validateForm() {

    const requiredFields = ['rsnCode', 'docNo', 'sizeIn', 'machineCode', 'coilNo', 'step', 
        'grade', 'reelNumber', 'timeIn', 'timeOut', 'printWeight', 'skinStatus', 'materialType'];

    for (const field of requiredFields) {
        const value = document.getElementById(field).value;
        if (!value || value.trim() === '') {
            alert(`กรุณากรอก ${field}`);
            return false;
        }
    }

    // เพิ่มการตรวจสอบตู้อบแยก
    const oven = document.getElementById('oven');
    const ovenTimeIn = document.getElementById('ovenTimeIn');
    const ovenTimeOut = document.getElementById('ovenTimeOut');

    // ถ้าเลือกตู้อบต้องมีเวลาเข้า-ออก
    if (oven.value && (!ovenTimeIn.value || !ovenTimeOut.value)) {
        alert('กรุณาระบุเวลาเข้าและเวลาออกสำหรับตู้อบ');
        return false;
    }

    // ถ้ามีเวลาต้องตรวจสอบว่าเวลาออกมากกว่าเวลาเข้า
    if (ovenTimeIn.value && ovenTimeOut.value) {
        const start = new Date(ovenTimeIn.value);
        const end = new Date(ovenTimeOut.value);
        if (end <= start) {
            alert('เวลาออกต้องมากกว่าเวลาเข้า');
            return false;
        }
    }

    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded - checking elements');
    const rsnCodeInput = document.getElementById('rsnCode');
    const form = document.getElementById('productionForm');
    
    console.log('Form found:', !!form);
    console.log('RSN input found:', !!rsnCodeInput);


    // โหลดข้อมูล BarCode
    async function fetchRSNData(code) {
        try {
            const response = await fetch(`/api/production/reports/data-daily?rsnCode=${encodeURIComponent(code)}`);
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Received data:', data);
    
            if (!data) {
                throw new Error('ไม่พบข้อมูลที่เหมาะสม');
            }
    
            // แสดงแถวข้อมูล
            const dataRow = document.getElementById('dataRow');
            if (dataRow) {
                dataRow.style.display = '';
            }
    
            // Fill data
            const fields = {
                'docNo': data.DocNo,
                'grade': data.PartName,
                'sizeIn': data.ItemSize,
                'machineCode': data.MachineCode,
                'coilNo': data.CoilNo,
                'step': data.CurrentStep,
                'reelNumber': data.PlateNo,
                'timeIn': formatDisplayDateTime(data.TimeIn),
                'timeOut': formatDisplayDateTime(data.PrintTime),
                'printWeight': data.printWeight
            };
    
            // validation values
            Object.entries(fields).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value || '';
                }
            });
        } catch (error) {
            console.error('Error fetching data:', error);
            alert(`ไม่พบข้อมูลสำหรับ Code นี้: ${error.message}`);
            clearForm();
        }
    }

        // ล้างฟอร์ม
        function clearForm() {
            const fields = ['rsnCode', 'docNo', 'sizeIn', 'machineCode', 'coilNo', 'step', 
                'grade', 'reelNumber', 'timeIn', 'timeOut', 'timeInManual', 'timeOutManual',
                'printWeight', 'skinStatus', 'materialType', 'oven', 'ovenTimeIn', 'ovenTimeOut', 'remark'];

                fields.forEach(field => {
                    const element = document.getElementById(field);
                    if (element) {
                        element.value = '';
                    }
                });

            // ซ่อน data row + remark
            const dataRow = document.getElementById('dataRow');
            if (dataRow) {
                dataRow.style.display = 'none';
            }

            const remarkRow = document.getElementById('remarkRow');
            if (remarkRow) {
                remarkRow.style.display = 'none';
                document.getElementById('remark').removeAttribute('required');
            }

                // ซ่อน duplicateAlert ด้วย
            const duplicateAlert = document.getElementById('duplicateAlert');
            if (duplicateAlert) {
                duplicateAlert.style.display = 'none';
            }

            document.getElementById('isDuplicate').value = 'false';
        }

        // Event listeners
        if (rsnCodeInput) {
            // เมื่อคลิกที่ช่อง input ให้โฟกัส
            rsnCodeInput.addEventListener('focus', function() {
                this.select();
                this.value = '';
            });

        // รองรับการสแกนบาร์โค้ด
        rsnCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
                const event = new Event('change');
                this.dispatchEvent(event);
            }
        });

        // เมื่อมีการเปลี่ยนแปลงค่า
        rsnCodeInput.addEventListener('change', function() {
            const code = this.value.trim();
            if (code) {
                fetchRSNData(code);
            } else {
                clearForm();
            }
        });
    }

    setupFormSubmitHandler(form, rsnCodeInput);
});

// การเลือกตู้อบ
document.getElementById('oven').addEventListener('change', function() {
    const timeIn = document.getElementById('ovenTimeIn');
    const timeOut = document.getElementById('ovenTimeOut');

    // ถ้ามีเลือกตู้อบให้ required
    if (this.value) {
        timeIn.setAttribute('required', '');
        timeOut.setAttribute('required', '');
    } else {
        timeIn.removeAttribute('required');
        timeOut.removeAttribute('required');

        // เคลียร์ค่าเวลา
        timeIn.value = '';
        timeOut.value = '';
    }
});

// ป้องกันกรณี Double Submit ด้วย debounce
function setupFormSubmitHandler(form, rsnCodeInput) {
    if (!form) return;
    
    let isSubmitting = false;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) return; // ถ้ากำลัง submit อยู่จะไม่มีการทำซ้ำ
        isSubmitting = true;
        
        try {
            if (!rsnCodeInput.value.trim()) {
                alert('กรุณากรอก Code');
                rsnCodeInput.focus();
                isSubmitting = false; 
                return;
            }

            if (!validateForm()) {
                alert('กรุณากรอกข้อมูลให้ครบถ้วน');
                isSubmitting = false;
                return;
            }

            // ตรวจสอบบันทึกซ้ำ
            const isDuplicate = document.getElementById('isDuplicate').value === 'true';
            const remark = document.getElementById('remark').value;

            // ระบุเหตุผลบันทึกซ้ำ
            if (isDuplicate && (!remark || !remark.trim())) {
                alert('กรุณาระบุสาเหตุการบันทึกซ้ำ');
                document.getElementById('remark').focus();
                isSubmitting = false;
                return;
            }

            const formData = {
                RSNCode: rsnCodeInput.value,
                DocNo: document.getElementById('docNo').value,
                ItemSize: document.getElementById('sizeIn').value,
                MachineCode: document.getElementById('machineCode').value,
                CoilNo: document.getElementById('coilNo').value,
                CurrentStep: document.getElementById('step').value,
                PartName: document.getElementById('grade').value,
                PlateNo: document.getElementById('reelNumber').value,
                TimeIn: formatDateTime(document.getElementById('timeIn').value),
                PrintTime: formatDateTime(document.getElementById('timeOut').value),
                TimeInManual: formatDateTime(document.getElementById('timeInManual').value),
                TimeOutManual: formatDateTime(document.getElementById('timeOutManual').value),
                printWeight: document.getElementById('printWeight').value,
                SkinStatus: document.getElementById('skinStatus').value,
                MaterialType: document.getElementById('materialType').value,
                OvenNumber: document.getElementById('oven').value,
                TimeInForm: formatDateTime(document.getElementById('ovenTimeIn').value),
                TimeOutForm: formatDateTime(document.getElementById('ovenTimeOut').value),
                Remark: isDuplicate ? document.getElementById('remark').value : null
            };

            console.log('Form submitted with data:', formData);

            // เลือก API ตามสถานะการบันทึกซ้ำ
            const apiEndpoint = isDuplicate 
                ? '/api/production/reports/daily-submit-duplicate' 
                : '/api/production/reports/daily-submit';

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'บันทึกข้อมูลไม่สำเร็จ');
            }

            const result = await response.json();

            if (result.success) {
                alert('บันทึกข้อมูลสำเร็จ');
                window.location.reload();
            } else {
                throw new Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            // alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);

            // ตรวจสอบว่าเป็นข้อผิดพลาดกรณี RSNCode ซ้ำหรือไม่
            if (error.message && error.message.includes('บาร์โค้ดนี้เคยถูกบันทึกไปแล้ว')) {
                // แสดง confirm dialog แทน alert
                if (confirm('บาร์โค้ดนี้เคยถูกบันทึกไปแล้ว\nคลิก OK เพื่อบันทึกซ้ำ หรือ Cancel เพื่อยกเลิก')) {
                    // เลือก OK - แสดงช่อง Remark
                    document.getElementById('isDuplicate').value = 'true';
                    
                    // เพิ่มการแสดง duplicateAlert
                    const duplicateAlert = document.getElementById('duplicateAlert');
                    if (duplicateAlert) {
                        duplicateAlert.style.display = '';
                    }
                    
                    const remarkRow = document.getElementById('remarkRow');
                    if (remarkRow) {
                        remarkRow.style.display = '';
                        document.getElementById('remark').setAttribute('required', '');
                        document.getElementById('remark').focus();
                    }
                } else {
                    // เลือก Cancel - ยกเลิกการบันทึก
                    document.getElementById('isDuplicate').value = 'false';

                    document.getElementById('remark').removeAttribute('required');
                }
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message)
            }
        } finally {
            isSubmitting = false;
        }
    });
}

// เพิ่ม +7 hours
function formatDateTime(inputTime) {
    if (!inputTime) return null;
    
    // แปลงเป็น Date object
    const date = new Date(inputTime);
    
    // ปรับวันที่ให้เป็น UTC ก่อน แล้วค่อยบวก 7 ชั่วโมง
    const utcDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000) + (7 * 60 * 60 * 1000));
    
    // แปลงเป็น SQL datetime format (YYYY-MM-DD HH:mm:ss.SSS)
    return utcDate.toISOString().slice(0, 23).replace('T', ' ');
}

// format รูปแบบเวลา
function formatDisplayDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}