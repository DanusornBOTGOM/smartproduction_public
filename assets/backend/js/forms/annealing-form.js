async function loadInitialData() {
    try {
        const response = await fetch('/api/annealing/initial-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // console.log('Loaded data:', data); // เพิ่ม log ดูข้อมูลที่ได้

        if (data && data.length > 0) {
            const item = data[0];
            // เพิ่มการตรวจสอบ element ก่อนเซ็ตค่า
            const elements = {
                'docNo': item.DocNo,
                'grade': item.PartName,
                'size': item.SizeIn,
                'weightInput': item.ItemQty,
                'coilNo': item.CoilNo,
                'step': item.CurrentStep,
                'weightOutput': item.printWeight,
                'reelNumber': item.PlateNo
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
    const requiredFields = ['rsnCode', 'docNo', 'grade', 'size', 'weightInput', 'coilNo'];
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
    const rsnCodeInput = document.getElementById('rsnCode')
    const dataRow = document.getElementById('dataRow')

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
                    const response = await fetch(`/api/annealing/get-by-rsncode/${code}`)

                    if (!response.ok) {
                        throw new Error('Failed to fetch data')
                    }

                    const data = await response.json()
                    
                    if (data) {
                        // แสดงแถวข้อมูล
                        dataRow.style.display = ''

                        // เติมข้อมูลลงฟอร์ม
                        document.getElementById('docNo').value = data.DocNo || ''
                        document.getElementById('grade').value = data.PartName || ''
                        document.getElementById('size').value = data.SizeIn || ''
                        document.getElementById('weightInput').value = data.ItemQty || ''
                        document.getElementById('coilNo').value = data.CoilNo || ''
                        document.getElementById('step').value = data.CurrentStep || ''
                        document.getElementById('weightOutput').value = data.printWeight || ''
                        document.getElementById('reelNumber').value = data.PlateNo || ''
                        document.getElementById('detailDateInput').value = dateUtils.formatDateThai(data.TimeIn) || '';
                        document.getElementById('printTime').value = dateUtils.formatDateThai(data.PrintTime) || '';  
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
            const fields = ['docNo', 'grade', 'size', 'weightInput', 'coilNo',
                'step', 'weightOutput', 'reelNumber', 'detailDateInput', 
                'washingPound', 'cleanLiness', 'wireWound', 'rust', 'bend', 'headPump', 'entryStatus'];
            fields.forEach(field => {
                const element = document.getElementById(field)
                if (element) element.value = ''
            })
        }
    }

    // จัดการ submit form
    const form = document.getElementById('annealingForm')
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
            docNo: document.getElementById('docNo').value,
            PartName: document.getElementById('grade').value,  
            SizeIn: document.getElementById('size').value,    
            ItemQty: document.getElementById('weightInput').value, 
            CoilNo: document.getElementById('coilNo').value,
            CurrentStep: document.getElementById('step').value, 
            labelNumber: document.getElementById('labelNumber').value,
            PrintTime: document.getElementById('printTime').value, 
            TimeIn: document.getElementById('detailDateInput').value, // เพิ่ม .value
            WashingPound: document.getElementById('washingPound').value,
            CleanLiness: document.getElementById('cleanLiness').value,
            wireWound: document.getElementById('wireWound').value,
            rust: document.getElementById('rust').value,
            bend: document.getElementById('bend').value,
            headPump: document.getElementById('headPump').value,
            entryStatus: document.getElementById('entryStatus').value,
            printWeight: document.getElementById('weightOutput').value,
            PlateNo: document.getElementById('reelNumber').value,
            RSNCode: rsnCodeInput.value 
        };

        try {
            // เปลี่ยน URL ตรงนี้
            const response = await fetch('/production/annealing/submit', { // เปลี่ยนจาก /backend เป็น /production
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
