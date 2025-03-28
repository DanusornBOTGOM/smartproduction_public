// สำหรับ Profile-Calculation.ejs เพื่อทำ Hardcode แบบไม่ต้องพึ่ง Database เพราะไม่มีการเปลี่ยนแปลง
const SHAPE_METHODS = Object.freeze({
    INHOUSE: {
        value: 'inhouse',
        label: 'ทำเองในบริษัท',
        priceMultiplier: 0.5
    },
    SUPPLIER: {
        value: 'supplier',
        label: 'จ้าง Supplier',
        priceMultiplier: 1
    }
});