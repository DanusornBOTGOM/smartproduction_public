    // Import Express
    const express = require('express')
    const sql = require('mssql')

    // Import Moment เพื่อไว้จัดรูปแบบวันที่
    const moment = require('moment-timezone')
    moment.tz.setDefault("Asia/Bangkok")

    // Import CSV
    const createCsvWriter = require('csv-writer').createObjectCsvWriter

    //Import html=pdf
    const ejs = require('ejs')
    // const pdf = require('html-pdf')
    const path = require('path')

    const router = express.Router()

    // Import Postgres Mfg-cost
    const postgres = require('../config/postgresdb_dbconfig');

    router.get('/testpgDB', async (req, res) => {
        try {
            const result = await postgres.query('SELECT * FROM public.bdcause');
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching data from BDCAUSE:', err);
            res.status(500).send('Error fetching data from BDCAUSE');
        }
    })


    // Import SQL Menam
    const {
        connectDestSql, connectSaleSql
    } = require('../config/sqldb_dbconfig');
    let dbSQL;
    let dbSale;

    async function initializeDatabase() {
        try {
            dbSQL = await connectDestSql();
            if (dbSQL) {
                console.log('Connected to MSSQL API');
            } else {
                console.error('Failed to connect to MSSQL API');
            }

            // เชื่อมต่อกับฐานข้อมูล Sale
            dbSale = await connectSaleSql();
            if (dbSale) {
                console.log('Connected to MSSQL API (Sale)');
            } else {
                console.error('Failed to connect to MSSQL API (Sale)');
            }
        } catch (err) {
            console.error('Error initializing database connection:', err);
        }
    }

    initializeDatabase();

    // Import routes
    const productionRoutes = require('./backend/production');
    //const salesRoutes = require('./backend/sales');

    //import node-cache
    const NodeCache = require('node-cache');
    const {
        title
    } = require('process');
    const {
        request
    } = require('http');
    const myCache = new NodeCache({
        stdTTL: 300
    }); // แคช 5 นาที

    // Use routes
    router.use('/production', productionRoutes);
    // router.use('/sales', salesRoutes); // ยังไม่ใช้


    // หน้าหลักยังไม่มีอะไร เอาไว้ทำ Overall Factory
    router.get('', (req, res) => {
        res.render(
            'pages/backend/dashboard', {
                title: 'Dashboard',
                heading: 'Dashboard',
                layout: './layouts/backend',
                showNavbar: false
            }
        )
    })


    router.get('/drawing', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

            res.render('pages/backend/drawing', {
                title: 'แผนก: DRAWING',
                heading: 'DRAWING',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            })
    })

    router.get('/annealing', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        res.render('pages/backend/annealing', {
            title: 'แผนก: ANNEALING',
            heading: 'Annealing',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment
        });
    })

    async function getMachineCodes() {
        try {
            const result = await dbSQL.query(`
                SELECT DISTINCT MachineCode
                FROM [Production_Analytics].[dbo].[vDashboard]
                WHERE SectionID NOT IN ('RM', 'PK', 'QA')
                ORDER BY MachineCode
            `)
            return result.recordset.map(row => row.MachineCode)
        } catch (error) {
            console.error('Error fetching MachineCode:', error)
            return []
        }
    }

    async function getSectionIDs() {
        try {
            const result = await dbSQL.query(`
                SELECT DISTINCT SectionID
                FROM [Production_Analytics].[dbo].[vDashboard]
                WHERE SectionID NOT IN ('RM', 'PK', 'QA')
                ORDER BY SectionID
            `);
            return result.recordset.map(row => row.SectionID)
        } catch (error) {
            console.error('Error fetching SectionID:', error)
            return []
        }
    }

    // สร้าง router เปลี่ยน Coil ออก ไปเครื่อง MachineCode อื่น แต่ถ้าแผนกรีดต้องเปลี่ยน SectionID ตามด้วย
    router.get('/coilnosql', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        const page = parseInt(req.query.page) || 1
        const limit = 8
        const offset = (page - 1) * limit

        const filterDate = req.query.filterDate
        const filterSection = req.query.filterSection
        const searchDocNo = req.query.searchDocNo || ''

  
        let sqlRequest = dbSQL.request()

        let sqlWhere = ['(Isdelete = 0 OR Isdelete IS NULL)'];
        
        // เพิ่มเงื่อนไขอื่นๆ ต่อจากนี้ตามที่มีอยู่เดิม
        if (filterDate) {
            sqlWhere.push(`CONVERT(date, PrintTime) = @filterDate`);
            sqlRequest = sqlRequest.input('filterDate', new Date(filterDate))
        }
        if (filterSection === 'drawing') {
            sqlWhere.push(`SectionID LIKE 'D%' AND SectionID NOT LIKE 'DW%' `)
        }
        if (filterSection === 'cutting') {
            sqlWhere.push(`SectionID = 'CU'`)
        }
        if (filterSection === 'co') {
            sqlWhere.push(`SectionID = 'CO'`)
        }
        if (filterSection === 'annealing') {
            sqlWhere.push(`SectionID = 'AN'`)
        }
        if (filterSection === 'centerless_grinding') {
            sqlWhere.push(`SectionID = 'CG'`)
        }
        // เพิ่มเงื่อนไขสำหรับ Section อื่นๆ ตามต้องการ

        //search
        if (searchDocNo) {
            sqlWhere.push(`DocNo LIKE @searchDocNo`)
            sqlRequest = sqlRequest.input('searchDocNo', `%${searchDocNo}%`)
        }

        const whereClause = sqlWhere.length > 0 ? `WHERE ${sqlWhere.join(' AND ')}` : ''

        let sqlQuery = `SELECT * FROM [Production_Analytics].[dbo].[vDashboard]
                   ${whereClause}
                   ORDER BY PrintTime DESC
                   OFFSET ${offset} ROWS
                   FETCH NEXT ${limit} ROWS ONLY`

        let countSql = `SELECT COUNT(*) AS total FROM [Production_Analytics].[dbo].[vDashboard] ${whereClause}`

        try {
            const result = await sqlRequest.query(sqlQuery)
            const countResult = await sqlRequest.query(countSql)

            const totalItems = countResult.recordset[0].total
            const totalPages = Math.ceil(totalItems / limit)

            // เพิ่มการดึงข้อมูล machineCodes และ sectionIDs
            const machineCodes = await getMachineCodes()
            const sectionIDs = await getSectionIDs()

            res.render('pages/backend/coilnosql', {
                title: 'Coil-No-SQL',
                heading: 'แก้ไขเปลี่ยน CoilNo. ไปยัง MachineNo. เครื่องอื่น',
                layout: './layouts/backend',
                showNavbar: false,
                data: result.recordset,
                currentPage: page,
                totalPages: totalPages,
                moment: moment,
                filterDate: filterDate || '',
                filterSection: filterSection || '',
                searchDocNo: searchDocNo,
                machineCodes: machineCodes,
                sectionIDs: sectionIDs
            });
        } catch (err) {
            console.error('Error querying database:', err)
            res.status(500).send('Error querying database: ' + err.message)
        }
    })

    // edit coilnosql
    router.post('/edit_coilnosql', async (req, res) => {
        try {
            const {
                DocNo,
                newMachineCode,
                newSectionID,
                OutRSNCode
            } = req.body

            // ตรวจสอบว่าข้อมูลที่ส่งมาครบถ้วน
            if (!DocNo || !newMachineCode || !newSectionID || !OutRSNCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ข้อมูลไม่ครบถ้วน'
                })
            }

            // สร้าง query string
            const query = `
            UPDATE [Production_Analytics].[dbo].[vDashboard]
            SET MachineCode = @newMachineCode, SectionID = @newSectionID
            WHERE DocNo = @DocNo AND OutRSNCode = @OutRSNCode
            AND Isdelete = 0 
        `;

            // ทำการอัพเดทข้อมูลในฐานข้อมูล
            const request = new sql.Request(dbSQL)
            request.input('newMachineCode', sql.NVarChar, newMachineCode)
            request.input('newSectionID', sql.NVarChar, newSectionID)
            request.input('DocNo', sql.NVarChar, DocNo)
            request.input('OutRSNCode', sql.NVarChar, OutRSNCode)

            const result = await request.query(query)

            console.log('Update result:', result)

            // ตรวจสอบว่ามีการอัพเดทจริงหรือไม่
            if (result.rowsAffected[0] === 0) {
                console.log('No rows updated')
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลที่ต้องการอัพเดท'
                })
            }

            console.log('Update successful')
            res.json({
                success: true,
                message: 'อัพเดทข้อมูลสำเร็จ'
            })
        } catch (error) {
            console.error('Error updating coil:', error)
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล',
                error: error.message
            })
        }
    })

    //แสดงผลแผนก BAR2 
    router.get('/bar2', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

            res.render('pages/backend/bar2', {
                title: 'BAR2',
                heading: 'BAR2',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            })

    })

    //แสดงผลแผนก Profile
    router.get('/profile', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        res.render('pages/backend/profile', {
            title: 'PROFILE',
            heading: 'PROFILE',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment
        })
    })

    //แสดงผลแผนก Annealing
    router.get('/annealing', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        res.render('pages/backend/annealing', {
            title: 'annealing',
            heading: 'annealing',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment
        })
    })

    // แสดงผลแผนก CGM
    router.get('/cgm', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        res.render('pages/backend/cgm', {
            title: 'CGM',
            heading: 'CGM',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment
        })
    })

    router.get('/bar1', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        res.render('pages/backend/bar1', {
            title: 'BAR1',
            heading: 'BAR1',
            layout: './layouts/backend',
            showNavbar: true,
            moment: moment
        })
    })

    // router.get('/bar1-v2', async (req, res) => {
    //     if (!dbSQL) {
    //         return res.status(500).send('Database connection not established')
    //     }

    //     res.render('pages/backend/production/bar1-v2', {
    //         title: 'BAR1-V2',
    //         heading: 'BAR1-V2',
    //         layout: './layouts/backend',
    //         showNavbar: true,
    //         moment: moment
    //     })
    // })


    router.get('/bar1-Ncr', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        try {
            res.render('pages/backend/bar1-Ncr', {
                title: 'NCR Production Chart',
                heading: 'NCR Production Chart',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    });

    // หน้า Plan Vs Actual BAR2 จะเปลี่ยนเป็นดูของเสียแทน
    router.get('/bar2-Ncr', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        try {
            res.render('pages/backend/bar2-Ncr', {
                title: 'NCR Production Chart',
                heading: 'NCR Production Chart',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    });

    router.get('/cgm-Ncr', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        try {
            res.render('pages/backend/cgm-Ncr', {
                title: 'NCR Production Chart',
                heading: 'CGM NCR Production Chart',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    })

    router.get('/profile-Ncr', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        try {
            res.render('pages/backend/profile-Ncr', {
                title: 'NCR Production Chart',
                heading: 'Profile NCR Production Chart',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    })

    // หน้า Plan Vs Actual Drawing
    router.get('/drawing-plan-actual', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established')
        }

        try {
            res.render('pages/backend/drawing-plan-actual', {
                title: 'Plan vs Actual Production Chart',
                heading: 'Plan vs Actual Production Chart',
                layout: './layouts/backend',
                showNavbar: true,
                moment: moment
            })
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    })


    // Sale New Customers
//     router.get('/create_sale_new_customers', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }
    
//         try {
//             const salesReps = await dbSale.request()
//                 .query`
//                     SELECT SalesRepId, FirstName, LastName, 
//                            CONCAT(FirstName, ' ', LastName) AS FullName 
//                     FROM SalesRepresentatives WHERE IsActive = 1`;

//             const segmentsResult = await dbSale.request()
//                 .query`SELECT SegmentId, SegmentName FROM [Sale].[dbo].[MarketSegments] ORDER BY SegmentId`;
    
//             //console.log('Sales Representatives:', salesReps.recordset);
//             //console.log('Market Segments:', segmentsResult.recordset);
        
//             res.render('pages/backend/create_sale_new_customers', {
//                 title: 'Create New Special Customer',
//                 heading: 'Create New Special Customer',
//                 layout: './layouts/backend',
//                 showNavbar: true,
//                 salesReps: salesReps.recordset,
//                 marketSegments: segmentsResult.recordset,
//                 moment: moment
//             });
//         } catch (err) {
//             console.error('Error:', err);
//             res.status(500).send('An error occurred');
//         }
//     });

//     router.get('/sale_new_customers', async (req, res) => {
//         console.log('Accessing sale_new_customers route');
    
//         if (!dbSale) {
//             console.error('Database connection not established');
//             return res.status(500).send('Database connection not established');
//         }
    
//         try {
//             console.log('Fetching customers data from database...');
//             const customersResult = await dbSale.request()
//             .query`SELECT SpecialCustomerId, CompanyName, ContactName, ContactPhone, 
//             MarketSegment, MainProduct, Inquiry, Application, Details, Remark, 
//             SalesRepId, SalesRepName, CreatedAt, UpdatedAt 
//             FROM vw_SpecialCustomersDetails ORDER BY CreatedAt DESC`;
//             console.log(`Retrieved ${customersResult.recordset.length} customer records`);
    
//             console.log('Fetching market segments data...');
//             const segmentsResult = await dbSale.request()
//                 .query`SELECT SegmentId, SegmentName FROM [Sale].[dbo].[MarketSegments] ORDER BY SegmentId`;
            
//             console.log(`Retrieved ${segmentsResult.recordset.length} market segments`);
    
//             const marketSegments = segmentsResult.recordset.reduce((acc , segment) => {
//                 acc[segment.SegmentId] = segment.SegmentName;
//                 return acc;
//             }, {});
    
//             console.log('Market Segments mapping:', marketSegments);
    
//             console.log('Rendering sale_new_customers page...');
//             res.render('pages/backend/sale_new_customers', {
//                 title: 'Special Customers',
//                 heading: 'Special Customers',
//                 layout: './layouts/backend',
//                 showNavbar: true,
//                 data: customersResult.recordset,
//                 marketSegments: marketSegments,
//                 moment: moment
//             });
//             console.log('Page rendered successfully');
    
//         } catch (err) {
//             console.error('Error in sale_new_customers route:', err);
//             console.error('Error stack:', err.stack);
//             res.status(500).send('An error occurred');
//         }
//     });

//     const { Transaction } = require('mssql');

//     router.get('/delete_sale_customer/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }
    
//         const transaction = new sql.Transaction(dbSale);
    
//         try {
//             await transaction.begin();
    
//             const customerId = req.params.id;
    
//             // ดึงข้อมูล CompanyId, ContactId, และ MainProductId ก่อนลบ
//             const customerInfo = await transaction.request()
//                 .input('CustomerId', sql.Int, customerId)
//                 .query`
//                     SELECT CompanyId, ContactId, MainProductId 
//                     FROM [Sale].[dbo].[SpecialCustomers] 
//                     WHERE SpecialCustomerId = @CustomerId
//                 `;
    
//             if (customerInfo.recordset.length === 0) {
//                 throw new Error('Customer not found');
//             }
    
//             const { CompanyId, ContactId, MainProductId } = customerInfo.recordset[0];
    
//             // ลบข้อมูลจากตาราง SpecialCustomers
//             await transaction.request()
//                 .input('CustomerId', sql.Int, customerId)
//                 .query`DELETE FROM SpecialCustomers WHERE SpecialCustomerId = @CustomerId`;
    
//             // ลบ Product โดยตรง
//             if (MainProductId) {
//                 await transaction.request()
//                     .input('ProductId', sql.Int, MainProductId)
//                     .query`DELETE FROM Products WHERE ProductId = @ProductId`;
//             }
    
//             // ลบ Contact
//             await transaction.request()
//                 .input('ContactId', sql.Int, ContactId)
//                 .query`DELETE FROM Contacts WHERE ContactId = @ContactId`;
    
//             // ลบ Company
//             await transaction.request()
//                 .input('CompanyId', sql.Int, CompanyId)
//                 .query`DELETE FROM Companies WHERE CompanyId = @CompanyId`;
    
//             await transaction.commit();
    
//             req.flash('success', 'Customer and related data deleted successfully');
//             res.redirect('/backend/sale_new_customers');
//         } catch (err) {
//             await transaction.rollback();
//             console.error('Error:', err);
//             req.flash('error', 'An error occurred while deleting customer: ' + err.message);
//             res.redirect('/backend/sale_new_customers');
//         }
//     });

//     router.post('/sale_new_customers', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }
    
//         const transaction = new sql.Transaction(dbSale);
    
//         try {
//             await transaction.begin();
    
//             const { CompanyName, ContactName, ContactPhone, CategoryMarket, MainProduct, Inquiry, Application, Detail, Remark, SaleName } = req.body;
    
//             console.log('Received data:', { CompanyName, ContactName, ContactPhone, CategoryMarket, MainProduct, Inquiry, Application, Detail, Remark, SaleName });
    
//             // สร้าง Company ใหม่
//             const newCompanyResult = await transaction.request()
//                 .input('CompanyName', sql.NVarChar, CompanyName)
//                 .input('ContactName', sql.NVarChar, ContactName)
//                 .input('Phone', sql.NVarChar, ContactPhone)
//                 .input('CreatedBy', sql.Int, 1)
//                 .query`
//                     INSERT INTO Companies (CompanyName, ContactName, Phone, CreatedBy)
//                     OUTPUT INSERTED.CompanyId
//                     VALUES (@CompanyName, @ContactName, @Phone, @CreatedBy)
//                 `;
//             const companyId = newCompanyResult.recordset[0].CompanyId;
    
//             // สร้าง Contact ใหม่
//             const [firstName, ...lastNameParts] = ContactName.split(' ');
//             const lastName = lastNameParts.join(' ');
//             const newContactResult = await transaction.request()
//                 .input('CompanyId', sql.Int, companyId)
//                 .input('FirstName', sql.NVarChar, firstName)
//                 .input('LastName', sql.NVarChar, lastName)
//                 .input('Phone', sql.NVarChar, ContactPhone)
//                 .input('CreatedBy', sql.Int, 1) 
//                 .query`
//                     INSERT INTO [Sale].[dbo].[Contacts] (CompanyId, FirstName, LastName, Phone, CreatedBy) 
//                     OUTPUT INSERTED.ContactId 
//                     VALUES (@CompanyId, @FirstName, @LastName, @Phone, @CreatedBy)
//                 `;
//             const contactId = newContactResult.recordset[0].ContactId;
    
//             // หา SalesRepId
//             const salesRepResult = await transaction.request()
//                 .input('SaleNameId', sql.Int, parseInt(SaleName))
//                 .query`SELECT SalesRepId FROM SalesRepresentatives WHERE SalesRepId = @SaleNameId`;
    
//             const salesRepId = salesRepResult.recordset[0]?.SalesRepId;
//             if (!salesRepId) {
//                 throw new Error(`Sales representative not found for ID: ${SaleName}`);
//             }
    
//             // สร้าง MainProduct ใหม่ (ถ้ามี)
//             let mainProductId = null;
//             if (MainProduct) {
//                 const newProductResult = await transaction.request()
//                     .input('ProductName', sql.NVarChar, MainProduct)
//                     .input('Description', sql.NVarChar, `Description for ${MainProduct}`)
//                     .input('IsActive', sql.Bit, 1)
//                     .query`
//                         INSERT INTO Products (ProductName, Description, IsActive)
//                         OUTPUT INSERTED.ProductId
//                         VALUES (@ProductName, @Description, @IsActive);
//                     `;
//                 mainProductId = newProductResult.recordset[0].ProductId;
//             }
    
//             // ตรวจสอบว่า CategoryMarket เป็นตัวเลข
//             const segmentId = parseInt(CategoryMarket);
//             if (isNaN(segmentId)) {
//                 throw new Error('Invalid CategoryMarket');
//             }
    
//             // เพิ่มข้อมูลใน SpecialCustomers
//             await transaction.request()
//                 .input('CompanyId', sql.Int, companyId)
//                 .input('ContactId', sql.Int, contactId)
//                 .input('SalesRepId', sql.Int, salesRepId)
//                 .input('SegmentId', sql.Int, segmentId)
//                 .input('MainProductId', sql.Int, mainProductId)
//                 .input('Inquiry', sql.NVarChar, Inquiry)
//                 .input('Application', sql.NVarChar, Application)
//                 .input('Details', sql.NVarChar, Detail)
//                 .input('Remark', sql.NVarChar, Remark)
//                 .input('Status', sql.NVarChar, 'New')
//                 .input('CreatedBy', sql.Int, 1)
//                 .query`
//                     INSERT INTO SpecialCustomers (CompanyId, ContactId, SalesRepId, SegmentId, MainProductId, Inquiry, Application, Details, Remark, Status, CreatedAt, CreatedBy)
//                     VALUES (@CompanyId, @ContactId, @SalesRepId, @SegmentId, @MainProductId, @Inquiry, @Application, @Details, @Remark, @Status, GETDATE(), @CreatedBy);
//                 `;
    
//                 await transaction.commit();

//                 req.flash('success', 'New customer added successfully');
//                 res.redirect('/backend/sale_new_customers');
//             } catch (err) {
//                 await transaction.rollback();
//                 console.error('Error:', err);
        
//                 // จัดการกับ specific errors
//                 if (err.number === 2627 || err.number === 2601) {
//                     req.flash('error', 'A customer with this information already exists.');
//                 } else {
//                     req.flash('error', 'Failed to add new customer: ' + err.message);
//                 }
        
//                 res.redirect('/backend/create_sale_new_customers');
//             }
//         });

// router.get('/view_sale_customer/:id', async (req, res) => {
//     // console.log('View sale customer route called');
//     // console.log('Customer ID:', req.params.id);
//     if (!dbSale) {
//         return res.status(500).send('Database connection not established');
//     }

//     try {
//         const customerId = req.params.id;
//         console.log('Customer ID:', customerId);
        
//         const customerResult = await dbSale.request()
//             .input('CustomerId', sql.Int, customerId)
//             .query`
//                 SELECT sc.*, c.CompanyName, 
//                        CONCAT(co.FirstName, ' ', co.LastName) AS ContactName,
//                        co.Phone AS ContactPhone, 
//                        ms.SegmentName AS MarketSegment,
//                        p.ProductName AS MainProduct, 
//                        CONCAT(sr.FirstName, ' ', sr.LastName) AS SalesRepName
//                 FROM SpecialCustomers sc
//                 JOIN Companies c ON sc.CompanyId = c.CompanyId
//                 JOIN Contacts co ON sc.ContactId = co.ContactId
//                 JOIN MarketSegments ms ON sc.SegmentId = ms.SegmentId
//                 LEFT JOIN Products p ON sc.MainProductId = p.ProductId
//                 JOIN SalesRepresentatives sr ON sc.SalesRepId = sr.SalesRepId
//                 WHERE sc.SpecialCustomerId = @CustomerId
//             `;

//         if (customerResult.recordset.length === 0) {
//             console.log('Customer not found');
//             req.flash('error', 'Customer not found');
//             return res.redirect('/backend/sale_new_customers');
//         }

//         const customer = customerResult.recordset[0];
//         console.log('Customer data:', customer);

//         // ดึงข้อมูล Sales Representatives และ Market Segments
//         const [salesReps, segmentsResult] = await Promise.all([
//             dbSale.request().query`SELECT SalesRepId, CONCAT(FirstName, ' ', LastName) AS FullName 
//                                    FROM SalesRepresentatives WHERE IsActive = 1`,
//             dbSale.request().query`SELECT SegmentId, SegmentName FROM [Sale].[dbo].[MarketSegments] ORDER BY SegmentId`
//         ]);

//         res.render('pages/backend/view_sale_customer', {
//             title: 'View Special Customer',
//             heading: 'View Special Customer',
//             layout: './layouts/backend',
//             showNavbar: true,
//             customer: customer,
//             salesReps: salesReps.recordset,
//             marketSegments: segmentsResult.recordset,
//             moment: moment
//         });
//     } catch (err) {
//         console.error('Detailed error:', err);
//         console.error('Error stack:', err.stack);
//         req.flash('error', 'An error occurred while retrieving customer data');
//         res.redirect('/backend/sale_new_customers');
//     }
// });

//     router.post('/update_sale_customer/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         } 

//         const transaction = new Transaction(dbSale);

//         try {   
//             await transaction.begin();

//             const customerId = req.params.id;
//             const { CompanyName, ContactName, ContactPhone, CategoryMarket, MainProduct, Inquiry, Application, Details, Remark, SaleName } = req.body;

//             // Validate input
//             if (!CompanyName || !ContactName || !ContactPhone || !CategoryMarket || !SaleName) {
//                 throw new Error('Missing required fields');
//             }

//             // อัปเดตข้อมูลใน SpecialCustomers
//             await transaction.request()
//                 .input('CustomerId', sql.Int, customerId)
//                 .input('SegmentId', sql.Int, parseInt(CategoryMarket))
//                 .input('MainProduct', sql.NVarChar, MainProduct)
//                 .input('Inquiry', sql.NVarChar, Inquiry)
//                 .input('Application', sql.NVarChar, Application)
//                 .input('Details', sql.NVarChar, Details)
//                 .input('Remark', sql.NVarChar, Remark)
//                 .input('SalesRepId', sql.Int, parseInt(SaleName))
//                 .input('UpdatedBy', sql.Int, 1) // ควรใช้ ID ของผู้ใช้ที่กำลังแก้ไขข้อมูล
//                 .query`
//                     UPDATE SpecialCustomers
//                     SET SegmentId = @SegmentId, 
//                         MainProductId = (SELECT TOP 1 ProductId FROM Products WHERE ProductName = @MainProduct),
//                         Inquiry = @Inquiry,
//                         Application = @Application,
//                         Details = @Details,
//                         Remark = @Remark,
//                         SalesRepId = @SalesRepId,
//                         UpdatedAt = GETDATE(),
//                         UpdatedBy = @UpdatedBy
//                     WHERE SpecialCustomerId = @CustomerId;
//                 `;

//                 // อัปเดต Companies
//                 await transaction.request()
//                     .input('CustomerId', sql.Int, customerId)
//                     .input('CompanyName', sql.NVarChar, CompanyName)
//                     .query`
//                         UPDATE Companies
//                         SET CompanyName = @CompanyName
//                         WHERE CompanyId = (SELECT CompanyId FROM SpecialCustomers WHERE SpecialCustomerId = @CustomerId);
//                 `;

//                 // อัปเคต Contact
//                 const nameParts = ContactName.split(' ');
//                 const firstName = nameParts[0];
//                 const lastName = nameParts.slice(1).join(' ');

//                 await transaction.request()
//                     .input('CustomerId', sql.Int, customerId)
//                     .input('FirstName', sql.NVarChar, firstName)
//                     .input('LastName', sql.NVarChar, lastName)
//                     .input('ContactPhone', sql.NVarChar, ContactPhone)
//                     .query`
//                         UPDATE Contacts
//                         SET FirstName = @FirstName,
//                             LastName = @LastName,
//                             Phone = @ContactPhone
//                         WHERE ContactId = (SELECT ContactId FROM SpecialCustomers WHERE SpecialCustomerId = @CustomerId);
//                     `;

//         await transaction.commit();

//         req.flash('success', 'Customer updated successfully');
//         res.redirect('/backend/sale_new_customers');
//     } catch (err) {
//         await transaction.rollback();
//         console.error('Error:', err);
//         req.flash('error', 'Failed to update customer: ' + err.message);
//         res.redirect(`/backend/edit_sale_customer/${req.params.id}`);
//     }
// });

//     router.get('/admin_settings', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         try {
//             const segmentsResult = await dbSale.request()
//                 .query`SELECT * FROM [Sale].[dbo].[MarketSegments] ORDER BY SegmentId`;

//             const salesRepsResult = await dbSale.request()
//                 .query`SELECT * FROM [Sale].[dbo].[SalesRepresentatives] WHERE IsActive = 1 ORDER BY SalesRepId`;

//             res.render('pages/backend/admin_settings', {
//                 title: 'Admin Settings',
//                 heading: 'Admin Settings',
//                 layout: './layouts/backend',
//                 showNavbar: true,
//                 marketSegments: segmentsResult.recordset,
//                 salesReps: salesRepsResult.recordset
//             });
//         } catch (err) {
//             console.error('Error:', err);
//             res.status(500).send('An error occurred');
//         }
//     })

//     router.get('/edit_market_segment/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }
//         // แสดงฟอร์มแก้ไข Market Segment
//         try {
//             const segmentId = req.params.id;
//             const result = await dbSale.request()
//                 .input('SegmentId', sql.Int, segmentId)
//                 .query`SELECT * FROM [Sale].[dbo].[MarketSegments] WHERE SegmentId = @SegmentId`

//             if (result.recordset.length === 0) {
//                 req.flash('error', 'Market segment not found');
//                 return res.redirect('/backend/admin_settings');
//             }    

//             res.render('pages/backend/edit_market_segment', {
//                 title: 'Edit Market Segment',
//                 heading: 'Edit Market Segment',
//                 layout: './layout/backend',
//                 showNavbar: true,
//                 segment: result.recordset[0]
//             });
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'An error occurred while retrieving market segment');
//             res.redirect('/backend/admin_settings');
//         }
//     });

//     router.post('/edit_market_segment/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         // อัปเดต Market Segment
//         try {
//             const segmentId = req.params.id;
//             const { segmentName } = req.body;

//             await dbSale.request()
//                 .input('SegmentId', sql.Int, segmentId)
//                 .input('SegmentName', sql.NVarChar, segmentName)
//                 .query`UPDATE [Sale].[dbo].[MarketSegments] SET SegmentName = @SegmentName WHERE SegmentId = @SegmentId`
//             req.flash('success', 'Market Segment Update Successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to update market segment: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     });

//     router.get('/delete_market_segment/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         // ลบ Market Segment
//         try {
//             const segmentId = req.params.id;

//             await dbSale.request()
//                 .input('SegmentId', sql.Int, segmentId)
//                 .query`DELETE FROM [Sale].[dbo].[MarketSegments] WHERE SegmentId = @SegmentId`;

//             req.flash('success', 'Market Segment deleted successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to delete market segment: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     })
    
//     router.post('/add_market_segment', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         try {
//             const { segmentName } = req.body;
//             await dbSale.request()
//                 .input('SegmentName', sql.NVarChar, segmentName)
//                 .query`INSERT INTO MarketSegments (SegmentName) VALUES (@SegmentName)`;

//             req.flash('success', 'Market segment added successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to add market segment: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     })

//     router.post('/add_sales_rep', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         try {
//             const { firstName, lastName, email, phone } = req.body;
//             await dbSale.request()
//                 .input('FirstName', sql.NVarChar, firstName)
//                 .input('LastName', sql.NVarChar, lastName)
//                 .input('Email', sql.NVarChar, email)
//                 .input('Phone', sql.NVarChar, phone)
//                 .query`INSERT INTO SalesRepresentatives (FirstName, LastName, Email, Phone, IsActive)
//                        VALUES (@FirstName, @LastName, @Email, @Phone, 1)`;

//             req.flash('success', 'Sales representative added successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to add sales representative: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     })

//     router.get('/edit_sales_rep/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         try {
//             const salesRepId = req.params.id;
//             const result = await dbSale.request()
//                 .input('SalesRepId', sql.Int, salesRepId)
//                 .query`SELECT * FROM [Sale].[dbo].[SalesRepresentatives] WHERE SalesRepId = @SalesRepId`;

//             if (result.recordset.length === 0) {
//                 req.flash('error', 'Sales representative not found');
//                 return res.redirect('/backend/admin_settings');
//             }

//             res.render('pages/backend/edit_sales_rep', {
//                 title: 'Edit Sales Representative',
//                 heading: 'Edit Sales Representative',
//                 layout: './layouts/backend',
//                 showNavbar: true,
//                 salesRep: result.recordset[0]
//             });
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'An error occurred while retrieving sales representative');
//             res.redirect('/backend/admin_settings');
//         }
//     });

//     router.post('/edit_sales_rep/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }

//         try {
//             const salesRepId = req.params.id;
//             const { firstName, lastName, email, phone } = req.body;

//             await dbSale.request()
//                 .input('SalesRepId', sql.Int, salesRepId)
//                 .input('FirstName', sql.NVarChar, firstName)
//                 .input('LastName', sql.NVarChar, lastName)
//                 .input('Email', sql.NVarChar, email)
//                 .input('Phone', sql.NVarChar, phone)
//                 .query`UPDATE [Sale].[dbo].[SalesRepresentatives]
//                        SET FirstName = @FirstName, LastName = @LastName, Email = @Email, Phone = @Phone
//                        WHERE SalesRepId = @SalesRepId`;

//             req.flash('success', 'Sales representative updated successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to update sales representative: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     })

//     router.get('/delete_sales_rep/:id', async (req, res) => {
//         if (!dbSale) {
//             return res.status(500).send('Database connection not established');
//         }
    
//         try {
//             const salesRepId = req.params.id;
    
//             await dbSale.request()
//                 .input('SalesRepId', sql.Int, salesRepId)
//                 .query`UPDATE [Sale].[dbo].[SalesRepresentatives] SET IsActive = 0 WHERE SalesRepId = @SalesRepId`;
    
//             req.flash('success', 'Sales representative deleted successfully');
//             res.redirect('/backend/admin_settings');
//         } catch (err) {
//             console.error('Error:', err);
//             req.flash('error', 'Failed to delete sales representative: ' + err.message);
//             res.redirect('/backend/admin_settings');
//         }
//     });

    

    // ราคา Profile
    router.get('/profile-cal', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established');
        }
    
        try {
            res.render('pages/backend/profile-cal', {
                title: 'Calculate Profile Price',
                heading: 'Calculate Profile Price',
                layout: './layouts/backend',
                showNavbar: true
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    });

    // ดึงข้อมูล ToolingPrices
    router.get('/tooling-prices', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established');
        }

        try {
            const price = await getToolingPrices();
            res.json(prices);
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        };
    })

    // คำนวนราคา
    router.post('/calculate-price', async (req, res) => {
        if (!dbSQL) {
            return res.status(500).send('Database connection not established');
        }

        const { itemName, quantity, grindingLapOD, shapeType } = req.body;

        try {
            const totalPrice = await calculatePrice(itemName, quantity, grindingLapOD, shapeType);
            res.json({ totalPrice });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred');
        }
    });

    async function getToolingPrices() {
        try {
          let pool = await sql.connect(config);
          let result = await pool.request()
            .query(`SELECT tp.*, m.MaterialName, s.ShapeName, wt.WireTypeName
                    FROM ToolingPrices tp
                    LEFT JOIN Materials m ON tp.MaterialId = m.Id
                    LEFT JOIN Shapes s ON tp.ShapeId = s.Id
                    LEFT JOIN WireTypes wt ON tp.WireTypeId = wt.Id`);
          return result.recordset;
        } catch (err) {
          console.error('SQL error', err);
          throw err; 
        }
      }
      
      async function calculatePrice(itemName, quantity, grindingLapOD, shapeType) {
        try {
          let pool = await sql.connect(config);
          let result = await pool.request()
            .input('ItemName', sql.NVarChar, itemName)
            .input('Quantity', sql.Int, quantity)
            .input('GrindingLapOD', sql.Bit, grindingLapOD)
            .input('ShapeType', sql.NVarChar, shapeType)
            .execute('CalculateToolingPrice');
          return result.recordset[0].TotalPrice;
        } catch (err) {
          console.error('SQL error', err);
          throw err;
        }
      }
    
// route สำหรับแสดงหน้าประวัติการเสนอราคา
router.get('/quotation-history', (req, res) => {
    if (!dbSQL) {
        return res.status(500).send('Database connection not established');
    }

    try {
        res.render('pages/backend/quotation-history', {
            title: 'ประวัติการเสนอราคา',
            heading: 'ประวัติการเสนอราคา',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('An error occurred');
    }
});

router.get('/checkIncrementalLoadStatus', async (req, res) => {
    try {
        const pool = await getPool('Production_Analytics');
        const result = await pool.request().query(`
            SELECT TOP 1 *
            FROM ProcessingLog
            ORDER BY LastProcessedTime DESC
        `);
        
        res.json({
            success: true,
            lastStatus: result.recordset[0]
        });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.get('/oee-dashboard', (req, res) => {
    if (!dbSQL) {
        return res.status(500).send('Database connection not established');
    }

    try {
        res.render('pages/backend/oee-dashboard', {  // ปรับ path ให้อยู่ระดับเดียวกัน
            title: 'OEE Dashboard',
            heading: 'OEE Dashboard',
            layout: './layouts/backend',
            showNavbar: true
        });
    } catch (error) {
        console.error('Error rendering OEE dashboard:', error);
        res.status(500).send('Error rendering OEE dashboard');
    }
});



module.exports = router



