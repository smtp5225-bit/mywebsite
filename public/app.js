const $ = (selector) => document.querySelector(selector);

// ===============================
// ELEMENTS
// ===============================

const dialog = $("#profileDialog");

const loginBtn = $("#loginBtn");
const profileBtn = $("#profileBtn");

const recordNavBtn = $("#recordNavBtn");
const recordDialog = $("#recordDialog");
const closeRecordDialog = $("#closeRecordDialog");

function updateRecordNavigation(){

    const loggedIn =
        localStorage.getItem("polytechnicLoggedIn") === "true";

    if(recordNavBtn){

        recordNavBtn.style.display =
            loggedIn ? "inline-flex" : "none";

    }

}

function showMyRecord(){

    if(
        localStorage.getItem("polytechnicLoggedIn")
        !== "true"
    ){
        return;
    }

    $("#recordName").textContent =
        localStorage.getItem("studentName") || "—";

    $("#recordEmail").textContent =
        localStorage.getItem("studentEmail") || "—";

    $("#recordCollege").textContent =
        localStorage.getItem("studentCollege") || "—";

    $("#recordBranch").textContent =
        localStorage.getItem("studentBranch") || "—";

    $("#recordYear").textContent =
        localStorage.getItem("studentYear") || "—";

    $("#recordSemester").textContent =
        localStorage.getItem("studentSemester") || "—";

    $("#recordGoal").textContent =
        localStorage.getItem("studentGoal")
        || "Not decided yet";

    recordDialog?.showModal();

}

recordNavBtn?.addEventListener(
    "click",
    showMyRecord
);

closeRecordDialog?.addEventListener(
    "click",
    () => recordDialog?.close()
);


const personalizeBtn = $("#personalizeBtn");

const closeDialog = $("#closeDialog");

const signupForm = $("#signupForm");
const loginForm = $("#loginForm");

const switchAuth = $("#switchAuth");

const authTitle = $("#authTitle");
const authSubtitle = $("#authSubtitle");
const authMessage = $("#authMessage");

const menuBtn = $("#menuBtn");
const mainNav = $("#mainNav");

let signupMode = true;


// ===============================
// AUTH MODAL
// ===============================

function openAuth() {
    if (!dialog) return;

    dialog.showModal();

    // Default to signup
    signupMode = true;

    signupForm.style.display = "block";
    loginForm.style.display = "none";

    authTitle.textContent = "Create your account";
    authSubtitle.textContent =
        "Start your personalized Polytechnic journey.";

    switchAuth.textContent =
        "Already have an account? Login";

    clearMessage();
}

loginBtn?.addEventListener("click", () => {

    // If already logged in, button acts as logout
    if (
        localStorage.getItem("polytechnicLoggedIn") === "true"
    ) {
        logout();
        return;
    }

    openAuth();
});



function updateProfileButton(){

    if (!profileBtn) return;

    const loggedIn =
        localStorage.getItem("polytechnicLoggedIn") === "true";

    profileBtn.textContent =
        loggedIn
        ? "👤 Mera Record"
        : "Create Student Profile";
}

function openStudentRecord(){

    showMyRecord();

}

profileBtn?.addEventListener("click", () => {

    const loggedIn =
        localStorage.getItem("polytechnicLoggedIn") === "true";

    if (loggedIn) {
        openStudentRecord();
    } else {
        openAuth();
    }

});

personalizeBtn?.addEventListener("click", openAuth);


// ===============================
// CLOSE MODAL
// ===============================

closeDialog?.addEventListener("click", () => {

    dialog.close();

    clearMessage();

});


// Close when clicking outside card

dialog?.addEventListener("click", (event) => {

    if (event.target === dialog) {
        dialog.close();
        clearMessage();
    }

});


// ===============================
// SWITCH LOGIN / SIGNUP
// ===============================

