const sql = require('mssql');
const {
    connectSaleSql
} = require('../../../config/sqldb_dbconfig');
const SaleRepository = require('../data-access/sale.repository');
const {
    use
} = require('passport');

class SaleService {
    constructor() {
        this.repository = new SaleRepository();
    }

    async getCustomers() {
        try {
            return await this.repository.findAllCustomers();
        } catch (error) {
            console.error('Error getting customers:', error);
            throw error;
        }
    }

    async getUsers() {
        try {
            return await this.repository.findAllUsers();
        } catch (error) {
            console.error('Error getting users:', error);
            throw error;
        }
    }

    async getCustomerById(customerId) {
        try {
            const customer = await this.repository.findCustomerById(customerId);
            if (!customer) {
                throw new Error('Customer not found');
            }
            return customer;
        } catch (error) {
            console.error('Error getting customer by id:', error);
            throw error;
        }
    }

    async getMarketSegments() {
        try {
            return await this.repository.findAllMarketSegments();
        } catch (error) {
            console.error('Error getting market segments:', error);
            throw error;
        }
    }

    async getSalesReps() {
        try {
            return await this.repository.findAllSalesReps();
        } catch (error) {
            console.error('Error getting sales representatives:', error);
            throw error;
        }
    }

    async createCustomer(customerData) {
        const pool = await connectSaleSql();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            await this.repository.createCustomer(customerData, transaction);
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('Error creating customer:', error);
            throw error;
        }
    }

    async updateCustomer(customerId, customerData) {
        const pool = await connectSaleSql();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            await this.repository.updateCustomer(customerId, customerData, transaction);
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating customer:', error);
            throw error;
        }
    }

    async deleteCustomer(customerId) {
        const pool = await connectSaleSql();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            await this.repository.deleteCustomer(customerId, transaction);
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting customer:', error);
            throw error;
        }
    }

    // Business logic methods
    async validateCustomerData(customerData) {
        const {
            CompanyName,
            ContactName,
            ContactPhone
        } = customerData;
        if (!CompanyName || !ContactName || !ContactPhone) {
            throw new Error('Missing required fields');
        }
    }

    async checkDuplicateCustomer(companyName) {
        const customers = await this.getCustomers();
        return customers.some(c => c.CompanyName === companyName);
    }

    async addMarketSegment(segmentName) {
        try {
            return await this.repository.createMarketSegment(segmentName);
        } catch (error) {
            console.error('Error in service - addMarketSegment:', error);
            throw error;
        }
    }

    async deleteMarketSegment(segmentId) {
        try {
            return await this.repository.deleteMarketSegment(segmentId);
        } catch (error) {
            console.error('Error in service - deleteMarketSegment:', error);
            throw error;
        }
    }

    async addSalesRep(salesRepData) {
        try {
            return await this.repository.createSalesRep(salesRepData);
        } catch (error) {
            console.error('Error in service - addSalesRep:', error);
            throw error;
        }
    }

    async deleteSalesRep(salesRepId) {
        try {
            return await this.repository.deleteSalesRep(salesRepId)
        } catch (error) {
            console.error('Error in service - deleteMarketSegment:', error);
            throw error;
        }
    }

    async updateSalesRep(salesRepId, salesRepData) {
        try {
            return await this.repository.updateSalesRep(salesRepId, salesRepData);
        } catch (error) {
            console.error('Error in service - updateSalesRep:', error);
            throw error;
        }
    }


    // เพิ่ม USER
    async addUser(userData) {
        try {
            return await this.repository.createUser(userData);
        } catch (error) {
            console.error('Error in service - addUser:', error);
            throw error;
        }
    }

    async deleteUser(userId) {
        try {
            console.log('Service deleteUser called with ID:', userId);
            
            // ตรวจสอบว่า userId ถูกส่งมาไหม
            if (!userId) {
                throw new Error('User ID is required');
            }
    
            // ตรวจสอบว่ามี user อยู่จริง
            const user = await this.repository.findUserById(userId);
            console.log('Found user:', user);
            
            if (!user) {
                throw new Error('User not found');
            }
    
            // เรียกใช้ repository เพื่อลบ user
            return await this.repository.deleteUser(userId);
        } catch (error) {
            console.error('Error in service - deleteUser:', error);
            throw error;
        }
    }

    // แก้ไขสิทธิ์ User
    async updateUserPermissions(userId, permissions) {
        try {
            return await this.repository.updateUserPermissions(userId, permissions);
        } catch (error) {
            console.error('Error in service - updateUserPermissions:', error);
            throw error;
        }
    }
}

module.exports = SaleService;