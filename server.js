const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const multer = require("multer");

const mailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});




// ================================
// MATERIAL FILE UPLOAD
// ================================

const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        cb(null, `${Date.now()}-${safeName}`);
    }
});

const materialUpload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowed = [
            "application/pdf"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed."));
        }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, "studenthub.sqlite");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 20 * 1024 * 1024 }
});


// ================================
// PASSWORD SECURITY
// ================================

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(String(password), salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    try {
        const [salt, storedHash] =
            String(storedPassword).split(":");

        if (!salt || !storedHash) {
            return false;
        }

        const hash = crypto
            .scryptSync(String(password), salt, 64)
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(storedHash, "hex")
        );

    } catch (error) {
        return false;
    }
}


let db;

// JSON requests
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || "polytechnic-hub-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 4
    }
}));

// Website files
app.use(express.static(path.join(__dirname, "public")));


// ================================
// DATABASE
// ================================

async function startDatabase() {

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_FILE)) {

        const data = fs.readFileSync(DB_FILE);

        db = new SQL.Database(data);

    } else {

        db = new SQL.Database();

    }


    db.run(`
        CREATE TABLE IF NOT EXISTS students (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            email TEXT UNIQUE NOT NULL,

            password TEXT NOT NULL,

            college TEXT,

            branch TEXT,

            year TEXT,

            semester TEXT,

            goal TEXT,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);


    // ================================
    // STUDENT AUTH MIGRATION
    // ================================

    const studentColumns =
        db.exec(`PRAGMA table_info(students)`)[0]?.values
            .map(row => row[1]) || [];

    if (!studentColumns.includes("phone")) {
        db.run(`ALTER TABLE students ADD COLUMN phone TEXT`);
    }

    if (!studentColumns.includes("reset_otp")) {
        db.run(`ALTER TABLE students ADD COLUMN reset_otp TEXT`);
    }

    if (!studentColumns.includes("reset_otp_expires")) {
        db.run(`ALTER TABLE students ADD COLUMN reset_otp_expires INTEGER`);
    }


    db.run(`
        CREATE TABLE IF NOT EXISTS feedback (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            student_id INTEGER,

            college TEXT,

            branch TEXT,

            year TEXT,

            semester TEXT,

            used TEXT,

            suggestion TEXT,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);

    // ================================
    // STUDY HUB TABLES
    // ================================

    db.run(`
        CREATE TABLE IF NOT EXISTS subjects (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            branch TEXT,

            semester TEXT,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);


    db.run(`
        CREATE TABLE IF NOT EXISTS study_materials (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            subject_id INTEGER,

            title TEXT NOT NULL,

            description TEXT,

            type TEXT,

            url TEXT,

            branch TEXT,

            semester TEXT,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);


    db.run(`
        CREATE TABLE IF NOT EXISTS updates (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            description TEXT,

            type TEXT,

            important INTEGER DEFAULT 0,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);


    db.run(`
        CREATE TABLE IF NOT EXISTS career_posts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            description TEXT,

            company TEXT,

            location TEXT,

            type TEXT,

            url TEXT,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP

        )
    `);
    
// ================================
// ADMIN TABLE
// ================================

db.run(`
    CREATE TABLE IF NOT EXISTS admins (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        username TEXT UNIQUE NOT NULL,

        password TEXT NOT NULL,

        created_at TEXT DEFAULT CURRENT_TIMESTAMP

    )
`);

    db.run(`
        INSERT OR REPLACE INTO admins (id, username, password)
        VALUES (1, 'admin', 'Admin@12345')
    `);
saveDatabase();
    console.log("✅ Database ready");

}


// Save database to phone

function saveDatabase() {

    const data = db.export();

    fs.writeFileSync(
        DB_FILE,
        Buffer.from(data)
    );

}


// ================================
// TEST API
// ================================

app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        message:
            "Polytechnic Student Hub backend is running 🚀"

    });

});


// ================================
// AUTH HELPERS
// ================================

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
}


app.get("/api/test-email", async (req, res) => {
    try {
        await mailTransporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.SMTP_USER,
            subject: "Polytechnic Hub - Email Test",
            text: "Gmail OTP email system is working successfully."
        });

        res.json({
            success: true,
            message: "Test email sent successfully."
        });

    } catch (error) {
        console.error("EMAIL TEST ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Email could not be sent."
        });
    }
});

// ================================
// CURRENT SESSION
// ================================

app.get("/api/me", (req, res) => {
    if (!req.session.studentId) {
        return res.status(401).json({
            authenticated: false
        });
    }

    res.json({
        authenticated: true,
        studentId: req.session.studentId
    });
});

// ================================
// SIGNUP
// ================================

app.post("/api/signup", (req, res) => {

    let {
        name,
        email,
        phone,
        password,
        college,
        branch,
        year,
        semester,
        goal
    } = req.body;

    name = String(name || "").trim();
    email = normalizeEmail(email);
    phone = normalizePhone(phone);
    password = String(password || "");

    college = String(college || "").trim();
    branch = String(branch || "").trim();
    year = String(year || "").trim();
    semester = String(semester || "").trim();
    goal = String(goal || "").trim();

    // All signup details are required
    if (!name || !email || !phone || !password ||
        !college || !branch || !year || !semester || !goal) {
        return res.status(400).json({
            success: false,
            message: "All signup details are required."
        });
    }

    // Email OR phone required
    if (!email && !phone) {
        return res.status(400).json({
            success: false,
            message: "Enter at least an email or phone number."
        });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            message: "Phone number must be exactly 10 digits."
        });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid email address."
        });
    }

    if (!name || !password || !college ||
        !branch || !year || !semester) {

        return res.status(400).json({
            success: false,
            message: "Please fill all required student details."
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters."
        });
    }

    try {

        // Check email
        if (email) {

            const checkEmail = db.prepare(`
                SELECT id FROM students
                WHERE LOWER(email) = ?
                LIMIT 1
            `);

            checkEmail.bind([email]);

            if (checkEmail.step()) {
                checkEmail.free();

                return res.status(409).json({
                    success: false,
                    message: "This email is already registered."
                });
            }

            checkEmail.free();
        }

        // Check phone
        if (phone) {

            const checkPhone = db.prepare(`
                SELECT id FROM students
                WHERE phone = ?
                LIMIT 1
            `);

            checkPhone.bind([phone]);

            if (checkPhone.step()) {
                checkPhone.free();

                return res.status(409).json({
                    success: false,
                    message: "This phone number is already registered."
                });
            }

            checkPhone.free();
        }

        const statement = db.prepare(`
            INSERT INTO students
            (
                name,
                email,
                phone,
                password,
                college,
                branch,
                year,
                semester,
                goal
            )
            VALUES (?,?,?,?,?,?,?,?,?)
        `);

        statement.bind([
            name,
            email || null,
            phone || null,
            hashPassword(password),
            college,
            branch,
            year,
            semester,
            goal
        ]);

        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Account created successfully 🎉"
        });

    } catch (error) {

        console.log("SIGNUP ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Could not create account."
        });
    }

});


// ================================
// LOGIN
// ================================



app.post("/api/login", (req, res) => {

    const identifier =
        String(req.body.identifier || "").trim();

    const password =
        String(req.body.password || "");

    if (!identifier || !password) {

        return res.status(400).json({
            success: false,
            message: "Email/phone and password are required."
        });
    }

    const email =
        normalizeEmail(identifier);

    const phone =
        normalizePhone(identifier);

    const statement = db.prepare(`
        SELECT
            id,
            name,
            email,
            phone,
            password,
            college,
            branch,
            year,
            semester,
            goal
        FROM students
        WHERE
            LOWER(email) = ? OR phone = ?
        LIMIT 1
    `);

    statement.bind([
        email,
        phone
    ]);

    if (!statement.step()) {

        statement.free();

        return res.status(401).json({
            success: false,
            message: "Invalid email/phone or password."
        });
    }

    const student =
        statement.getAsObject();

    statement.free();

    // Support both secure hashes and old plain-text passwords.
    const isHashedPassword =
        String(student.password || "").includes(":");

    let passwordValid = false;

    if (isHashedPassword) {

        passwordValid =
            verifyPassword(password, student.password);

    } else {

        // Legacy account: compare old plain-text password.
        passwordValid =
            student.password === password;

        // Upgrade it immediately after successful login.
        if (passwordValid) {

            const upgrade = db.prepare(`
                UPDATE students
                SET password = ?
                WHERE id = ?
            `);

            upgrade.bind([
                hashPassword(password),
                student.id
            ]);

            upgrade.step();
            upgrade.free();

            saveDatabase();
        }
    }

    if (!passwordValid) {

        return res.status(401).json({
            success: false,
            message: "Invalid email/phone or password."
        });
    }

    delete student.password;

    req.session.studentId = student.id;

    res.json({
        success: true,
        message:
            `Welcome ${student.name}! 👋`,
        student
    });

});


// ================================

// ================================
// FORGOT PASSWORD / OTP
// ================================

app.post("/api/forgot-password", async (req, res) => {

    const identifier =
        String(req.body.identifier || "").trim();

    if (!identifier) {
        return res.status(400).json({
            success: false,
            message: "Email or phone number is required."
        });
    }

    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);

    const statement = db.prepare(`
        SELECT id, email, phone
        FROM students
        WHERE LOWER(email) = ? OR phone = ?
        LIMIT 1
    `);

    statement.bind([email, phone]);

    if (!statement.step()) {
        statement.free();

        return res.status(404).json({
            success: false,
            message: "No account found with this email/phone."
        });
    }

    const student = statement.getAsObject();
    statement.free();

    /*
     * PHONE OTP
     * 2Factor generates and sends the OTP.
     */
    if (student.phone && phone === normalizePhone(student.phone)) {

        try {

            const phoneNumber =
                String(student.phone).replace(/\D/g, "");

            const internationalPhone =
                phoneNumber.startsWith("91")
                    ? `+${phoneNumber}`
                    : `+91${phoneNumber}`;

            const url =
                `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}` +
                `/SMS/${encodeURIComponent(internationalPhone)}` +
                `/AUTOGEN/PolytechnicHubOTP`;

            const response =
                await fetch(url);

            const result =
                await response.json();

            if (
                !response.ok ||
                result.Status !== "Success" ||
                !result.Details
            ) {
                console.error(
                    "2FACTOR SMS ERROR:",
                    result
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not send SMS OTP."
                });
            }

            const update = db.prepare(`
                UPDATE students
                SET reset_otp = ?,
                    reset_otp_expires = ?
                WHERE id = ?
            `);

            update.bind([
                String(result.Details),
                Date.now() + (10 * 60 * 1000),
                student.id
            ]);

            update.step();
            update.free();

            saveDatabase();

            return res.json({
                success: true,
                message: "OTP sent to your registered phone number."
            });

        } catch (error) {

            console.error(
                "2FACTOR PHONE OTP ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Could not send SMS OTP."
            });
        }
    }

    /*
     * EMAIL OTP
     * Existing Gmail flow.
     */
    const otp =
        String(Math.floor(100000 + Math.random() * 900000));

    const expires =
        Date.now() + (10 * 60 * 1000);

    const update = db.prepare(`
        UPDATE students
        SET reset_otp = ?,
            reset_otp_expires = ?
        WHERE id = ?
    `);

    update.bind([
        otp,
        expires,
        student.id
    ]);

    update.step();
    update.free();

    saveDatabase();

    if (!student.email) {
        return res.status(400).json({
            success: false,
            message: "No email or phone OTP delivery is configured."
        });
    }

    try {

        await mailTransporter.sendMail({
            from: process.env.SMTP_USER,
            to: student.email,
            subject: "Polytechnic Student Hub - Password Reset OTP",
            text:
                `Your password reset OTP is: ${otp}\n\n` +
                `This OTP will expire in 10 minutes.\n` +
                `If you did not request this, you can ignore this email.`
        });

        return res.json({
            success: true,
            message: "OTP sent to your registered email."
        });

    } catch (error) {

        console.error(
            "PASSWORD RESET EMAIL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Could not send OTP email."
        });
    }

});


// ================================
// VERIFY OTP + RESET PASSWORD
// ================================

app.post("/api/reset-password", async (req, res) => {

    const identifier =
        String(req.body.identifier || "").trim();

    const otp =
        String(req.body.otp || "").trim();

    const newPassword =
        String(req.body.newPassword || "");

    if (!identifier || !otp || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters."
        });
    }

    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);

    const statement = db.prepare(`
        SELECT id, email, phone, reset_otp, reset_otp_expires
        FROM students
        WHERE LOWER(email) = ? OR phone = ?
        LIMIT 1
    `);

    statement.bind([email, phone]);

    if (!statement.step()) {
        statement.free();

        return res.status(404).json({
            success: false,
            message: "Account not found."
        });
    }

    const student = statement.getAsObject();
    statement.free();

    /*
     * PHONE OTP
     * reset_otp contains the 2Factor session ID.
     */
    if (
        student.phone &&
        phone === normalizePhone(student.phone)
    ) {

        if (
            !student.reset_otp ||
            Number(student.reset_otp_expires || 0) < Date.now()
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        try {

            const verifyUrl =
                `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}` +
                `/SMS/VERIFY/${encodeURIComponent(student.reset_otp)}` +
                `/${encodeURIComponent(otp)}`;

            const response =
                await fetch(verifyUrl);

            const result =
                await response.json();

            if (
                !response.ok ||
                result.Status !== "Success"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired OTP."
                });
            }

        } catch (error) {

            console.error(
                "2FACTOR OTP VERIFY ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Could not verify SMS OTP."
            });
        }

    } else {

        /*
         * EMAIL OTP
         */
        if (
            String(student.reset_otp || "") !== otp ||
            Number(student.reset_otp_expires || 0) < Date.now()
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }
    }

    const update = db.prepare(`
        UPDATE students
        SET password = ?,
            reset_otp = NULL,
            reset_otp_expires = NULL
        WHERE id = ?
    `);

    update.bind([
        hashPassword(newPassword),
        student.id
    ]);

    update.step();
    update.free();

    saveDatabase();

    return res.json({
        success: true,
        message: "Password reset successfully."
    });

});



// ================================

// ================================
// FEEDBACK
// ================================

app.post("/api/feedback", (req, res) => {

    const {

        studentId,
        college,
        branch,
        year,
        semester,
        used,
        suggestion

    } = req.body;


    try {

        const statement = db.prepare(`

            INSERT INTO feedback

            (
                student_id,
                college,
                branch,
                year,
                semester,
                used,
                suggestion
            )

            VALUES (?,?,?,?,?,?,?)

        `);


        statement.bind([

            studentId || null,

            college || "",

            branch || "",

            year || "",

            semester || "",

            used || "",

            suggestion || ""

        ]);


        statement.step();

        statement.free();


        saveDatabase();


        res.json({

            success: true,

            message:
                "Thank you! Your feedback helps us improve ❤️"

        });


    } catch (error) {

        console.log(error);


        res.status(500).json({

            success: false,

            message:
                "Could not save feedback."

        });

    }

});
// ================================
// STUDY HUB APIs
// ================================

app.get("/api/subjects", requireStudent, (req, res) => {

    const statement = db.prepare(`
        SELECT *
        FROM subjects
        ORDER BY name ASC
    `);

    const subjects = [];

    while (statement.step()) {
        subjects.push(statement.getAsObject());
    }

    statement.free();

    res.json({
        success: true,
        subjects
    });

});


app.get("/api/materials", requireStudent, (req, res) => {

    const {
        branch,
        semester,
        subjectId
    } = req.query;

    let query = `
        SELECT
            study_materials.*,
            subjects.name AS subject_name
        FROM study_materials
        LEFT JOIN subjects
            ON study_materials.subject_id = subjects.id
        WHERE 1 = 1
    `;

    const params = [];

    if (branch) {
        query += ` AND study_materials.branch = ?`;
        params.push(branch);
    }

    if (semester) {
        query += ` AND study_materials.semester = ?`;
        params.push(semester);
    }

    if (subjectId) {
        query += ` AND study_materials.subject_id = ?`;
        params.push(subjectId);
    }

    query += `
        ORDER BY study_materials.created_at DESC
    `;

    const statement = db.prepare(query);

    statement.bind(params);

    const materials = [];

    while (statement.step()) {
        materials.push(statement.getAsObject());
    }

    statement.free();

    res.json({
        success: true,
        materials
    });

});
// ================================
// ADD SUBJECT
// ================================

app.post("/api/subjects", (req, res) => {

    const {
        name,
        branch,
        semester
    } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Subject name is required."
        });
    }

    try {

        const statement = db.prepare(`
            INSERT INTO subjects
            (name, branch, semester)
            VALUES (?, ?, ?)
        `);

        statement.bind([
            name,
            branch || "",
            semester || ""
        ]);

        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Subject added successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not add subject."
        });

    }

});



// ================================
// ADMIN PDF UPLOAD
// ================================

app.post(
    "/api/admin/upload-material",
    requireAdmin,
    materialUpload.single("file"),
    (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "PDF file is required."
            });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        res.json({
            success: true,
            url: fileUrl,
            message: "PDF uploaded successfully."
        });
    }
);

// ================================
// ADD STUDY MATERIAL
// ================================

app.post("/api/materials", requireAdmin, materialUpload.single("file"), (req, res) => {

    const {
        subjectId,
        title,
        description,
        type,
        url,
        branch,
        semester
    } = req.body;

    const uploadedUrl = req.file
        ? `/uploads/${req.file.filename}`
        : url;

    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Material title is required."
        });
    }

    try {

        const statement = db.prepare(`
            INSERT INTO study_materials
            (
                subject_id,
                title,
                description,
                type,
                url,
                branch,
                semester
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        statement.bind([
            subjectId || null,
            title,
            description || "",
            type || "",
            uploadedUrl || "",
            branch || "",
            semester || ""
        ]);

        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Study material added successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not add study material."
        });

    }

});
// ================================
// UPDATES APIs
// ================================

