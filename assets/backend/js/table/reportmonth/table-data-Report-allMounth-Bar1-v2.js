async function fetchMonthlyData() {
    try {
        const url = new URL('http://192.168.1.214:5000/api/bar1/v2/monthlyData');
        url.searchParams.append('month', selectedMonth);
        url.searchParams.append('year', selectedYear);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            populateProductionTable(result.data);
        } else {
            throw new Error(result.error || 'Failed to fetch data');
        }
    } catch (err) {
        console.error('Error fetching monthly data:', err);
    }
}