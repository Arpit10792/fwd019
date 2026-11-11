const days = [
    "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday"
];

let subjects = JSON.parse(localStorage.getItem("subjects") || "[]");
let timetable = JSON.parse(localStorage.getItem("timetable") || "[]");
let attendance = JSON.parse(localStorage.getItem("attendance") || "{}");
let extraClasses = JSON.parse(localStorage.getItem("extraClasses") || "[]");

// Reminder preference is saved separately
let remindersEnabled =
    localStorage.getItem("classRemindersEnabled") === "true";

let selectedDay = days[(new Date().getDay() + 6) % 7];

function save() {
    localStorage.setItem("subjects", JSON.stringify(subjects));
    localStorage.setItem("timetable", JSON.stringify(timetable));
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("extraClasses", JSON.stringify(extraClasses));
}

// Finds a class by id in the weekly timetable or in the extra classes
function findSession(id) {
    return timetable.find(c => c.id === id) ||
           extraClasses.find(c => c.id === id);
}

function today() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${date}`;
}

// Most recent date (today or earlier) that falls on the given weekday name
function lastDateForDay(dayName) {
    const target = days.indexOf(dayName);          // 0 = Monday ... 6 = Sunday
    if (target === -1) return today();
    const current = (new Date().getDay() + 6) % 7; // today, same indexing
    const diff = (current - target + 7) % 7;       // days since that weekday
    const d = new Date();
    d.setDate(d.getDate() - diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}


function getStats(id) {
    let records = Object.values(attendance)
        .filter(r => r.subject === id);

    let present = records.filter(r => r.status === "Present").length;
    let total = records.length;

    return {
        present,
        total,
        absent: total - present,
        percentage: total ? present / total * 100 : 0
    };
}

function safeMiss(present, total, target = 75) {
    return Math.max(
        0,
        Math.floor((present - target / 100 * total) / (target / 100))
    );
}

function needed(present, total, target = 75) {
    return Math.max(
        0,
        Math.ceil((target / 100 * total - present) / (1 - target / 100))
    );
}

// NAVIGATION
function switchPage(page) {
    document.querySelectorAll(".page").forEach(p => {
        p.classList.add("hidden");
    });

    document.getElementById(page).classList.remove("hidden");

    document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.page === page);
    });
}

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
        switchPage(button.dataset.page);
    });
});

// ADD SUBJECT
document.getElementById("addSubject").onclick = () => {
    const name = document.getElementById("subjectName").value.trim();
    const code = document.getElementById("subjectCode").value.trim();
    const target = Number(document.getElementById("target").value);

    if (!name) return alert("Enter subject name!");

    if (!Number.isFinite(target) || target < 1 || target > 100) {
        return alert("Enter a target between 1 and 100.");
    }

    subjects.push({
        id: Date.now().toString() + Math.random(),
        name,
        code,
        target
    });

    document.getElementById("subjectName").value = "";
    document.getElementById("subjectCode").value = "";

    save();
    render();
};

// ADD TIMETABLE CLASS
document.getElementById("addClass").onclick = () => {
    const subject = document.getElementById("classSubject").value;
    const day = document.getElementById("classDay").value;
    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;

    if (!subject) return alert("Add a subject first!");

    if (!start || !end || end <= start) {
        return alert("Enter a valid time range.");
    }

    timetable.push({
        id: Date.now().toString() + Math.random(),
        subject,
        day,
        start,
        end
    });

    selectedDay = day;

    save();
    render();
};

// MARK ATTENDANCE (opens a popup instead of prompt() boxes)
let markingClassId = null;
let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function updateMarkNote() {
    const date = document.getElementById("markDate").value;
    const existing = attendance[date + "_" + markingClassId];

    document.getElementById("markNote").textContent = existing
        ? "Already marked as " + existing.status + " on this date. Saving will replace it."
        : "";
}

function markAttendance(classId) {
    const session = findSession(classId);
    if (!session) return;

    const subject = subjects.find(s => s.id === session.subject);

    markingClassId = classId;
    document.getElementById("markTitle").textContent =
        "Mark: " + (subject ? subject.name : "Class") +
        (session.extra ? " (Extra)" : "");

    const dateInput = document.getElementById("markDate");
    if (session.extra) {
        // extra classes happen on one fixed date
        dateInput.value = session.date;
        dateInput.disabled = true;
    } else {
        dateInput.value = lastDateForDay(session.day);
        dateInput.disabled = false;
    }

    updateMarkNote();
    document.getElementById("markModal").classList.remove("hidden");
}

function closeMarkPopup() {
    document.getElementById("markModal").classList.add("hidden");
    markingClassId = null;
}

function saveMark(statusText) {
    const date = document.getElementById("markDate").value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date + "T12:00:00"))) {
        return alert("Please choose a valid date.");
    }

    const session = findSession(markingClassId);
    if (!session) return closeMarkPopup();

    attendance[date + "_" + markingClassId] = {
        subject: session.subject,
        status: statusText,
        date
    };

    const subject = subjects.find(s => s.id === session.subject);

    save();
    render();
    closeMarkPopup();
    showToast((subject ? subject.name : "Class") + " marked " + statusText + " (" + date + ")");
}

document.getElementById("markPresent").onclick = () => saveMark("Present");
document.getElementById("markAbsent").onclick = () => saveMark("Absent");
document.getElementById("markCancel").onclick = closeMarkPopup;
document.getElementById("markDate").addEventListener("change", updateMarkNote);

// close when clicking the dark background or pressing Esc
document.getElementById("markModal").addEventListener("click", e => {
    if (e.target.id === "markModal") closeMarkPopup();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMarkPopup();
});

// ADD EXTRA CLASS
document.getElementById("addExtra").onclick = () => {
    const subject = document.getElementById("extraSubject").value;
    const date = document.getElementById("extraDate").value;
    const start = document.getElementById("extraStart").value;
    const end = document.getElementById("extraEnd").value;

    if (!subject) return alert("Add a subject first!");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date + "T12:00:00"))) {
        return alert("Please choose a valid date.");
    }

    if (!start || !end || end <= start) {
        return alert("Enter a valid time range.");
    }

    extraClasses.push({
        id: Date.now().toString() + Math.random(),
        subject,
        date,
        start,
        end,
        extra: true
    });

    save();
    render();
    showToast("Extra class added for " + date);
};

// DELETE EXTRA CLASS
function deleteExtra(id) {
    if (!confirm("Delete this extra class and its attendance record?")) return;

    extraClasses = extraClasses.filter(c => c.id !== id);

    Object.keys(attendance).forEach(key => {
        if (key.endsWith("_" + id)) {
            delete attendance[key];
        }
    });

    save();
    render();
}

// DELETE CLASS
function deleteClass(id) {
    if (!confirm("Delete this class and its attendance records?")) return;

    timetable = timetable.filter(c => c.id !== id);

    Object.keys(attendance).forEach(key => {
        if (key.endsWith("_" + id)) {
            delete attendance[key];
        }
    });

    save();
    render();
}

// DELETE SUBJECT
function deleteSubject(id) {
    if (!confirm("Delete subject and all its records?")) return;

    subjects = subjects.filter(s => s.id !== id);

    const ids = timetable
        .concat(extraClasses)
        .filter(c => c.subject === id)
        .map(c => c.id);

    timetable = timetable.filter(c => c.subject !== id);
    extraClasses = extraClasses.filter(c => c.subject !== id);

    Object.keys(attendance).forEach(key => {
        if (ids.some(classId => key.endsWith("_" + classId))) {
            delete attendance[key];
        }
    });

    save();
    render();
}


// ========================================
// CLASS REMINDER SYSTEM
// ========================================

const REMINDER_LEAD_MINUTES = 5;
const REMINDER_CHECK_INTERVAL = 15000;

// Update button according to current state
function updateReminderButton() {
    const button = document.getElementById("reminderBtn");

    if (!("Notification" in window)) {
        button.textContent = "🔔 Notifications unavailable";
        button.disabled = true;
        return;
    }

    button.disabled = false;

    if (remindersEnabled && Notification.permission === "granted") {
        button.textContent = "🔔 Disable reminders";
        button.title = "Click to turn off class reminders.";
    } else {
        button.textContent = "🔕 Enable reminders";
        button.title = "Click to turn on class reminders.";
    }
}

// Save reminder preference
function setReminderPreference(enabled) {
    remindersEnabled = enabled;

    localStorage.setItem(
        "classRemindersEnabled",
        String(remindersEnabled)
    );

    updateReminderButton();
}

// Main enable/disable button
async function toggleReminders() {

    // If already enabled, disable immediately
    if (remindersEnabled) {
        setReminderPreference(false);

        alert("Class reminders disabled.");
        return;
    }

    // Browser support check
    if (!("Notification" in window)) {
        alert("Your browser does not support notifications.");
        return;
    }

    // Permission already blocked
    if (Notification.permission === "denied") {
        alert(
            "Notifications are blocked by your browser. " +
            "Please allow notifications in your site settings first."
        );

        return;
    }

    // Request permission if needed
    if (Notification.permission === "default") {
        try {
            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                alert("Notification permission was not granted.");
                updateReminderButton();
                return;
            }

        } catch (error) {
            console.error(error);
            alert("Could not enable notifications.");
            return;
        }
    }

    // Turn reminders on
    setReminderPreference(true);

    alert(
        "Class reminders enabled! 🔔\n" +
        "You'll receive a notification 5 minutes before class."
    );

    checkClassReminders();
}

// Attach toggle button
document.getElementById("reminderBtn").addEventListener(
    "click",
    toggleReminders
);


// Check for classes starting in 5 minutes
function checkClassReminders() {

    // Stop immediately if reminders are disabled
    if (!remindersEnabled) return;

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const now = new Date();

    const weekday = days[(now.getDay() + 6) % 7];
    const currentDate = today();

    timetable
        .filter(classItem => classItem.day === weekday && classItem.start)
        .forEach(classItem => {

            const [hours, minutes] = classItem.start
                .split(":")
                .map(Number);

            const classStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hours,
                minutes,
                0,
                0
            );

            const reminderTime = new Date(
                classStart.getTime() -
                REMINDER_LEAD_MINUTES * 60 * 1000
            );

            // Only notify during the 5-minute window
            if (now < reminderTime || now >= classStart) return;

            // Prevent duplicate notifications
            const reminderKey =
                `classReminder_${currentDate}_${classItem.id}`;

            if (localStorage.getItem(reminderKey) === "sent") return;

            const subject = subjects.find(
                s => s.id === classItem.subject
            );

            const subjectName = subject
                ? subject.name
                : "Your class";

            const formattedTime = classStart.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
            });

            try {
                const notification = new Notification(
                    "Class starts in 5 minutes",
                    {
                        body: `${subjectName} starts at ${formattedTime}. Time to get ready!`,
                        tag: reminderKey
                    }
                );

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                localStorage.setItem(reminderKey, "sent");

            } catch (error) {
                console.error("Could not show notification:", error);
            }
        });
}

// Check every 15 seconds
setInterval(checkClassReminders, REMINDER_CHECK_INTERVAL);

// Check again when returning to the website
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        checkClassReminders();
    }
});

// Initial button state
updateReminderButton();


// ========================================
// RENDER FUNCTIONS
// ========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

// SUBJECTS
function renderSubjects() {
    const list = document.getElementById("subjectList");
    const select = document.getElementById("classSubject");
    const extraSelect = document.getElementById("extraSubject");

    list.innerHTML = "";
    select.innerHTML = "";
    extraSelect.innerHTML = "";

    subjects.forEach(s => {
        const stats = getStats(s.id);

        list.innerHTML += `
            <div class="card subject-row">
                <div>
                    <h3>${escapeHTML(s.name)}</h3>
                    <p class="muted">
                        ${escapeHTML(s.code || "No code")} · Target ${s.target}%
                    </p>
                    <p>${stats.present}/${stats.total} attended</p>
                    <div class="progress">
                        <div style="width:${stats.percentage}%"></div>
                    </div>
                    <strong>${stats.percentage.toFixed(1)}%</strong>
                </div>
                <button class="danger"
                    onclick="deleteSubject('${s.id}')">Delete</button>
            </div>`;
        
        select.innerHTML += `
            <option value="${s.id}">${escapeHTML(s.name)}</option>`;
        extraSelect.innerHTML += `
            <option value="${s.id}">${escapeHTML(s.name)}</option>`;
    });

    if (!subjects.length) {
        list.innerHTML = '<p class="muted">No subjects added yet.</p>';
        select.innerHTML = '<option value="">Add a subject first</option>';
        extraSelect.innerHTML = '<option value="">Add a subject first</option>';
    }
}

// TIMETABLE
function renderTimetable() {
    document.getElementById("days").innerHTML = days.map(day => `
        <button class="day ${day === selectedDay ? "selected" : ""}"
            onclick="selectDay('${day}')">
            ${day.slice(0,3)}
            <strong>${timetable.filter(c => c.day === day).length}</strong>
        </button>
    `).join("");

    document.getElementById("selectedDay").textContent = selectedDay;

    const classes = timetable
        .filter(c => c.day === selectedDay)
        .sort((a,b) => a.start.localeCompare(b.start));

    document.getElementById("dayClasses").innerHTML =
        classes.length ? classes.map(c => {
            const s = subjects.find(x => x.id === c.subject);

            return `
            <div class="class-row">
                <div>
                    <strong>${escapeHTML(s ? s.name : "Deleted subject")}</strong>
                    <p class="muted">${c.start} – ${c.end}</p>
                </div>
                <button onclick="markAttendance('${c.id}')">Mark</button>
                <button class="danger"
                    onclick="deleteClass('${c.id}')">×</button>
            </div>`;
        }).join("") : '<p class="muted">No classes scheduled.</p>';
}

// EXTRA CLASSES
function renderExtraClasses() {
    const sorted = extraClasses
        .slice()
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));

    document.getElementById("extraClassList").innerHTML =
        sorted.length ? sorted.map(c => {
            const s = subjects.find(x => x.id === c.subject);
            const record = attendance[c.date + "_" + c.id];

            return `
            <div class="class-row">
                <div>
                    <strong>${escapeHTML(s ? s.name : "Deleted subject")}</strong>
                    <p class="muted">${c.date} · ${c.start} – ${c.end}
                        · ${record ? record.status : "Not marked"}</p>
                </div>
                <button onclick="markAttendance('${c.id}')">Mark</button>
                <button class="danger"
                    onclick="deleteExtra('${c.id}')">×</button>
            </div>`;
        }).join("") : '<p class="muted">No extra classes added.</p>';
}

function selectDay(day) {
    selectedDay = day;
    renderTimetable();
}

// DASHBOARD
function renderDashboard() {
    const all = Object.values(attendance);

    const p = all.filter(r => r.status === "Present").length;
    const n = all.length;
    const percent = n ? p / n * 100 : 0;

    document.getElementById("overall").textContent =
        percent.toFixed(1) + "%";

    document.getElementById("present").textContent = p;
    document.getElementById("absent").textContent = n - p;

    document.getElementById("safe").textContent =
        n && percent >= 75 ? safeMiss(p,n) : 0;

    document.getElementById("progressBar").style.width =
        percent + "%";

    document.getElementById("status").textContent =
        n ? percent >= 75
            ? `You're meeting your target. You can miss ${safeMiss(p,n)} more classes.`
            : `You need to attend the next ${needed(p,n)} classes to reach 75%.`
            : "Mark your first class to begin tracking.";

    document.getElementById("subjectStats").innerHTML =
        subjects.map(s => {
            const x = getStats(s.id);

            return `
            <div class="card">
                <h3>${escapeHTML(s.name)}</h3>
                <h2>${x.percentage.toFixed(1)}%</h2>
                <div class="progress">
                    <div style="width:${x.percentage}%"></div>
                </div>
                <p class="muted">
                    ${x.present}/${x.total} attended · ${x.absent} absent
                </p>
            </div>`;
        }).join("") ||
        '<p class="muted">Add subjects to see statistics.</p>';

    const day = days[(new Date().getDay() + 6) % 7];

    const classes = timetable
        .filter(c => c.day === day)
        .concat(extraClasses.filter(c => c.date === today()))
        .sort((a,b) => a.start.localeCompare(b.start));

    document.getElementById("todayClasses").innerHTML =
        classes.map(c => {
            const s = subjects.find(x => x.id === c.subject);
            const record = attendance[today() + "_" + c.id];

            return `
            <div class="class-row">
                <div>
                    <strong>${escapeHTML(s ? s.name : "Deleted subject")}${c.extra ? " (Extra)" : ""}</strong>
                    <p class="muted">${c.start} – ${c.end}</p>
                </div>
                <span>${record ? record.status : "Not marked"}</span>
                <button onclick="markAttendance('${c.id}')">Mark</button>
            </div>`;
        }).join("") || '<p class="muted">No classes today.</p>';
}

// MAIN RENDER
function render() {
    renderSubjects();
    renderTimetable();
    renderExtraClasses();
    renderDashboard();
}


// THEME TOGGLE
document.getElementById("themeBtn").onclick = () => {
    document.body.classList.toggle("light");

    localStorage.setItem(
        "attendanceTheme",
        document.body.classList.contains("light") ? "light" : "dark"
    );
};

if (localStorage.getItem("attendanceTheme") === "light") {
    document.body.classList.add("light");
}

document.getElementById("extraDate").value = today();

render();