switchAuth?.addEventListener("click", () => {

    signupMode = !signupMode;

    clearMessage();

    if (signupMode) {

        signupForm.style.display = "block";
        loginForm.style.display = "none";

        authTitle.textContent =
            "Create your account";

        authSubtitle.textContent =
            "Start your personalized Polytechnic journey.";

        switchAuth.textContent =
            "Already have an account? Login";

    } else {

        signupForm.style.display = "none";
        loginForm.style.display = "block";

        authTitle.textContent =
            "Welcome back 👋";

        authSubtitle.textContent =
            "Login to continue your student journey.";

        switchAuth.textContent =
            "New student? Create account";

    }

});


// ===============================
// MESSAGE
// ===============================

function showMessage(message, type = "") {

    if (!authMessage) return;

    authMessage.textContent = message;

    authMessage.className =
        `auth-message ${type}`;

}

function clearMessage() {

    if (!authMessage) return;

    authMessage.textContent = "";

    authMessage.className = "auth-message";

}


// ===============================
// SIGNUP
// ===============================

signupForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    showMessage("Creating your account... ⏳");

    const data = {

        name: $("#signupName").value.trim(),

        email: $("#signupEmail").value.trim(),
        phone: $("#signupPhone").value.trim(),

        password: $("#signupPassword").value,

        college: $("#signupCollege").value.trim(),

        branch: $("#signupBranch").value.trim(),

        year: $("#signupYear").value,

        semester: $("#signupSemester").value,

        goal: $("#signupGoal").value

    };

    try {

        const response = await fetch("/api/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)

        });

        const result = await response.json();

        if (!response.ok) {

            showMessage(
                result.message || "Signup failed.",
                "error"
            );

            return;
        }

        localStorage.setItem(
            "polytechnicLoggedIn",
            "true"
        );
        updateRecordNavigation();

        localStorage.setItem(
            "studentName",
            data.name
        );

        localStorage.setItem(
            "studentEmail",
            data.email
        );

        localStorage.setItem(
            "studentProfile",
            JSON.stringify(data)
        );

        showMessage(
            "Account created successfully! 🎉",
            "success"
        );

        setTimeout(() => {

            dialog.close();

            updateDashboard();

            showWelcomeAnimation();

        }, 700);

    } catch (error) {

        console.error(error);

        showMessage(
            "Server se connection nahi ho pa raha.",
            "error"
        );

    }

});


// ===============================
// LOGIN
// ===============================

loginForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    showMessage("Logging you in... 🔐");

    const data = {

        identifier: $("#loginIdentifier").value.trim(),

        password: $("#loginPassword").value

    };

    try {

        const response = await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)

        });

        const result = await response.json();

        if (!response.ok) {

            showMessage(
                result.message ||
                "Invalid email or password.",
                "error"
            );

            return;
        }

        const student = result.student;

        localStorage.setItem(
            "polytechnicLoggedIn",
            "true"
        );
        updateRecordNavigation();

        localStorage.setItem(
            "studentName",
            student.name
        );

        localStorage.setItem(
            "studentEmail",
            student.email
        );

        localStorage.setItem(
            "studentProfile",
            JSON.stringify(student)
        );

        showMessage(
            `Welcome ${student.name}! 🎉`,
            "success"
        );

        setTimeout(() => {

            dialog.close();

            updateDashboard();

            showWelcomeAnimation();

        }, 700);

    } catch (error) {

        console.error(error);

        showMessage(
            "Server se connection nahi ho pa raha.",
            "error"
        );

    }

});



// ===============================
// FORGOT PASSWORD
// ===============================

const forgotForm =
    document.getElementById("forgotForm");

const otpForm =
    document.getElementById("otpForm");

const resetForm =
    document.getElementById("resetForm");

const forgotIdentifier =
    document.getElementById("forgotIdentifier");

const otpInput =
    document.getElementById("otpInput");

const newPassword =
    document.getElementById("newPassword");

const confirmPassword =
    document.getElementById("confirmPassword");

const forgotPasswordBtn =
    document.getElementById("forgotPasswordBtn");


