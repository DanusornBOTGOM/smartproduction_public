const sql = require('mssql/msnodesqlv8');
const {
    connectSaleSql
} = require('../../../config/sqldb_dbconfig');

class SaleRepository {
    async findAllCustomers() {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .query(`SELECT SpecialCustomerId, CompanyName, ContactName, 
                ContactPhone, MarketSegment, MainProduct, Inquiry, 
                Application, Details, Remark, SalesRepId, SalesRepName, 
                CreatedAt, UpdatedAt 
                FROM vw_SpecialCustomersDetails 
                ORDER BY CreatedAt DESC`);
        return result.recordset;
    }

    async findAllUsers() {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .query('SELECT * FROM [Production_Analytics].[dbo].[Users]');
        return result.recordset;
    }

    async createMarketSegment(segmentName) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('segmentName', sql.NVarChar, segmentName)
            .query('INSERT INTO MarketSegments (SegmentName) VALUES (@segmentName)');
    }

    async deleteMarketSegment(segmentId) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('segmentId', sql.Int, segmentId)
            .query('DELETE FROM MarketSegments WHERE SegmentId = @segmentId');
    }

    async createSalesRep(data) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('firstName', sql.NVarChar, data.firstName)
            .input('lastName', sql.NVarChar, data.lastName)
            .input('email', sql.NVarChar, data.email)
            .input('phone', sql.NVarChar, data.phone)
            .query(`
                INSERT INTO SalesRepresentatives 
                (FirstName, LastName, Email, Phone, IsActive) 
                VALUES (@firstName, @lastName, @email, @phone, 1)
            `);
    }

    async updateSalesRep(salesRepId, data) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('salesRepId', sql.Int, salesRepId)
            .input('firstName', sql.NVarChar, data.firstName)
            .input('lastName', sql.NVarChar, data.lastName)
            .input('email', sql.NVarChar, data.email)
            .input('phone', sql.NVarChar, data.phone)
            .query(`
                UPDATE SalesRepresentatives
                SET FirstName = @firstName,
                    LastName = @lastName,
                    Email = @email,
                    Phone = @phone
                WHERE SalesRepId = @salesRepId
            `);
    }

    async deleteSalesRep(salesRepId) {
        const pool = await connectSaleSql();
        await pool.request()
            .input('salesRepId', sql.Int, salesRepId)
            .query('UPDATE SalesRepresentatives SET IsActive = 0 WHERE SalesRepId = @salesRepId');
    }

    async findCustomerById(customerId) {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .input('CustomerId', sql.Int, customerId)
            .query(`
                SELECT sc.*, c.CompanyName, 
                    CONCAT(co.FirstName, ' ', co.LastName) AS ContactName,
                    co.Phone AS ContactPhone, 
                    ms.SegmentName AS MarketSegment,
                    p.ProductName AS MainProduct, 
                    CONCAT(sr.FirstName, ' ', sr.LastName) AS SalesRepName
                FROM SpecialCustomers sc
                JOIN Companies c ON sc.CompanyId = c.CompanyId
                JOIN Contacts co ON sc.ContactId = co.ContactId
                JOIN MarketSegments ms ON sc.SegmentId = ms.SegmentId
                LEFT JOIN Products p ON sc.MainProductId = p.ProductId
                JOIN SalesRepresentatives sr ON sc.SalesRepId = sr.SalesRepId
                WHERE sc.SpecialCustomerId = @CustomerId
            `);
        return result.recordset[0];
    }

    async findAllSalesReps() {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .query(`
                SELECT SalesRepId, FirstName, LastName, 
                    CONCAT(FirstName, ' ', LastName) AS FullName 
                FROM SalesRepresentatives 
                WHERE IsActive = 1
            `);
        return result.recordset;
    }

    async findAllMarketSegments() {
        const pool = await connectSaleSql();
        const result = await pool.request()
            .query(`SELECT SegmentId, SegmentName 
                   FROM [Sale].[dbo].[MarketSegments] 
                   ORDER BY SegmentId`);
        return result.recordset;
    }

    async createCustomer(data, transaction) {
        // Company
        const companyResult = await transaction.request()
            .input('CompanyName', sql.NVarChar, data.CompanyName)
            .input('ContactName', sql.NVarChar, data.ContactName)
            .input('Phone', sql.NVarChar, data.ContactPhone)
            .input('CreatedBy', sql.Int, 1)
            .query(`
                INSERT INTO Companies (CompanyName, ContactName, Phone, CreatedBy)
                OUTPUT INSERTED.CompanyId
                VALUES (@CompanyName, @ContactName, @Phone, @CreatedBy)
            `);

        const companyId = companyResult.recordset[0].CompanyId;

        // Contact
        const [firstName, ...lastNameParts] = data.ContactName.split(' ');
        const lastName = lastNameParts.join(' ');
        const contactResult = await transaction.request()
            .input('CompanyId', sql.Int, companyId)
            .input('FirstName', sql.NVarChar, firstName)
            .input('LastName', sql.NVarChar, lastName)
            .input('Phone', sql.NVarChar, data.ContactPhone)
            .input('CreatedBy', sql.Int, 1)
            .query(`
                INSERT INTO [Sale].[dbo].[Contacts] 
                (CompanyId, FirstName, LastName, Phone, CreatedBy)
                OUTPUT INSERTED.ContactId
                VALUES (@CompanyId, @FirstName, @LastName, @Phone, @CreatedBy)
            `);

        const contactId = contactResult.recordset[0].ContactId;

        // Product (if exists)
        let mainProductId = null;
        if (data.MainProduct) {
            const productResult = await transaction.request()
                .input('ProductName', sql.NVarChar, data.MainProduct)
                .input('Description', sql.NVarChar, `Description for ${data.MainProduct}`)
                .query(`
                    INSERT INTO Products (ProductName, Description, IsActive)
                    OUTPUT INSERTED.ProductId
                    VALUES (@ProductName, @Description, 1)
                `);
            mainProductId = productResult.recordset[0].ProductId;
        }

        // Special Customer
        await transaction.request()
            .input('CompanyId', sql.Int, companyId)
            .input('ContactId', sql.Int, contactId)
            .input('SalesRepId', sql.Int, parseInt(data.SaleName))
            .input('SegmentId', sql.Int, parseInt(data.CategoryMarket))
            .input('MainProductId', sql.Int, mainProductId)
            .input('Inquiry', sql.NVarChar, data.Inquiry)
            .input('Application', sql.NVarChar, data.Application)
            .input('Details', sql.NVarChar, data.Detail)
            .input('Remark', sql.NVarChar, data.Remark)
            .query(`
                INSERT INTO SpecialCustomers 
                (CompanyId, ContactId, SalesRepId, SegmentId, MainProductId, 
                Inquiry, Application, Details, Remark, Status, CreatedAt, CreatedBy)
                VALUES 
                (@CompanyId, @ContactId, @SalesRepId, @SegmentId, @MainProductId,
                @Inquiry, @Application, @Details, @Remark, 'New', GETDATE(), 1)
            `);
    }

    async updateCustomer(customerId, data, transaction) {
        // Update Special Customers
        await transaction.request()
            .input('CustomerId', sql.Int, customerId)
            .input('SegmentId', sql.Int, parseInt(data.CategoryMarket))
            .input('MainProduct', sql.NVarChar, data.MainProduct)
            .input('Inquiry', sql.NVarChar, data.Inquiry)
            .input('Application', sql.NVarChar, data.Application)
            .input('Details', sql.NVarChar, data.Details)
            .input('Remark', sql.NVarChar, data.Remark)
            .input('SalesRepId', sql.Int, parseInt(data.SaleName))
            .query(`
                UPDATE SpecialCustomers
                SET SegmentId = @SegmentId,
                    MainProductId = (SELECT TOP 1 ProductId FROM Products WHERE ProductName = @MainProduct),
                    Inquiry = @Inquiry,
                    Application = @Application,
                    Details = @Details,
                    Remark = @Remark,
                    SalesRepId = @SalesRepId,
                    UpdatedAt = GETDATE(),
                    UpdatedBy = 1
                WHERE SpecialCustomerId = @CustomerId
            `);
    }

    async deleteCustomer(customerId, transaction) {
        // Get related IDs
        const customerInfo = await transaction.request()
            .input('CustomerId', sql.Int, customerId)
            .query(`
                SELECT CompanyId, ContactId, MainProductId
                FROM [Sale].[dbo].[SpecialCustomers]
                WHERE SpecialCustomerId = @CustomerId
            `);

        if (customerInfo.recordset.length === 0) {
            throw new Error('Customer not found');
        }

        const {
            CompanyId,
            ContactId,
            MainProductId
        } = customerInfo.recordset[0];

        // Delete in order
        await transaction.request()
            .input('CustomerId', sql.Int, customerId)
            .query('DELETE FROM SpecialCustomers WHERE SpecialCustomerId = @CustomerId');

        if (MainProductId) {
            await transaction.request()
                .input('ProductId', sql.Int, MainProductId)
                .query('DELETE FROM Products WHERE ProductId = @ProductId');
        }

        await transaction.request()
            .input('ContactId', sql.Int, ContactId)
            .query('DELETE FROM Contacts WHERE ContactId = @ContactId');

        await transaction.request()
            .input('CompanyId', sql.Int, CompanyId)
            .query('DELETE FROM Companies WHERE CompanyId = @CompanyId');
    }

    async createUser(data) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('username', sql.NVarChar, data.username)
            .input('password', sql.NVarChar, data.password)
            .input('role', sql.NVarChar, data.role)
            .query(`
                INSERT INTO [Production_Analytics].[dbo].[Users] 
                (Username, Password, Role)
                VALUES (@username, @password, @role) 
            `);
    }

    // ตรวจสอบ User เพิ่อใช้ในการลบ User ของ Sales-SpecialCustomers
    async findUserById(userId) {
        const pool = await connectSaleSql();
        try {
            // ใส่ console.log เพื่อดู query และ userId
            console.log('Finding user with ID:', userId);
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT * FROM [Production_Analytics].[dbo].[Users] 
                    WHERE ID = @userId
                `);
            
            // ใส่ console.log เพื่อดูผลลัพธ์
            console.log('Query result:', result.recordset);
            
            return result.recordset[0];
        } catch (error) {
            console.error('Database error - findUserById:', error);
            throw error;
        }
    }


        // ลบ User ของ Sales-SpecialCustomers
        async deleteUser(userId) {
            const pool = await connectSaleSql();
            try {
                console.log('Deleting user with ID:', userId);
                
                const result = await pool.request()
                    .input('userId', sql.Int, parseInt(userId)) // แปลงเป็น integer
                    .query(`
                        DELETE FROM [Production_Analytics].[dbo].[Users] 
                        WHERE ID = @userId;
                        
                        SELECT @@ROWCOUNT as count;
                    `);
                
                console.log('Delete result:', result);
                
                if (result.recordset[0].count === 0) {
                    throw new Error('User not found or could not be deleted');
                }
                
                return true;
            } catch (error) {
                console.error('Database error - deleteUser:', error);
                throw error;
            }
        }


    // แก้ไขสิทธิ์ User
    async updateUserPermissions(userId, permissions) {
        const pool = await connectSaleSql();
        return pool.request()
            .input('userId', sql.Int, userId)
            .input('permissions', sql.NVarChar, JSON.stringify(permissions))
            .query(`
                UPDATE [Production_Analytics].[dbo].[Users] 
                    SET Permissions = @permissions 
                    WHERE ID = @userId
            `);
    }

}

module.exports = SaleRepository;