// GET ALL UPDATES

app.get("/api/updates", requireStudent, (req, res) => {

    try {

        const statement = db.prepare(`
            SELECT *
            FROM updates
            ORDER BY important DESC, created_at DESC
        `);

        const updates = [];

        while (statement.step()) {
            updates.push(statement.getAsObject());
        }

        statement.free();

        res.json({
            success: true,
            updates
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not load updates."
        });

    }

});


// ADD UPDATE

app.post("/api/updates", (req, res) => {

    const {
        title,
        description,
        type,
        important
    } = req.body;


    if (!title) {

        return res.status(400).json({

            success: false,

            message: "Update title is required."

        });

    }


    try {

        const statement = db.prepare(`

            INSERT INTO updates

            (
                title,
                description,
                type,
                important
            )

            VALUES (?, ?, ?, ?)

        `);


        statement.bind([

            title,

            description || "",

            type || "General",

            important ? 1 : 0

        ]);


        statement.step();

        statement.free();


        saveDatabase();


        res.json({

            success: true,

            message: "Update added successfully."

        });


    } catch (error) {

        console.log(error);


        res.status(500).json({

            success: false,

            message: "Could not add update."

        });

    }

});
// ================================
// CAREER APIs
// ================================

app.get("/api/career", requireStudent, (req, res) => {

    try {

        const statement = db.prepare(`
            SELECT *
            FROM career_posts
            ORDER BY created_at DESC
        `);

        const career = [];

        while (statement.step()) {
            career.push(statement.getAsObject());
        }

        statement.free();

        res.json({
            success: true,
            career
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not load career posts."
        });

    }

});