// OPEN FORGOT PASSWORD

forgotPasswordBtn?.addEventListener("click", () => {

    signupForm.style.display = "none";
    loginForm.style.display = "none";

    forgotForm.style.display = "block";
    otpForm.style.display = "none";
    resetForm.style.display = "none";

    authTitle.textContent =
        "Reset your password 🔐";

    authSubtitle.textContent =
        "Use your email or phone number.";

    clearMessage();

});


// SEND OTP

forgotForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    const identifier =
        forgotIdentifier.value.trim();

    if (!identifier) {
        showMessage(
            "Enter your email or phone number.",
            "error"
        );
        return;
    }

    showMessage("Generating OTP... ⏳");

    try {

        const response = await fetch(
            "/api/forgot-password",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    identifier
                })
            }
        );

        const result =
            await response.json();

        if (!response.ok) {

            showMessage(
                result.message ||
                "Could not generate OTP.",
                "error"
            );

            return;
        }

        forgotForm.style.display = "none";
        otpForm.style.display = "block";

        showMessage(
            result.message +
            (result.developmentOtp
                ? ` OTP: ${result.developmentOtp}`
                : ""),
            "success"
        );

    } catch (error) {

        console.error(error);

        showMessage(
            "Server se connection nahi ho pa raha.",
            "error"
        );
    }

});


// VERIFY OTP

otpForm?.addEventListener("submit", (event) => {

    event.preventDefault();

    const otp =
        otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {

        showMessage(
            "Enter a valid 6-digit OTP.",
            "error"
        );

        return;
    }

    otpForm.style.display = "none";
    resetForm.style.display = "block";

    showMessage(
        "OTP accepted. Set your new password.",
        "success"
    );

});


// RESET PASSWORD

resetForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    const password =
        newPassword.value;

    const confirm =
        confirmPassword.value;

    const otp =
        otpInput.value.trim();

    const identifier =
        forgotIdentifier.value.trim();

    if (!password || !confirm) {

        showMessage(
            "Please fill both password fields.",
            "error"
        );

        return;
    }

    if (password !== confirm) {

        showMessage(
            "Passwords do not match.",
            "error"
        );

        return;
    }

    if (password.length < 6) {

        showMessage(
            "Password must be at least 6 characters.",
            "error"
        );

        return;
    }

    showMessage("Changing password... ⏳");

    try {

        const response = await fetch(
            "/api/reset-password",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    identifier,
                    otp,
                    newPassword: password
                })
            }
        );

        const result =
            await response.json();

        if (!response.ok) {

            showMessage(
                result.message ||
                "Password reset failed.",
                "error"
            );

            return;
        }

        showMessage(
            "Password changed successfully! 🎉",
            "success"
        );

        setTimeout(() => {

            resetForm.style.display = "none";
            loginForm.style.display = "block";

            authTitle.textContent =
                "Welcome back 👋";

            authSubtitle.textContent =
                "Login to continue your student journey.";

            forgotIdentifier.value = "";
            otpInput.value = "";
            newPassword.value = "";
            confirmPassword.value = "";

        }, 1000);

    } catch (error) {

        console.error(error);

        showMessage(
            "Server se connection nahi ho pa raha.",
            "error"
        );
    }

});


// ===============================
// DASHBOARD
// ===============================


// ===============================

function updateDashboard() {

    const loggedIn =
        localStorage.getItem("polytechnicLoggedIn") === "true";

    const name =
        localStorage.getItem("studentName") || "Student";

    const welcome =
        $("#welcomeMessage");

    const profileText =
        $("#studentInfo");

    if (!loggedIn) {
        welcome.textContent = "Welcome, Student! 👋";
        profileText.textContent =
            "Create your profile and personalize your learning journey.";
        loginBtn.textContent = "Login";
        return;
    }

    welcome.textContent =
        `Welcome, ${name}! 👋`;

    let profile = {};

    try {
        profile = JSON.parse(
            localStorage.getItem("studentProfile") || "{}"
        );
    } catch (e) {
        profile = {};
    }

    const details = [
        profile.college,
        profile.branch,
        profile.year,
        profile.semester
    ].filter(Boolean);

    profileText.textContent =
        details.length
            ? details.join(" • ")
            : "Your personalized student dashboard.";

    loginBtn.textContent = "Logout";
}

