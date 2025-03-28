class CauseController {
    constructor(causeService) {
        this.causeService = causeService;
    }

    async saveAllCauses(req, res) {
        try {
            const { data } = req.body;
            if (!Array.isArray(data) || data.length === 0) {
                return res.status(400).json({ error: 'Invalid data provided' });
            }

            const result = await this.causeService.saveAllCauses(data);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error in saveAllCauses:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCauses(req, res) {
        try {
            const { date } = req.query;
            const causes = await this.causeService.getCauses(date);
            res.json(causes);
        } catch (error) {
            console.error('Error in getCauses:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async updateCauses(req, res) {
        try {
            const { date, machineCode, docNo, problems } = req.body;
            const result = await this.causeService.updateCauses(date, machineCode, docNo, problems);
            res.json(result);
        } catch (error) {
            console.error('Error in updateCauses:', error);
            res.status(500).json({ error: error.message });
        }
    }
}