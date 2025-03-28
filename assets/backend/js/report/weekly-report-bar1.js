async function fetchWeeklyProductionData(startDate, endDate) {
    try {
        const url = new URL('/api/weeklyProductionDataCGM');
        url.searchParams.append('startDate', startDate);
        url.searchParams.append('endDate', endDate);

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Error fetching weekly production data:', error);
        throw error;
    }
}

function calculateCumulativePOP(data) {
    // reduce เพื่อรวมข้อมูลตาม MachineCode ของเครื่องจักร
    // acc คืออ็อบเจ็กต์สะสมและ item คือแต่ละอ็อบเจ็กต์ในอาร์เรย์
    const groupedData = data.reduce((acc, item) => {
        // ถ้า MachineCode นั้นยังไม่มีใน acc จะสร้างอ็อบเจ็กต์ใหม่เพื่อเก็บค่า totalAdjustedActual และ totalPlan
        if (item.MachineCode.startsWith('COM')) {
            if (!acc[item.MachineCode]) {
                acc[item.MachineCode] = { totalAdjustedActual: 0, totalPlan: 0, issues: []};
            }

            // การคำนวนยอดรวม
            // แปลงค่าจำนวนเป็นตัวเลขสำหรับ AdjustedActualQuantity และ PlanQuantity ถ้าแปลงไม่สำเร็จจะใช้ค่า 0 แทน
            const adjustedActual = parseFloat(item.adjustedActualQuantity) || 0;
            const plan = parseFloat(item.PlanQuantity) || 0;

            // บวกค่าที่คำนวณได้เข้ากับยอดรวมที่เก็บใน acc
            acc[item.MachineCode].totalAdjustedActual += adjustedActual;
            acc[item.MachineCode].totalPlan += plan;
            
            // แสดงผลระหว่างการคำนวณเพื่อดูค่าที่ได้
            console.log(`${item.MachineCode}: Adjusted Actual=${adjustedActual}, Plan=${plan}, Running total: Adjusted Actual=${acc[item.MachineCode].totalAdjustedActual}, Plan=${acc[item.MachineCode].totalPlan}`);
        }
        return acc;
    }, {}); 

    // สรุปข้อมูล
    // แปลง groupedData จากอ็อบเจ็กต์เป็นอาร์เรย์ของคู่ค่า (machine code และข้อมูลที่รวมกัน)
    const result = Object.entries(groupedData).map(([machineCode, data]) => {
        // คำนวณ Cumulative POP โดยใช้สูตร หาก totalPlan มากกว่า 0
        const cumulativePOP = data.totalPlan > 0 ? (data.totalAdjustedActual / data.totalPlan) * 100 : 0;
        // แสดงผลลัพท์สุดท้าย
        console.log(`${machineCode}: Final calculation - AdjustedActual=${data.totalAdjustedActual}, Plan=${data.totalPlan}, POP=${cumulativePOP.toFixed(1)}%`);
        return {
            MachineCode: machineCode,
            CumulativePOP: cumulativePOP, 
            totalAdjustedActual: data.totalAdjustedActual,
            totalPlan: data.totalPlan,
            Issues: data.issues
        };
        // ส่งคืนอาร์เรย์ที่เรียงลำดับตาม MachineCode พร้อมข้อมูลที่คำนวณเสร็จแล้ว
    }).sort((a, b) => a.MachineCode.localeCompare(b.MachineCode));

    return result; 
}