function logout() {

    localStorage.removeItem(
        "polytechnicLoggedIn"
    );

    localStorage.removeItem(
        "studentName"
    );

    localStorage.removeItem(
        "studentEmail"
    );

    localStorage.removeItem(
        "studentProfile"
    );

    updateDashboard();

    alert("You have been logged out. 👋");

}


// ===============================
// WELCOME ANIMATION
// ===============================

function showWelcomeAnimation() {

    const card =
        document.querySelector(".welcome-card");

    if (!card) return;

    card.animate(

        [
            {
                transform: "scale(1)"
            },
            {
                transform: "scale(1.05)"
            },
            {
                transform: "scale(1)"
            }
        ],

        {
            duration: 700,
            easing: "ease-out"
        }

    );

}


// ===============================
// CAREER GOALS
// ===============================

document
    .querySelectorAll(".goal-buttons button")
    .forEach((button) => {

        button.addEventListener("click", () => {

            document
                .querySelectorAll(".goal-buttons button")
                .forEach((item) => {

                    item.style.outline = "";

                });

            button.style.outline =
                "3px solid #cbd2ff";

            const profile = JSON.parse(
                localStorage.getItem(
                    "studentProfile"
                ) || "{}"
            );

            if (
                localStorage.getItem(
                    "polytechnicLoggedIn"
                ) === "true"
            ) {

                profile.goal =
                    button.textContent.trim();

                localStorage.setItem(
                    "studentProfile",
                    JSON.stringify(profile)
                );

            }

        });

    });


// ===============================
// FEEDBACK
// ===============================

const feedbackForm =
    $("#feedbackForm");

feedbackForm?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const formData =
            new FormData(feedbackForm);

        const data = {

            studentId:
                localStorage.getItem(
                    "studentId"
                ) || null,

            college:
                formData.get("college"),

            branch:
                formData.get("branch"),

            year:
                formData.get("year"),

            semester:
                formData.get("semester"),

            used:
                formData.get("used"),

            suggestion:
                formData.get("suggestion")

        };

        try {

            const response =
                await fetch(
                    "/api/feedback",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(data)

                    }
                );

            const result =
                await response.json();

            if (!response.ok) {

                alert(
                    result.message ||
                    "Feedback submit nahi hua."
                );

                return;
            }

            alert(
                "Thank you! Your feedback helps us improve ❤️"
            );

            feedbackForm.reset();

        } catch (error) {

            console.error(error);

            alert(
                "Server se connection nahi ho pa raha."
            );

        }

    }
);


// ===============================
// MOBILE NAVIGATION
// ===============================

menuBtn?.addEventListener("click", () => {

    mainNav?.classList.toggle("open");

    const isOpen =
        mainNav?.classList.contains("open");

    menuBtn.textContent =
        isOpen ? "✕" : "☰";

});


// Close mobile menu after navigation

mainNav
    ?.querySelectorAll("a")
    .forEach((link) => {

        link.addEventListener("click", () => {

            mainNav.classList.remove("open");

            menuBtn.textContent = "☰";

        });

    });


// ===============================
// PAGE START
// ===============================

updateDashboard();

console.log(
    "🎓 Polytechnic Student Hub loaded successfully!"
);


updateProfileButton();


updateRecordNavigation();


// ========================================
// LIVE CONTENT FROM BACKEND
// ========================================

