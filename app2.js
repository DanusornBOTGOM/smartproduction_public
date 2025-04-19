// // Import Express
// const express = require("express");
// const dbConnection = require("./src/utils/database.util"); // เพิ่มมาใหม่่

// // Import Express Flash
// const flash = require("express-flash");

// // Import Express Session
// const session = require("express-session");

// //Import EJS layout
// const expressLayouts = require("express-ejs-layouts");

// //Import Method Override
// const methodOverride = require("method-override");

// // //Import router frontend.js
// // const frontendRouter = require('./routes/frontend')
// // เพิ่ม Import sales routes
// const salesRouter = require("./app/sales/api/sale.routes");

// const authRouter = require("./routes/auth"); // เพิ่มบรรทัดนี้
// //Import router backend.js
// const backendRouter = require("./routes/backend");
// //Import router api.js
// const apiRouter = require("./routes/api");
// // Import router test.js
// // const testRouter = require('./routes/test')

// // Import bar1Routes
// const bar1Routes = require("./src/routes/bar1Routes");

// // Import router หลักของฝ่ายผลิต
// const productionRouter = require("./routes/production"); //  main production router

// const productionAPIRouter = require("./app/production/entry-points/api/production.routes"); // router ใหม่

// //กำหนด port
// const port = process.env.PORT || 5000;

// //Create express object
// const app = express();

// async function initializeApp() {
//   try {
//     const db = await dbConnection.connect();
//     app.locals.db = db;
//     console.log("Database initialized in app.locals");
//   } catch (error) {
//     console.error("Failed to initialize database:", error);
//     process.exit(1);
//   }
// }

// initializeApp(); // เพิ่มมาใหม่

// // ใส่ middleware เพื่อให้ Express สามารถอ่านข้อมูล JSON ที่ส่งมาได้
// app.use(express.json());

// // กำหนด Folder สำหรับบอกตัว express ว่าไฟล์ css , images อยู่ path ไหน
// app.use(express.static("assets"));

// // Use method override
// app.use(methodOverride("_method"));

// // กำหนด Template Engine
// app.use(expressLayouts);
// // app.set('layout', './layouts/frontend')
// app.set("view engine", "ejs");

// // กำหนดค่าให้สามารถรับค่าจากฟอร์มได้
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// // เรียกใช้ cors
// const cors = require("cors");
// app.use(cors());

// // เรียกใช้งาน Express session
// const cookieSession = require("cookie-session");

// app.use(
//   cookieSession({
//     name: "session",
//     keys: ["your-secret-key"],
//     maxAge: 30 * 60 * 1000, // 30 นาที
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//   })
// );

// // เพิ่มหลังจาก cookieSession แต่ก่อน routes
// app.use((req, res, next) => {
//   res.locals.session = req.session;
//   next();
// });

// // เพิ่ม compatibility layer สำหรับ req.session
// app.use((req, res, next) => {
//   if (!req.session.regenerate) {
//     req.session.regenerate = (fn) => fn();
//   }
//   if (!req.session.save) {
//     req.session.save = (fn) => fn();
//   }
//   next();
// });

// //เรียกใช้งาน Express flash
// app.use(flash());

// app.use("/auth", authRouter);
// //เรียกใช้ Routes
// // app.use('/', frontendRouter)
// // เพิ่ม sales routes (ใส่ก่อน backend routes)

// // ใช้ middleware เฉพาะกับ routes ของ sales
// app.use("/backend/sales", salesRouter);
// app.use("/backend", backendRouter);
// app.use("/api", apiRouter);
// // app.use("/test", testRouter);
// app.use("/production", productionRouter);

// app.use("/api/v2/bar1", bar1Routes);

// app.use("/api/production", productionAPIRouter); // เพิ่ม route ใหม่

// const host = "0.0.0.0";

// app.listen(port, host, () => {
//   console.log(`Server run at http://${host}:${port}`);
// });
