async function loadInitialData() {
    try {
        const response = await fetch('/api/annealing/v2/initial-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // console.log('Loaded data:', data); // เพิ่ม log ดูข้อมูลที่ได้

        if (data && data.length > 0) {
            const item = data[0];
            // เพิ่มการตรวจสอบ element ก่อนเซ็ตค่า
            const elements = {
                'docNoV2': item.DocNo,
                'gradeV2': item.PartName,
                'sizeV2': item.SizeIn,
                'weightInputV2': item.ItemQty,
                'coilNoV2': item.CoilNo,
                'stepV2': item.CurrentStep,
                'weightOutputV2': item.printWeight,
                'reelNumberV2': item.PlateNo
            };

            // เซ็ตค่าพร้อมตรวจสอบ
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value || '';
                } else {
                    console.warn(`Element with id '${id}' not found`);
                }
            });
        }
    } catch (error) {
        console.error('Error loading data:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}


function validateForm() {
    const requiredFields = ['rsnCodeV2', 'docNoV2', 'gradeV2', 'sizeV2', 'weightInputV2', 'coilNoV2'];
    for (const field of requiredFields) {
        const value = document.getElementById(field).value;
        if (!value || value.trim() === '') {
            return false;
        }
    }
    return true;
}

// Event Listeners จะทำงานเมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    const rsnCodeInput = document.getElementById('rsnCodeV2');
    const dataRow = document.getElementById('dataRow');

    // ไม่ต้องโหลดข้อมูลแต่แรก

    if (rsnCodeInput) {
        // เมื่อคลิกที่ช่อง input
        rsnCodeInput.addEventListener('focus', function() {
            this.select() // ล้างข้อความทั้งหมด (ถ้ามี)
            this.value = '' // ล้างค่าเก่า
        })

        // event keypress รองรับการสแกน
        rsnCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault() // ป้องกันการ submit form
                this.blur() // ออกจาก focus
                // ทริกเกอร์ event change 
                const event = new Event('change')
                this.dispatchEvent(event)
            }
        })

        // เมื่อสแกนบาร์โค้ดและมีการเปลี่ยนแปลงค่า (จากการสแกนหรือพิมพ์)
        rsnCodeInput.addEventListener('change', async function() {
            const code = this.value.trim()

            if (code) {
                try {
                    // console.log('Scanning code:', code)
                    // เรียก API เพื่อดึงข้อมูลจาก RSNCode
                    const response = await fetch(`/api/annealing/v2/get-by-rsncode/${code}`);

                    if (!response.ok) {
                        throw new Error('Failed to fetch data')
                    }

                    const data = await response.json()
                    
                    if (data) {
                        // แสดงแถวข้อมูล
                        dataRow.style.display = ''

                        // เติมข้อมูลลงฟอร์ม
                        document.getElementById('docNoV2').value = data.DocNo || ''
                        document.getElementById('gradeV2').value = data.PartName || ''
                        document.getElementById('sizeV2').value = data.SizeIn || ''
                        document.getElementById('weightInputV2').value = data.ItemQty || ''
                        document.getElementById('coilNoV2').value = data.CoilNo || ''
                        document.getElementById('stepV2').value = data.CurrentStep || ''
                        document.getElementById('weightOutputV2').value = data.printWeight || ''
                        document.getElementById('reelNumberV2').value = data.PlateNo || ''
                        document.getElementById('detailDateInputV2').value = dateUtils.formatDateThai(data.TimeIn) || '';
                        document.getElementById('printTimeV2').value = dateUtils.formatDateThai(data.PrintTime) || ''; 
                    } else {
                        throw new Error('No data found')
                    }
                } catch (error) {
                    console.error('Error fetching data:', error)
                    alert('ไม่พบข้อมูลสำหรับ Code นี้')
                    this.value = '' // ล้างค่าถ้าไม่พบข้อมูล
                    this.focus() // focus กลับไปที่ช่อง input
                    dataRow.style.display = 'none' // ซ่อนข้อมูล

                    // ล้างข้อมูลที่อาจแสดงผลอยู่
                    clearFormData()
                }
            } else {
                dataRow.style.display = 'none'
                clearFormData()
            }
        })

        // ฟังก์ชั่นล้างข้อมูลในฟอร์ม
        function clearFormData() {
            const fields = ['docNoV2', 'gradeV2', 'sizeV2', 'weightInputV2', 'coilNoV2',
                'stepV2', 'weightOutputV2', 'reelNumberV2', 'detailDateInputV2', 
                'washingPoundV2', 'cleanLinessV2', 'wireWoundV2', 'rustV2', 'bendV2', 'headPumpV2', 'entryStatusV2'];
            fields.forEach(field => {
                const element = document.getElementById(field)
                if (element) element.value = ''
            })
        }
    }

    // จัดการ submit form
    const form = document.getElementById('annealingFormV2');
    form.addEventListener('submit', async function(e) {
        e.preventDefault()

        // ตรวจสอบว่ามี RSNCode
        if (!rsnCodeInput.value) {
            alert('กรุณากรอก Code')
            rsnCodeInput.focus()
            return
        }

        if (!validateForm()) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน')
            return
        }

        const formData = {
            docNo: document.getElementById('docNoV2').value,
            PartName: document.getElementById('gradeV2').value,  
            SizeIn: document.getElementById('sizeV2').value,    
            ItemQty: document.getElementById('weightInputV2').value, 
            CoilNo: document.getElementById('coilNoV2').value,
            CurrentStep: document.getElementById('stepV2').value, 
            labelNumber: document.getElementById('labelNumberV2').value,
            PrintTime: document.getElementById('printTimeV2').value, 
            TimeIn: document.getElementById('detailDateInputV2').value,
            WashingPound: document.getElementById('washingPoundV2').value,
            CleanLiness: document.getElementById('cleanLinessV2').value,
            wireWound: document.getElementById('wireWoundV2').value,
            rust: document.getElementById('rustV2').value,
            bend: document.getElementById('bendV2').value,
            headPump: document.getElementById('headPumpV2').value,
            entryStatus: document.getElementById('entryStatusV2').value,
            printWeight: document.getElementById('weightOutputV2').value,
            PlateNo: document.getElementById('reelNumberV2').value,
            RSNCode: rsnCodeInput.value 
        };

        try {
            // เปลี่ยน URL เป็น v2
            const response = await fetch('/production/annealing/v2/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })

            if (!response.ok) {
                throw new Error('Code นี้เคยถูกบันทึกไปแล้วไม่สามารถบันทึกซ้ำได้');
                // throw new Error(`HTTP Error Status : ${response.status}`)
            }

            const result = await response.json()

            if (result.success) {
                alert('บันทึกข้อมูลสำเร็จ')
                window.location.reload()
            } else {
                throw new Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ')
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
        }

    })



    // โค้ดเดิม
    //loadInitialData(); ปิดไว้
    // const form = document.getElementById('annealingForm');
    // form.addEventListener('submit', submitForm);
});