async function loadStudyHubContent(){

    try{

        const [
            subjectsData,
            materialsData,
            updatesData,
            careerData
        ] = await Promise.all([

            fetch("/api/subjects").then(r => r.json()),
            fetch("/api/materials").then(r => r.json()),
            fetch("/api/updates").then(r => r.json()),
            fetch("/api/career").then(r => r.json())

        ]);


        // ================================
        // SUBJECTS
        // ================================

        const subjects =
            subjectsData.subjects || [];

        const subjectContainers =
            document.querySelectorAll(
                "#subjectsList, #subjectList, .subjects-list"
            );

        subjectContainers.forEach(container => {

            if(!subjects.length){

                container.innerHTML =
                    "<p>No subjects available yet.</p>";

                return;

            }

            container.innerHTML =
                subjects.map(subject => `

                    <div class="item">

                        <h3>📚 ${subject.name}</h3>

                        <p>
                            💻 ${subject.branch || "All Branches"}
                            •
                            📅 ${subject.semester || "All Semesters"}
                        </p>

                    </div>

                `).join("");

        });


        // ================================
        // MATERIALS
        // ================================

        const materials =
            materialsData.materials || [];

        const materialContainers =
            document.querySelectorAll(
                "#materialsList, #materialList, .materials-list"
            );

        materialContainers.forEach(container => {

            if(!materials.length){

                container.innerHTML =
                    "<p>No study material available yet.</p>";

                return;

            }

            container.innerHTML =
                materials.map(material => `

                    <div class="item">

                        <h3>📖 ${material.title}</h3>

                        <p>
                            ${material.description || ""}
                        </p>

                        <small>
                            ${material.subject_name || ""}
                            • ${material.branch || "All Branches"}
                            • ${material.semester || "All Semesters"}
                        </small>

                        ${
                            material.url
                            ? `
                            <br><br>
                            <a
                                href="${material.url}"
                                target="_blank"
                                rel="noopener"
                                class="btn primary"
                            >
                                Open Material
                            </a>
                            `
                            : ""
                        }

                    </div>

                `).join("");

        });


        // ================================
        // UPDATES
        // ================================

        const updates =
            updatesData.updates || [];

        const updateContainers =
            document.querySelectorAll(
                "#updatesList, #updateList, .updates-list"
            );

        updateContainers.forEach(container => {

            if(!updates.length){

                container.innerHTML =
                    "<p>No updates available yet.</p>";

                return;

            }

            container.innerHTML =
                updates.map(update => `

                    <div class="item">

                        <h3>
                            🔔 ${update.title}
                            ${
                                update.important
                                ? " ⭐"
                                : ""
                            }
                        </h3>

                        <p>
                            ${update.description || ""}
                        </p>

                        <small>
                            ${update.type || "General"}
                            •
                            ${update.created_at || ""}
                        </small>

                    </div>

                `).join("");

        });


        // ================================
        // CAREER
        // ================================

        const career =
            careerData.career || [];

        const careerContainers =
            document.querySelectorAll(
                "#careerList, #careerPosts, .career-list"
            );

        careerContainers.forEach(container => {

            if(!career.length){

                container.innerHTML =
                    "<p>No career opportunities available yet.</p>";

                return;

            }

            container.innerHTML =
                career.map(post => `

                    <div class="item">

                        <h3>
                            🚀 ${post.title}
                        </h3>

                        <p>
                            ${post.description || ""}
                        </p>

                        <small>
                            🏢 ${post.company || "N/A"}
                            •
                            📍 ${post.location || "N/A"}
                            •
                            ${post.type || "Opportunity"}
                        </small>

                        ${
                            post.url
                            ? `
                            <br><br>
                            <a
                                href="${post.url}"
                                target="_blank"
                                rel="noopener"
                                class="btn primary"
                            >
                                Apply / View
                            </a>
                            `
                            : ""
                        }

                    </div>

                `).join("");

        });

        console.log("✅ Live Study Hub content loaded.");

    }
    catch(error){

        console.error(
            "❌ Could not load live content:",
            error
        );

    }

}


// Load when website starts
document.addEventListener(
    "DOMContentLoaded",
    loadStudyHubContent
);



// ========================================
// PUBLIC LIVE CONTENT
// ========================================

