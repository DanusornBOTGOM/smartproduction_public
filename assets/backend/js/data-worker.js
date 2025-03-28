self.onmessage = function(e) {
    if (e.data.action === 'process') {
      const processedData = processData(e.data.data);
      self.postMessage(processedData);
    }
  };
  
  function processData(data) {
    // ใส่โค้ดการประมวลผลข้อมูลที่นี่
    // ตัวอย่าง:
    return filterAndProcessData(data, e.data.startDate, e.data.endDate, e.data.sectionID);
  }
  
  function filterAndProcessData(data, startDate, endDate, sectionID) {
    // ใส่โค้ดฟังก์ชัน filterAndProcessData ที่มีอยู่แล้วที่นี่
  }