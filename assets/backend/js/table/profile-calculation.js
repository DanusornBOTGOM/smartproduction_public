document.addEventListener('DOMContentLoaded', function() {

    // ฟังก์ชันคำนวณราคา
    async function calculatePrice() {
        try {
            const form = document.getElementById('profileForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // แปลงค่าตัวเลข
            ['size', 'quantity', 'width', 'height', 'radius', 'tolerance'].forEach(field => {
                data[field] = parseFloat(data[field]) || 0;
            });

            // แปลงค่า boolean
            data.hasCutting = data.hasCutting === 'true';
            data.grindingLapOD = data.grindingLapOD === 'yes';

            // เพิ่ม categoryId
            const selectedGrade = document.getElementById('materialGrade').selectedOptions[0];
            if (selectedGrade) {
                data.categoryId = selectedGrade.getAttribute('data-category-id');
            }

            console.log('Sending data:', data);

            // แสดง loading
            document.getElementById('loadingIndicator').style.display = 'block';

            const response = await fetch('/api/calculate-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Received result:', result);


        } catch (error) {
            console.error('Error:', error);
            // แสดง error message
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        } finally {
            // ซ่อน loading
            document.getElementById('loadingIndicator').style.display = 'none';
        }
    }

});