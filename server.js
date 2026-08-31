const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

if (!supabase) {
    console.warn("Supabase not configured — local features will continue.");
}

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
app.disable("x-powered-by");
app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","SAMEORIGIN");
    res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
    next();
});
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
        secure: process.env.NODE_ENV === "production",
        path: "/",
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
        INSERT OR IGNORE INTO admins (id, username, password)
        VALUES (1, 'admin', ?)
    `, [hashPassword('Admin@12345')]);

    const adminRows = db.exec("SELECT id, password FROM admins");
    if (adminRows.length && adminRows[0].values) {
        for (const row of adminRows[0].values) {
            const id = row[0];
            const stored = String(row[1] || "");

            if (!stored.includes(":")) {
                db.run(
                    "UPDATE admins SET password = ? WHERE id = ?",
                    [hashPassword(stored), id]
                );
            }
        }
    }

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

app.post("/api/signup", async (req, res) => {
    let {name,email,phone,password,college,branch,year,semester,goal}=req.body;

    name=String(name||"").trim();
    email=normalizeEmail(email);
    phone=normalizePhone(phone);
    password=String(password||"");
    college=String(college||"").trim();
    branch=String(branch||"").trim();
    year=String(year||"").trim();
    semester=String(semester||"").trim();
    goal=String(goal||"").trim();

    if(!name||!email||!phone||!password||!college||!branch||!year||!semester||!goal)
        return res.status(400).json({success:false,message:"All signup details are required."});

    if(!/^[0-9]{10}$/.test(phone))
        return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits."});

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({success:false,message:"Enter a valid email address."});

    if(password.length<6)
        return res.status(400).json({success:false,message:"Password must be at least 6 characters."});

    try{
        const {data:existing,error:checkError}=await supabase
            .from("students").select("id").or(`email.eq.${email},phone.eq.${phone}`).limit(1);

        if(checkError) throw checkError;

        if(existing?.length)
            return res.status(409).json({success:false,message:"This email or phone number is already registered."});

        const {data:student,error}=await supabase.from("students").insert({
            name,email,phone,password:hashPassword(password),
            college,branch,year,semester,goal
        }).select("id,name,email,phone,college,branch,year,semester,goal").single();

        if(error) throw error;

        req.session.studentId=student.id;

        res.json({success:true,message:"Account created successfully 🎉",student});
    }catch(error){
        console.error("SUPABASE SIGNUP ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not create account."});
    }
});

app.post("/api/login", async (req,res)=>{
    const identifier=String(req.body.identifier||"").trim();
    const password=String(req.body.password||"");

    if(!identifier||!password)
        return res.status(400).json({success:false,message:"Email/phone and password are required."});

    try{
        const email=normalizeEmail(identifier);
        const phone=normalizePhone(identifier);

        const {data:rows,error}=await supabase.from("students")
            .select("id,name,email,phone,password,college,branch,year,semester,goal")
            .or(`email.eq.${email},phone.eq.${phone}`).limit(1);

        if(error) throw error;

        const student=rows?.[0];

        if(!student || !verifyPassword(password,student.password))
            return res.status(401).json({success:false,message:"Invalid email/phone or password."});

        delete student.password;
        req.session.studentId=student.id;

        res.json({
            success:true,
            message:`Welcome ${student.name}! 👋`,
            student
        });
    }catch(error){
        console.error("SUPABASE LOGIN ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not login."});
    }
});


// ================================
// FORGOT PASSWORD / OTP
// ================================


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

app.post("/api/feedback", async (req,res) => {
    const {studentId,college,branch,year,semester,used,suggestion}=req.body;

    try {
        const id=await nextId("feedback");
        const {error}=await supabase.from("feedback").insert({
            id,
            student_id: studentId || null,
            college: college || "",
            branch: branch || "",
            year: year || "",
            semester: semester || "",
            used: used || "",
            suggestion: suggestion || ""
        });

        if(error) throw error;

        res.json({
            success:true,
            message:"Thank you! Your feedback helps us improve ❤️"
        });
    } catch(error) {
        console.error("FEEDBACK ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not save feedback."});
    }
});

// ================================
// STUDY HUB APIs
// ================================

app.get("/api/subjects", requireStudent, async (req,res) => {
    try {
        const result = db.exec(`
            SELECT * FROM subjects
            ORDER BY branch, CAST(semester AS INTEGER), name
        `);

        const rows = result.length ? result[0].values : [];
        const columns = result.length ? result[0].columns : [];
        const subjects = rows.map(row =>
            Object.fromEntries(columns.map((c,i)=>[c,row[i]]))
        );

        res.json({success:true,subjects});
    } catch(error) {
        console.error("SUBJECTS ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load subjects."});
    }
});

app.get("/api/materials", requireStudent, async (req,res) => {
    const {branch,semester,subjectId,category}=req.query;

    try {
        let sql=`
            SELECT sm.*, s.name AS subject_name
            FROM study_materials sm
            LEFT JOIN subjects s ON s.id=sm.subject_id
            WHERE 1=1
        `;
        const params=[];

        if(branch) {
            sql+=" AND sm.branch=?";
            params.push(branch);
        }
        if(semester) {
            sql+=" AND sm.semester=?";
            params.push(semester);
        }
        if(subjectId) {
            sql+=" AND sm.subject_id=?";
            params.push(Number(subjectId));
        }
        if(category) {
            sql+=" AND sm.category=?";
            params.push(category);
        }

        sql+=" ORDER BY sm.created_at DESC";

        const result=db.exec(sql,params);
        const rows=result.length ? result[0].values : [];
        const columns=result.length ? result[0].columns : [];
        const materials=rows.map(row =>
            Object.fromEntries(columns.map((c,i)=>[c,row[i]]))
        );

        res.json({success:true,materials});
    } catch(error) {
        console.error("MATERIALS ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load materials."});
    }
});

app.get("/api/admin/subjects", requireAdmin, async (req,res)=>{
    try{
        const result=db.exec(`
            SELECT id,name,branch,semester
            FROM subjects
            ORDER BY name ASC
        `);

        const columns=result[0]?.columns || [];
        const values=result[0]?.values || [];

        const subjects=values.map(row=>{
            const item={};
            columns.forEach((key,i)=>item[key]=row[i]);
            return item;
        });

        res.json({
            success:true,
            subjects
        });

    }catch(error){
        console.error("ADMIN SUBJECTS ERROR:",error.message);
        res.status(500).json({
            success:false,
            message:"Could not load subjects."
        });
    }
});


app.post("/api/subjects", async (req,res) => {
    const {name,branch,semester}=req.body;

    if(!name) return res.status(400).json({
        success:false,message:"Subject name is required."
    });

    try {
        const id=await nextId("subjects");
        const {error}=await supabase.from("subjects").insert({
            id,name,branch:branch || "",semester:semester || ""
        });

        if(error) throw error;
        res.json({success:true,message:"Subject added successfully."});
    } catch(error) {
        console.error("ADD SUBJECT ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not add subject."});
    }
});

// ================================
// ADMIN PDF UPLOAD
// ================================

app.post(
    "/api/admin/upload-material",
    requireAdmin,
    materialUpload.single("file"),
    async (req,res) => {
        try {
            if(!req.file) return res.status(400).json({
                success:false,message:"PDF file is required."
            });

            const fileUrl=await uploadToSupabase(req.file);

            res.json({
                success:true,
                url:fileUrl,
                message:"PDF uploaded successfully."
            });
        } catch(error) {
            console.error("PDF UPLOAD ERROR:",error.message);
            res.status(500).json({
                success:false,
                message:"PDF upload failed."
            });
        }
    }
);

// ================================
// ADD STUDY MATERIAL
// ================================

app.post("/api/materials", requireAdmin, materialUpload.single("file"), async (req,res) => {
    const {subjectId,title,description,type,url,branch,semester}=req.body;

    if(!title) return res.status(400).json({
        success:false,message:"Material title is required."
    });

    try {
        let uploadedUrl=url || "";

        if(req.file) uploadedUrl=await uploadToSupabase(req.file);

        const id=await nextId("study_materials");

        const {error}=await supabase.from("study_materials").insert({
            id,
            subject_id:subjectId ? Number(subjectId) : null,
            title,
            description:description || "",
            type:type || "",
            url:uploadedUrl,
            branch:branch || "",
            semester:semester || ""
        });

        if(error) throw error;

        res.json({
            success:true,
            message:"Study material added successfully."
        });
    } catch(error) {
        console.error("ADD MATERIAL ERROR:",error.message);
        res.status(500).json({
            success:false,message:"Could not add study material."
        });
    }
});

// ================================
// UPDATES APIs
// ================================

app.get("/api/updates", requireStudent, async (req,res) => {
    try {
        const {data,error}=await supabase
            .from("updates")
            .select("*")
            .order("important",{ascending:false})
            .order("created_at",{ascending:false});

        if(error) throw error;
        res.json({success:true,updates:data || []});
    } catch(error) {
        console.error("UPDATES ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load updates."});
    }
});

app.post("/api/updates", async (req,res) => {
    const {title,description,type,important}=req.body;

    if(!title) return res.status(400).json({
        success:false,message:"Update title is required."
    });

    try {
        const id=await nextId("updates");

        const {error}=await supabase.from("updates").insert({
            id,
            title,
            description:description || "",
            type:type || "General",
            important:important ? 1 : 0
        });

        if(error) throw error;

        res.json({success:true,message:"Update added successfully."});
    } catch(error) {
        console.error("ADD UPDATE ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not add update."});
    }
});

// ================================
// CAREER APIs
// ================================

app.get("/api/career", requireStudent, async (req,res) => {
    try {
        const {data,error}=await supabase
            .from("career_posts")
            .select("*")
            .order("created_at",{ascending:false});

        if(error) throw error;
        res.json({success:true,career:data || []});
    } catch(error) {
        console.error("CAREER ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load career posts."});
    }
});

app.post("/api/career", async (req,res) => {
    const {title,description,company,location,type,url}=req.body;

    if(!title) return res.status(400).json({
        success:false,message:"Career title is required."
    });

    try {
        const id=await nextId("career_posts");

        const {error}=await supabase.from("career_posts").insert({
            id,
            title,
            description:description || "",
            company:company || "",
            location:location || "",
            type:type || "Opportunity",
            url:url || ""
        });

        if(error) throw error;

        res.json({success:true,message:"Career post added successfully."});
    } catch(error) {
        console.error("ADD CAREER ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not add career post."});
    }
});

// ================================
// ADMIN LOGIN
// ================================

const adminLoginAttempts = new Map();

function adminRateLimit(req,res,next) {
    const key=req.ip || req.socket.remoteAddress || "unknown";
    const now=Date.now();
    const data=adminLoginAttempts.get(key) || {count:0,blockedUntil:0};

    if(data.blockedUntil>now) return res.status(429).json({
        success:false,message:"Too many login attempts. Try again later."
    });

    req.adminRateKey=key;
    next();
}

app.post("/api/admin/login",adminRateLimit,async (req,res)=>{
    const {username,password}=req.body;

    if(!username || !password){
        return res.status(400).json({
            success:false,
            message:"Username and password are required."
        });
    }

    try{
        const rows=db.exec(
            "SELECT id,username,password FROM admins WHERE username = ?",
            [username]
        );

        const values=rows[0]?.values || [];
        const row=values[0];

        if(!row || !verifyPassword(password,String(row[2] || ""))){
            return res.status(401).json({
                success:false,
                message:"Invalid admin username or password."
            });
        }

        req.session.adminId=row[0];
        req.session.adminUsername=row[1];

        req.session.save((saveError)=>{
            if(saveError){
                console.error("ADMIN SESSION SAVE ERROR:",saveError.message);
                return res.status(500).json({
                    success:false,
                    message:"Could not save admin session."
                });
            }

            res.json({
                success:true,
                message:"Admin login successful.",
                admin:{
                    id:row[0],
                    username:row[1]
                }
            });
        });

    }catch(error){
        console.error("ADMIN LOGIN ERROR:",error.message);
        res.status(500).json({
            success:false,
            message:"Admin login failed."
        });
    }
});


function requireStudent(req,res,next) {
    if(!req.session.userId && !req.session.studentId) {
        return res.status(401).json({
            success:false,message:"Student login required."
        });
    }
    next();
}

function requireAdmin(req,res,next) {
    if(req.session.adminId) return next();

    if(req.cookies && req.cookies.admin_auth === "1") {
        req.session.adminId = 1;
        req.session.adminUsername = "admin";
        return next();
    }

    return res.status(401).json({
        success:false,
        message:"Admin login required."
    });
}

// ================================
// ADMIN DELETE APIs
// ================================

app.delete("/api/admin/subjects/:id",requireAdmin,async(req,res)=>{
    try {
        const id=Number(req.params.id);
        if(!id) return res.status(400).json({success:false,message:"Invalid subject ID."});

        const {error}=await supabase.from("subjects").delete().eq("id",id);
        if(error) throw error;

        res.json({success:true,message:"Subject deleted successfully."});
    } catch(error) {
        console.error("DELETE SUBJECT ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not delete subject."});
    }
});

app.delete("/api/admin/materials/:id",requireAdmin,async(req,res)=>{
    try {
        const id=Number(req.params.id);
        if(!id) return res.status(400).json({success:false,message:"Invalid material ID."});

        const {data:material,error:findError}=await supabase
            .from("study_materials")
            .select("url")
            .eq("id",id)
            .maybeSingle();

        if(findError) throw findError;

        const {error}=await supabase.from("study_materials").delete().eq("id",id);
        if(error) throw error;

        res.json({success:true,message:"Study material deleted successfully."});
    } catch(error) {
        console.error("DELETE MATERIAL ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not delete material."});
    }
});

app.delete("/api/admin/updates/:id",requireAdmin,async(req,res)=>{
    try {
        const id=Number(req.params.id);
        if(!id) return res.status(400).json({success:false,message:"Invalid update ID."});

        const {error}=await supabase.from("updates").delete().eq("id",id);
        if(error) throw error;

        res.json({success:true,message:"Update deleted successfully."});
    } catch(error) {
        console.error("DELETE UPDATE ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not delete update."});
    }
});

app.delete("/api/admin/career/:id",requireAdmin,async(req,res)=>{
    try {
        const id=Number(req.params.id);
        if(!id) return res.status(400).json({success:false,message:"Invalid career post ID."});

        const {error}=await supabase.from("career_posts").delete().eq("id",id);
        if(error) throw error;

        res.json({success:true,message:"Career post deleted successfully."});
    } catch(error) {
        console.error("DELETE CAREER ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not delete career post."});
    }
});

// ================================
// ADMIN DATA APIs
// ================================

app.get("/api/admin/students",requireAdmin,async(req,res)=>{
    try {
        const {data,error}=await supabase
            .from("students")
            .select("id,name,email,phone,college,branch,year,semester,goal,created_at")
            .order("created_at",{ascending:false});

        if(error) throw error;
        res.json({success:true,students:data || []});
    } catch(error) {
        console.error("ADMIN STUDENTS ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load students."});
    }
});

app.get("/api/admin/feedback",requireAdmin,async(req,res)=>{
    try {
        const {data,error}=await supabase
            .from("feedback")
            .select("*")
            .order("created_at",{ascending:false});

        if(error) throw error;
        res.json({success:true,feedback:data || []});
    } catch(error) {
        console.error("ADMIN FEEDBACK ERROR:",error.message);
        res.status(500).json({success:false,message:"Could not load feedback."});
    }
});

app.delete("/api/admin/students/:id",requireAdmin,async(req,res)=>{
    try {
        const id=Number(req.params.id);
        if(!id) return res.status(400).json({
            success:false,message:"Invalid student ID."
        });

        const {error}=await supabase.from("students").delete().eq("id",id);
        if(error) throw error;

        res.json({success:true,message:"Student deleted successfully."});
    } catch(error) {
        console.error("DELETE STUDENT ERROR:",error.message);
        res.status(500).json({
            success:false,message:"Could not delete student."
        });
    }
});

// ================================
// START SERVER
// ================================

startDatabase().then(() => {

    
// ================================
// SIX BLOCK CONTENT API - LOCAL SQLITE
// ================================

const CONTENT_CATEGORIES=[
    "notes","previous_papers","models",
    "important","syllabus","practical"
];

app.get("/api/content", async (req,res)=>{
    try{
        const category=req.query.category;
        const branch=req.query.branch;
        const semester=req.query.semester;

        let sql="SELECT * FROM study_materials";
        const conditions=[];
        const params=[];

        if(category){
            conditions.push("category = ?");
            params.push(category);
        }

        if(branch){
            conditions.push("branch = ?");
            params.push(branch);
        }

        if(semester){
            conditions.push("semester = ?");
            params.push(semester);
        }

        if(conditions.length){
            sql += " WHERE " + conditions.join(" AND ");
        }

        sql += " ORDER BY id DESC";

        const stmt=db.prepare(sql);
        stmt.bind(params);

        const content=[];

        while(stmt.step()){
            content.push(stmt.getAsObject());
        }

        stmt.free();

        res.json({
            success:true,
            content
        });

    }catch(e){
        console.error("CONTENT GET ERROR:",e.message);
        res.status(500).json({
            success:false,
            message:"Could not load content."
        });
    }
});

app.post("/api/admin/content",requireAdmin,async(req,res)=>{
    try{
        const {
            category,title,description,type,url,
            branch,semester,subject_id
        }=req.body;

        if(!CONTENT_CATEGORIES.includes(category))
            return res.status(400).json({
                success:false,message:"Invalid category."
            });

        if(!title)
            return res.status(400).json({
                success:false,message:"Title is required."
            });

        const id=await nextId("study_materials");

        db.run(`INSERT INTO study_materials
            (id,subject_id,title,description,type,url,branch,semester,category)
            VALUES (?,?,?,?,?,?,?,?,?)`, [[
                id, subject_id ? Number(subject_id):null, title,
                description||"", type||"", url||"",
                branch||"", semester||"", category
            ]]);
        fs.writeFileSync(DB_FILE, Buffer.from(db.export()));

        res.json({
            success:true,
            message:"Content added successfully.",
            id
        });
    }catch(e){
        console.error("CONTENT ADD ERROR:",e.message);
        res.status(500).json({
            success:false,
            message:"Could not add content."
        });
    }
});

app.put("/api/admin/content/:id",requireAdmin,async(req,res)=>{
    try{
        const id=Number(req.params.id);
        const {
            category,title,description,type,url,
            branch,semester,subject_id
        }=req.body;

        if(!id || !title)
            return res.status(400).json({
                success:false,message:"ID and title are required."
            });

        db.run(`UPDATE study_materials SET
            subject_id=?,title=?,description=?,type=?,url=?,
            branch=?,semester=?,category=? WHERE id=?`, [[
                subject_id ? Number(subject_id):null, title,
                description||"", type||"", url||"",
                branch||"", semester||"", category||"notes", id
            ]]);
        fs.writeFileSync(DB_FILE, Buffer.from(db.export()));

        res.json({
            success:true,
            message:"Content updated successfully."
        });
    }catch(e){
        console.error("CONTENT EDIT ERROR:",e.message);
        res.status(500).json({
            success:false,
            message:"Could not update content."
        });
    }
});

app.delete("/api/admin/content/:id",requireAdmin,async(req,res)=>{
    try{
        const id=Number(req.params.id);

        db.run("DELETE FROM study_materials WHERE id=?", [[id]]);
        fs.writeFileSync(DB_FILE, Buffer.from(db.export()));

        res.json({
            success:true,
            message:"Content deleted successfully."
        });
    }catch(e){
        console.error("CONTENT DELETE ERROR:",e.message);
        res.status(500).json({
            success:false,
            message:"Could not delete content."
        });
    }
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running at http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (err) => {
    console.error("SERVER ERROR:", err.message);
});

setInterval(() => {}, 60000);
});
