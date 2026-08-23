const $ = (selector) => document.querySelector(selector);

// ===============================
// ELEMENTS
// ===============================

const dialog = $("#profileDialog");

const loginBtn = $("#loginBtn");
const profileBtn = $("#profileBtn");
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

profileBtn?.addEventListener("click", openAuth);

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

        email: $("#loginEmail").value.trim(),

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
// DASHBOARD
// ===============================

function updateDashboard() {

    const loggedIn =
        localStorage.getItem(
            "polytechnicLoggedIn"
        ) === "true";

    const name =
        localStorage.getItem("studentName");

    const welcome =
        $("#welcomeMessage");

    const profileText =
        $("#studentInfo");

    if (loggedIn && name) {

        welcome.textContent =
            `Welcome, ${name}! 👋`;

        const profile = JSON.parse(
            localStorage.getItem(
                "studentProfile"
            ) || "{}"
        );

        let info = "";

        if (profile.college) {
            info += profile.college;
        }

        if (profile.branch) {

            if (info) info += " • ";

            info += profile.branch;
        }

        if (profile.year) {

            if (info) info += " • ";

            info += profile.year;
        }

        if (profile.semester) {

            if (info) info += " • ";

            info += profile.semester;
        }

        profileText.textContent =
            info || "Your personalized student dashboard.";

        loginBtn.textContent = "Logout";

    } else {

        welcome.textContent =
            "Welcome, Student! 👋";

        profileText.textContent =
            "Create your profile and personalize your learning journey.";

        loginBtn.textContent = "Login";

    }

}


// ===============================
// LOGOUT
// ===============================

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
