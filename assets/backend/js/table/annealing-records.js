// $(document).ready(function() {
//     $('#annealingTable').DataTable({
//         order: [[5, 'desc']], // เรียงตามวันที่ล่าสุด
//         pageLength: 25, // แสดง 25 รายการต่อหน้า
//         language: {
//             url: '//cdn.datatables.net/plug-ins/1.10.24/i18n/Thai.json'
//         },
//         dom: 'Bfrtip', // เพิ่มปุ่ม export
//         buttons: [
//             'copy', 'excel', 'pdf', 'print'
//         ],
//         initComplete: function () {
//             // เพิ่ม filter dropdown สำหรับคอลัมน์สถานะ
//             this.api().columns([6]).every(function () {
//                 var column = this;
//                 var select = $('<select><option value="">ทั้งหมด</option></select>')
//                     .appendTo($(column.header()))
//                     .on('change', function () {
//                         var val = $.fn.dataTable.util.escapeRegex(
//                             $(this).val()
//                         );
//                         column
//                             .search(val ? '^' + val + '$' : '', true, false)
//                             .draw();
//                     });

//                 column.data().unique().sort().each(function (d, j) {
//                     select.append('<option value="' + d + '">' + d + '</option>')
//                 });
//             });
//         }
//     });
// });