async function loadPublicContent(){

    try{

        const [
            subjectsData,
            materialsData,
            updatesData,
            careerData
        ] = await Promise.all([
            fetch("/api/subjects").then(r=>r.json()),
            fetch("/api/materials").then(r=>r.json()),
            fetch("/api/updates").then(r=>r.json()),
            fetch("/api/career").then(r=>r.json())
        ]);


        const subjects =
            subjectsData.subjects || [];

        const materials =
            materialsData.materials || [];

        const updates =
            updatesData.updates || [];

        const career =
            careerData.career || [];


        const subjectBox =
            document.getElementById("publicSubjects");

        if(subjectBox){

            subjectBox.innerHTML = subjects.length
                ? subjects.map(s => `
                    <div class="feature-card">
                        <div class="feature-icon">📚</div>
                        <h3>${s.name}</h3>
                        <p>
                            ${s.branch || "All Branches"}
                            •
                            ${s.semester || "All Semesters"}
                        </p>
                    </div>
                `).join("")
                : "<p>No subjects available.</p>";
        }


        const materialBox =
            document.getElementById("publicMaterials");

        if(materialBox){

            materialBox.innerHTML = materials.length
                ? materials.map(m => `
                    <div class="feature-card">
                        <div class="feature-icon">📖</div>
                        <h3>${m.title}</h3>
                        <p>${m.description || ""}</p>
                        ${
                            m.url
                            ? `<a href="${m.url}" target="_blank" rel="noopener">
                                Open Material
                               </a>`
                            : ""
                        }
                    </div>
                `).join("")
                : "<p>No study material available.</p>";
        }


        const updateBox =
            document.getElementById("publicUpdates");

        if(updateBox && updates.length){

            updateBox.innerHTML =
                updates.map(u => `
                    <div class="update-card">

                        <div class="update-tag ${u.important ? "exam" : "notice"}">
                            ${u.type || "Update"}
                        </div>

                        <h3>${u.title}</h3>

                        <p>${u.description || ""}</p>

                        <small>${u.created_at || ""}</small>

                    </div>
                `).join("");
        }


        const careerBox =
            document.getElementById("publicCareer");

        if(careerBox && career.length){

            careerBox.innerHTML =
                career.map(c => `
                    <div class="career-card">

                        <h3>🚀 ${c.title}</h3>

                        <p>${c.description || ""}</p>

                        <p>
                            🏢 ${c.company || "N/A"}
                            <br>
                            📍 ${c.location || "N/A"}
                            <br>
                            💼 ${c.type || "Opportunity"}
                        </p>

                        ${
                            c.url
                            ? `<a href="${c.url}"
                                  target="_blank"
                                  rel="noopener">
                                  Apply / View
                               </a>`
                            : ""
                        }

                    </div>
                `).join("");
        }

        console.log("✅ Public live content loaded.");

    }catch(error){

        console.error(
            "Public content error:",
            error
        );

    }
}


document.addEventListener(
    "DOMContentLoaded",
    loadPublicContent
);



// My Records navigation
const myRecordsBtn = $("#myRecordsBtn");

myRecordsBtn?.addEventListener("click", () => {

    const loggedIn =
        localStorage.getItem("polytechnicLoggedIn") === "true";

    if (!loggedIn) {
        openAuth();
        return;
    }

    const profile =
        JSON.parse(
            localStorage.getItem("studentProfile") || "{}"
        );

    const name =
        localStorage.getItem("studentName") || "Student";

    alert(
        "👤 My Records\n\n" +
        "Name: " + name + "\n" +
        "Email: " + (profile.email || "N/A") + "\n" +
        "College: " + (profile.college || "N/A") + "\n" +
        "Branch: " + (profile.branch || "N/A") + "\n" +
        "Year: " + (profile.year || "N/A") + "\n" +
        "Semester: " + (profile.semester || "N/A") + "\n" +
        "Goal: " + (profile.goal || "Not decided")
    );

});
