document.addEventListener('DOMContentLoaded', function() {
    if (typeof $ !== 'undefined') {
        $(document).ready(function() {
            // Load initial data
            function loadQuotationData(filters = {}) {
                $.ajax({
                    url: '/api/quotation-history/search',
                    method: 'GET',
                    data: filters,
                    success: function(data) {
                        populateTable(data);
                    },
                    error: function(err) {
                        console.error('Error loading data:', err);
                    }
                });
            }
 
            // Populate table with data
            function populateTable(data) {
                const tbody = $('#quotationTable tbody');
                tbody.empty();
            
                data.forEach(quotation => {
                    // คำนวณราคารวมใหม่
                    const totalPrice = 
                        (parseFloat(quotation.RollerPrice) || 0) +
                        (parseFloat(quotation.CRDPrice) || 0) +
                        (parseFloat(quotation.ShapePrice) || 0) +
                        (parseFloat(quotation.CuttingPrice) || 0) +
                        (parseFloat(quotation.BendingPrice) || 0);
            
                    const row = `
                        <tr>
                            <td>${quotation.QuotationNo || '-'}</td>
                            <td>${new Date(quotation.QuotationDate).toLocaleDateString()}</td>
                            <td>${quotation.CustomerName}</td>
                            <td>
                                ${quotation.GradeName || '-'} / 
                                ${quotation.ShapeName || '-'} / 
                                ${quotation.Size || '-'} mm
                            </td>
                            <td>${totalPrice.toLocaleString()} บาท</td>
                            <td>
                                <span class="badge badge-${getStatusBadgeClass(quotation.Status)}">
                                    ${getStatusText(quotation.Status)}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-info btn-sm" onclick="showDetails(${quotation.Id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
 
            // Helper functions for status display
            function getStatusBadgeClass(status) {
                switch(status) {
                    case 'Draft': return 'secondary';
                    case 'Pending': return 'warning';
                    case 'Approved': return 'success';
                    case 'Rejected': return 'danger';
                    default: return 'secondary';
                }
            }
 
            function getStatusText(status) {
                switch(status) {
                    case 'Draft': return 'แบบร่าง';
                    case 'Pending': return 'รออนุมัติ';
                    case 'Approved': return 'อนุมัติแล้ว';
                    case 'Rejected': return 'ไม่อนุมัติ';
                    default: return status;
                }
            }
 
            // Show quotation details
            window.showDetails = function(id) {
                currentQuotationId = id;
                $.ajax({
                    url: `/api/quotation-history/${id}`,
                    method: 'GET',
                    success: function(data) {
                        const modalContent = `
                            <div class="container-fluid">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>เลขที่:</strong> ${data.QuotationNo || '-'}</p>
                                        <p><strong>วันที่:</strong> ${new Date(data.QuotationDate).toLocaleDateString()}</p>
                                        <p><strong>ลูกค้า:</strong> ${data.CustomerName}</p>
                                        <p><strong>วัสดุ Tooling:</strong> ${data.materialId === 2 ? 'Carbide' : 'SKD11'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>เกรดวัสดุ:</strong> ${data.GradeName || '-'}</p>
                                        <p><strong>รูปทรง:</strong> ${data.ShapeName || '-'}</p>
                                        <p><strong>ขนาด:</strong> ${data.Size || '-'} mm</p>
                                        <p><strong>จำนวน:</strong> ${data.Quantity || '-'} kg</p>
                                    </div>
                                </div>
                                <hr>
                                <div class="row">
                                    <div class="col-md-12">
                                        <h6 class="font-weight-bold">รายละเอียดราคา</h6>
                                        <table class="table table-bordered">
                                            <tr>
                                                <td width="30%">ราคา Roller</td>
                                                <td class="text-right" width="20%">${data.RollerPrice ? data.RollerPrice.toLocaleString() : '-'} บาท</td>
                                                <td>${data.rollerDetails || `${data.RollerType}: ${data.RollerPrice ? data.RollerPrice.toLocaleString() : '-'} บาท`}</td>
                                            </tr>
                                            <tr>
                                                <td>Grinding (Roller)</td>
                                                <td class="text-right">${data.GrindingRollerPrice ? data.GrindingRollerPrice.toLocaleString() : '-'} บาท</td>
                                                <td>Grinding Roller: ${data.GrindingRollerPrice ? data.GrindingRollerPrice.toLocaleString() : '-'} บาท</td>
                                            </tr>
                                            <tr>
                                                <td>ราคา CRD</td>
                                                <td class="text-right">${data.CRDPrice ? data.CRDPrice.toLocaleString() : '-'} บาท</td>
                                                <td>${data.CRDType}: ${data.CRDPrice/4 ? (data.CRDPrice/4).toLocaleString() : '-'} × 4 ชิ้น = ${data.CRDPrice ? data.CRDPrice.toLocaleString() : '-'} บาท</td>
                                            </tr>
                                            <tr>
                                                <td>Grinding (CRD)</td>
                                                <td class="text-right">${data.GrindingCRDPrice ? data.GrindingCRDPrice.toLocaleString() : '-'} บาท</td>
                                                <td>Grinding CRD: ${data.GrindingCRDPrice ? data.GrindingCRDPrice.toLocaleString() : '-'} บาท</td>
                                            </tr>
                                            <tr>
                                                <td>ราคา Shape</td>
                                                <td class="text-right">${data.ShapePrice ? data.ShapePrice.toLocaleString() : '-'} บาท</td>
                                                <td>${data.ShapeName} (${data.IsSpecial ? 'Special' : 'Normal'}): ${data.ShapePrice ? data.ShapePrice.toLocaleString() : '-'} บาท</td>
                                            </tr>
                                            <tr>
                                                <td>ราคา Cutting</td>
                                                <td class="text-right">${data.CuttingPrice ? data.CuttingPrice.toLocaleString() : '-'} บาท</td>
                                                <td>บูทตัด: ${data.BootPrice ? data.BootPrice.toLocaleString() : '-'} + มีดตัด: ${data.KnifePrice ? data.KnifePrice.toLocaleString() : '-'} = ${data.CuttingPrice ? data.CuttingPrice.toLocaleString() : '-'} บาท</td>
                                            </tr>
                                            <tr>
                                                <td>ราคา Bending</td>
                                                <td class="text-right">${data.BendingPrice ? data.BendingPrice.toLocaleString() : '-'} บาท</td>
                                                <td>${data.BendingDetails || `ชุดดัด (ขนาด ${data.Size}mm): ${data.BendingPrice ? data.BendingPrice.toLocaleString() : '-'} บาท`}</td>
                                            </tr>
                                            <tr class="table-primary">
                                                <td><strong>ราคารวม</strong></td>
                                                <td class="text-right" colspan="2"><strong>${calculateTotal(data).toLocaleString()} บาท</strong></td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        `;
                        $('#modalContent').html(modalContent);
                        $('#detailModal').modal('show');
                    },
                    error: function(err) {
                        console.error('Error loading details:', err);
                    }
                });
            }
 
            // Search button click handler
            $('#searchBtn').click(function() {
                const filters = {
                    startDate: $('#startDate').val(),
                    endDate: $('#endDate').val(),
                    customerName: $('#customerSearch').val(),
                    status: $('#statusFilter').val()
                };
                loadQuotationData(filters);
            });
 
            // Export PDF button click handler
            $('#exportPdfBtn').click(function() {
                if (currentQuotationId) {
                    exportToPDF(currentQuotationId);
                } else {
                    alert('กรุณาเลือกใบเสนอราคาก่อน');
                }
            });
 
            // Load initial data
            loadQuotationData();
        });
    } else {
        console.error('jQuery is not loaded');
    }
 });

 function calculateTotal(data) {
    return (
        (parseFloat(data.RollerPrice) || 0) +
        (parseFloat(data.GrindingRollerPrice) || 0) +
        (parseFloat(data.CRDPrice) || 0) +
        (parseFloat(data.GrindingCRDPrice) || 0) +
        (parseFloat(data.ShapePrice) || 0) +
        (parseFloat(data.CuttingPrice) || 0) +
        (parseFloat(data.BendingPrice) || 0)
    );
}


async function exportToPDF(quotationId) {
    try {
        const response = await fetch(`/api/quotation-history/${quotationId}`);
        if (!response.ok) {
            throw new Error('Error fetching quotation data');
        }
        const data = await response.json();

        const doc = new window.jspdf.jsPDF();
        doc.setFont('helvetica');

        // หัวกระดาษ
        doc.setFontSize(20);
        doc.text('QUOTATION', 105, 20, { align: 'center' });

        // ข้อมูลทั่วไป
        doc.autoTable({
            startY: 30,
            body: [
                [`No.: ${data.QuotationNo || '-'}`],
                [`Date: ${new Date(data.QuotationDate).toLocaleDateString()}`],
                [`Customer: ${data.CustomerName}`]
            ],
            theme: 'plain',
            styles: { 
                font: 'helvetica',
                fontSize: 12 
            }
        });

        // รายละเอียดสินค้า
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Item', 'Details']],
            body: [
                ['Material Grade', data.GradeName || '-'],
                ['Shape', data.ShapeName || '-'],
                ['Size', `${data.Size || '-'} mm`],
                ['Quantity', `${data.Quantity || '-'} kg`]
            ],
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 12
            },
            headStyles: { 
                fillColor: [41, 128, 185], 
                textColor: 255,
                fontStyle: 'bold'
            }
        });

        // รายละเอียดราคา
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Item', 'Price (THB)', 'Details']],
            body: [
                ['Roller Price', formatPrice(data.RollerPrice), 
                    `${data.RollerType || ''}: ${formatPrice(data.RollerPrice)}`],
                ['CRD Price', formatPrice(data.CRDPrice),
                    `${data.CRDType || ''}: ${formatPrice(data.CRDPrice/4)} × 4 = ${formatPrice(data.CRDPrice)}`],
                ['Shape Price', formatPrice(data.ShapePrice),
                    `${data.ShapeName || ''}: ${formatPrice(data.ShapePrice)}`],
                ['Cutting Price', formatPrice(data.CuttingPrice),
                    `Boot: ${formatPrice(data.BootPrice)} + Knife: ${formatPrice(data.KnifePrice)} = ${formatPrice(data.CuttingPrice)}`],
                ['Bending Price', formatPrice(data.BendingPrice),
                    `Size ${data.Size || ''}mm: ${formatPrice(data.BendingPrice)}`]
            ],
            foot: [['Total', formatPrice(calculateTotal(data)), '']],
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 10,
                cellWidth: 'wrap'
            },
            headStyles: { 
                fillColor: [41, 128, 185], 
                textColor: 255,
                fontStyle: 'bold'
            },
            footStyles: { 
                fillColor: [220, 220, 220], 
                fontStyle: 'bold' 
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 40 },
                2: { cellWidth: 'auto' }
            }
        });

        // บันทึก PDF
        doc.save(`quotation-${data.QuotationNo || 'export'}.pdf`);

    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error creating PDF');
    }
}
// ฟังก์ชัน format ราคา
function formatPrice(price) {
    if (!price) return '-';
    return price.toLocaleString();
}