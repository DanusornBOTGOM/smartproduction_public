class CauseService {
    constructor(db) {
        this.db = db;
    }

    async saveAllCauses(causesData) {
        const transaction = await this.db.beginTransaction();
        try {
            for (const item of causesData) {
                let cause = '';
                let totalDowntime = 0;
                
                if (item.problems && item.problems.length > 0) {
                    cause = item.problems.map(problem => {
                        totalDowntime += parseInt(problem.downtime) || 0;
                        return `${problem.description}`;
                    }).join('; ');
                }

                await transaction.request()
                    .input('Date', this.db.sql.Date, new Date(item.date))
                    .input('MachineCode', this.db.sql.NVarChar(50), item.machineCode)
                    .input('DocNo', this.db.sql.NVarChar(50), item.docNo)
                    .input('Cause', this.db.sql.NVarChar(500), cause)
                    .input('Downtime', this.db.sql.Float, totalDowntime)
                    .query(`
                        MERGE INTO [Production_Analytics].[dbo].[DailyProductionCauses] AS target
                        USING (VALUES (@Date, @MachineCode, @DocNo)) AS source (Date, MachineCode, DocNo)
                        ON target.Date = source.Date 
                        AND target.MachineCode = source.MachineCode 
                        AND target.DocNo = source.DocNo
                        WHEN MATCHED THEN
                            UPDATE SET 
                                Cause = @Cause,
                                Downtime = @Downtime,
                                UpdatedAt = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (Date, MachineCode, DocNo, Cause, Downtime)
                            VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime);
                    `);
            }
            
            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getCauses(date) {
        try {
            const result = await this.db.request()
                .input('Date', this.db.sql.Date, new Date(date))
                .query(`
                    SELECT MachineCode, DocNo, Cause, Downtime
                    FROM [Production_Analytics].[dbo].[DailyProductionCauses]
                    WHERE Date = @Date
                `);
            return result.recordset;
        } catch (error) {
            throw error;
        }
    }

    async updateCauses(date, machineCode, docNo, problems) {
        const transaction = await this.db.beginTransaction();
        try {
            // Delete existing causes
            await transaction.request()
                .input('Date', this.db.sql.Date, new Date(date))
                .input('MachineCode', this.db.sql.NVarChar(50), machineCode)
                .input('DocNo', this.db.sql.NVarChar(50), docNo)
                .query(`
                    DELETE FROM [Production_Analytics].[dbo].[DailyProductionCauses]
                    WHERE Date = @Date AND MachineCode = @MachineCode AND DocNo = @DocNo
                `);

            // Insert new causes
            for (const problem of problems) {
                await transaction.request()
                    .input('Date', this.db.sql.Date, new Date(date))
                    .input('MachineCode', this.db.sql.NVarChar(50), machineCode)
                    .input('DocNo', this.db.sql.NVarChar(50), docNo)
                    .input('Cause', this.db.sql.NVarChar(500), problem.description)
                    .input('Downtime', this.db.sql.Int, problem.downtime)
                    .query(`
                        INSERT INTO [Production_Analytics].[dbo].[DailyProductionCauses]
                        (Date, MachineCode, DocNo, Cause, Downtime)
                        VALUES (@Date, @MachineCode, @DocNo, @Cause, @Downtime)
                    `);
            }

            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = CauseService;