app.post("/api/career", (req, res) => {

    const {
        title,
        description,
        company,
        location,
        type,
        url
    } = req.body;


    if (!title) {

        return res.status(400).json({
            success: false,
            message: "Career title is required."
        });

    }


    try {

        const statement = db.prepare(`
            INSERT INTO career_posts
            (
                title,
                description,
                company,
                location,
                type,
                url
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);


        statement.bind([
            title,
            description || "",
            company || "",
            location || "",
            type || "Opportunity",
            url || ""
        ]);


        statement.step();
        statement.free();

        saveDatabase();


        res.json({
            success: true,
            message: "Career post added successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not add career post."
        });

    }

});// ================================
// ADMIN LOGIN
// ================================

app.post("/api/admin/login", (req, res) => {

    const {
        username,
        password
    } = req.body;


    if (!username || !password) {

        return res.status(400).json({

            success: false,

            message: "Username and password are required."

        });

    }


    try {

        const statement = db.prepare(`

            SELECT
                id,
                username

            FROM admins

            WHERE username = ?

            AND password = ?

        `);


        statement.bind([
            username,
            password
        ]);


        if (!statement.step()) {

            statement.free();

            return res.status(401).json({

                success: false,

                message: "Invalid admin username or password."

            });

        }


        const admin =
            statement.getAsObject();

        statement.free();

req.session.adminId = admin.id;
req.session.adminUsername = admin.username;
        res.json({

            success: true,

            message: "Admin login successful.",
            admin

        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: "Admin login failed."

        });

    }

});
function requireStudent(req, res, next) {
    if (!req.session.userId && !req.session.studentId) {
        return res.status(401).json({
            success: false,
            message: "Student login required."
        });
    }
    next();
}

function requireAdmin(req, res, next) {

    if (!req.session.adminId) {

        return res.status(401).json({
            success: false,
            message: "Admin login required."
        });

    }

    next();
}
//  ================================
// ADMIN DELETE APIs
// ================================


// DELETE SUBJECT

app.delete("/api/admin/subjects/:id", requireAdmin, (req, res) => {

    const id = Number(req.params.id);

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Invalid subject ID."
        });
    }

    try {

        const statement = db.prepare(`
            DELETE FROM subjects
            WHERE id = ?
        `);

        statement.bind([id]);
        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Subject deleted successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not delete subject."
        });

    }

});


// DELETE STUDY MATERIAL

app.delete("/api/admin/materials/:id", requireAdmin, (req, res) => {

    const id = Number(req.params.id);

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Invalid material ID."
        });
    }

    try {

        const find = db.prepare(`
            SELECT url FROM study_materials
            WHERE id = ?
        `);

        find.bind([id]);

        let material = null;
        if (find.step()) {
            material = find.getAsObject();
        }
        find.free();

        const statement = db.prepare(`
            DELETE FROM study_materials
            WHERE id = ?
        `);

        statement.bind([id]);
        statement.step();
        statement.free();

        if (material && material.url && material.url.startsWith("/uploads/")) {
            const filePath = path.join(__dirname, "public", material.url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        saveDatabase();

        res.json({
            success: true,
            message: "Study material deleted successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not delete material."
        });

    }

});


// DELETE UPDATE

app.delete("/api/admin/updates/:id", requireAdmin, (req, res) => {

    const id = Number(req.params.id);

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Invalid update ID."
        });
    }

    try {

        const statement = db.prepare(`
            DELETE FROM updates
            WHERE id = ?
        `);

        statement.bind([id]);
        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Update deleted successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not delete update."
        });

    }

});


// DELETE CAREER POST

app.delete("/api/admin/career/:id", requireAdmin, (req, res) => {

    const id = Number(req.params.id);

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Invalid career post ID."
        });
    }

    try {

        const statement = db.prepare(`
            DELETE FROM career_posts
            WHERE id = ?
        `);

        statement.bind([id]);
        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Career post deleted successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not delete career post."
        });

    }

});

// ================================
// ADMIN DATA APIs
// ================================

app.get("/api/admin/students", requireAdmin, (req, res) => {

    try {

        const statement = db.prepare(`
            SELECT
                id,
                name,
                email,
                college,
                branch,
                year,
                semester,
                goal,
                created_at
            FROM students
            ORDER BY created_at DESC
        `);

        const students = [];

        while (statement.step()) {
            students.push(statement.getAsObject());
        }

        statement.free();

        res.json({
            success: true,
            students
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not load students."
        });

    }

});


app.get("/api/admin/feedback", requireAdmin, (req, res) => {

    try {

        const statement = db.prepare(`
            SELECT *
            FROM feedback
            ORDER BY created_at DESC
        `);

        const feedback = [];

        while (statement.step()) {
            feedback.push(statement.getAsObject());
        }

        statement.free();

        res.json({
            success: true,
            feedback
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not load feedback."
        });

    }

});



// ================================
// ADMIN DELETE STUDENT
// ================================

app.delete("/api/admin/students/:id", requireAdmin, (req, res) => {

    try {

        const statement = db.prepare(`
            DELETE FROM students
            WHERE id = ?
        `);

        statement.bind([
            Number(req.params.id)
        ]);

        statement.step();
        statement.free();

        saveDatabase();

        res.json({
            success: true,
            message: "Student deleted successfully."
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Could not delete student."
        });

    }

});

// ================================
// START SERVER
// ================================

startDatabase().then(() => {

    app.listen(
        PORT,
        "0.0.0.0",
        () => {


            console.log(
                `🚀 Server running at http://127.0.0.1:${PORT}`
            );

        }
    );

});
