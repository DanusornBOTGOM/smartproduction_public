document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reworkForm');
    
    // โหลด Machine Codes ตอนเริ่มต้น
    loadMachineCodes();
    
    // ฟังก์ชั่นโหลด Machine Codes จาก API
    async function loadMachineCodes() {
        try {
            const response = await fetch('/api/production/rework/data-workcenters');
            
            if (!response.ok) {
                throw new Error('Failed to fetch machine codes');
            }
            
            const machines = await response.json();
            const machineSelect = document.getElementById('machineCode');
            
            // เพิ่มตัวเลือกลงใน dropdown
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.MachineCode;
                option.textContent = `${machine.MachineCode}`;
                option.dataset.workcenterId = machine.workcenterId; // เก็บ workcenterId ไว้ใช้ตอน submit
                machineSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading machine codes:', error);
            alert('ไม่สามารถโหลดรายการเครื่องจักรได้');
        }
    }
    
    // ล้างฟอร์ม
    window.resetForm = function() {
        form.reset();
        // ต้องมั่นใจว่า reworkStatus เป็น 1 เสมอ
        document.getElementById('reworkStatus').value = "1";
    }
    
    // จัดการ submit form
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // ตรวจสอบฟอร์ม
            if (!validateForm()) {
                return;
            }
            
            // ดึง workcenterId จาก option ที่เลือก
            const machineSelect = document.getElementById('machineCode');
            const selectedOption = machineSelect.options[machineSelect.selectedIndex];
            const workcenterId = selectedOption.dataset.workcenterId || '';
            
            // สร้าง FormData โดยไม่รวม RSNCodeRef2 และ PlateNo
            const formData = {
                DocNo: document.getElementById('docNo').value.trim(),
                PartName: document.getElementById('grade').value.trim(),
                SizeIn: document.getElementById('sizeIn').value.trim(),
                ItemQty: parseFloat(document.getElementById('weightIn').value),
                CoilNo: document.getElementById('coilNo').value.trim(),
                MachineCode: machineSelect.value,
                workcenterId: workcenterId,
                SizeOut: document.getElementById('sizeOut').value.trim(),
                Remark: document.getElementById('remark').value.trim(),
                TimeIn: new Date().toISOString() // เพิ่มเวลาปัจจุบัน
            };
            
            try {
                const response = await fetch('/api/production/rework/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    alert('บันทึกข้อมูลสำเร็จ');
                    window.location.href = '/api/production/rework/records';
                } else {
                    throw new Error(result.message || 'บันทึกข้อมูลไม่สำเร็จ');
                }
                
            } catch (error) {
                console.error('Error submitting form:', error);
                alert(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }
    
    // ตรวจสอบความถูกต้องของฟอร์ม
    function validateForm() {
        // ตรวจสอบฟิลด์ที่จำเป็น
        const requiredFields = ['docNo', 'grade', 'sizeIn', 'weightIn', 'machineCode'];
        let isValid = true;
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });
        
        // ตรวจสอบค่าตัวเลข
        const weightField = document.getElementById('weightIn');
        if (weightField.value && (isNaN(weightField.value) || parseFloat(weightField.value) <= 0)) {
            weightField.classList.add('is-invalid');
            isValid = false;
        }
        
        if (!isValid) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
        }
        
        return isValid;
    }
});