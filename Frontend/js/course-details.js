// DEBUG: Confirm file loaded
console.log("Course Details Script Loaded");

const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('id');

// Safety Check: Ensure Config is loaded
if (typeof API_URL === 'undefined') {
    alert("Error: config.js not loaded. Check your HTML file.");
    throw new Error("API_URL missing");
}

if (!courseId) {
    alert("No course specified!");
    window.location.href = 'index.html';
}

const session = requireAuth(); 
if (!session) throw new Error("Redirecting...");

// Global variable for student status
let mySubmissions = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!session || !session.user) return;
    
    // 1. Normalize Role to lowercase for safe comparisons
    const userRole = (session.user.role || '').toLowerCase();
    const isTeacherOrAdmin = ['teacher', 'admin'].includes(userRole) || session.user.isAdvisor;

    console.log("User Role:", userRole, "| Is Staff:", isTeacherOrAdmin); // Debug

    // 2. Setup Navigation Links
    const backLink = document.getElementById('backLink');
    const profileLink = document.getElementById('profileLink');
    
    if (isTeacherOrAdmin) {
        if (backLink) backLink.href = "teacher.html";
        if (profileLink) profileLink.href = "teacher.html"; 
        
        // SHOW Teacher Controls
        setDisplay('announcementForm', 'block');
        setDisplay('lectureForm', 'block');
        setDisplay('assignmentForm', 'block');
    } else {
        if (backLink) backLink.href = "student.html";
        if (profileLink) profileLink.href = "student.html";
        
        // HIDE Teacher Controls
        setDisplay('announcementForm', 'none');
        setDisplay('lectureForm', 'none');
        setDisplay('assignmentForm', 'none');
    }

    // 3. Load Data
    loadCourseDetails();
    
    // File Input Helper
    const fileInput = document.getElementById('assFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay'); 
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            fileNameDisplay.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'No file chosen';
        });
    }
});

function setDisplay(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.display = value;
}

/* ============================
   MAIN LOADER
============================ */
async function loadCourseDetails() {
    try {
        const userRole = (session.user.role || '').toLowerCase();

        // If Student, fetch their submissions first
        if (userRole === 'student') {
            try {
                const subResponse = await fetch(`${API_URL}/courses/${courseId}/my-submissions`, {
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                const subData = await subResponse.json();
                if (subData.status === 'success') {
                    mySubmissions = subData.data || [];
                }
            } catch (err) { console.error("Error loading submissions:", err); }
        }

        // Fetch Course Metadata
        const response = await fetch(`${API_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        
        const result = await response.json();

        if (!response.ok) {
            alert(`Error: ${result.message}`);
            return;
        }

        const c = result.data?.course;
        if (!c) throw new Error("Course data missing");

        // Populate Header
        const instructorName = c.instructor?.fullName || c.instructorName || "Unknown Instructor";      
        document.getElementById('courseName').textContent = c.name || "Untitled Course";
        document.getElementById('courseCode').textContent = `${c.code || 'N/A'} - Instructor: ${instructorName}`;
        
        // Populate Sections
        populateAnnouncements(c.announcements);
        populateLectures(c.lectures);
        populateAssignments(c.assignments, userRole);

    } catch (err) { 
        console.error("Error loading details:", err); 
    }
}

/* ============================
   POPULATE SECTIONS
============================ */

function populateAnnouncements(announcements = []) {
    const list = document.getElementById('announcementsList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!announcements || !announcements.length) {
        list.innerHTML = '<p class="text-muted" style="color:#999">No announcements yet.</p>';
        return;
    }
    
    announcements.forEach(a => {
        const dateStr = new Date(a.createdAt).toLocaleDateString();
        const teacher = a.teacherName || 'Instructor';
        list.innerHTML += `
            <div class="announcement-item">
                <div class="announcement-content">
                    <h4>📢 ${a.content || "Update"}</h4>
                    <span class="date-stamp">Posted by ${teacher} on ${dateStr}</span>
                </div>
            </div>`;
    });
}

function populateLectures(lectures = []) {
    const list = document.getElementById('lecturesList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!lectures || !lectures.length) {
        list.innerHTML = '<p class="text-muted" style="color:#999">No lectures uploaded yet.</p>';
        return;
    }
    
    lectures.forEach(l => {
        const title = l.title || "Untitled Lecture";
        const fileName = l.fileName || (l.filePath ? l.filePath.split(/[\\/]/).pop() : null);
        const link = fileName ? `${API_URL}/uploads/${fileName}` : "#";
        const dateStr = new Date(l.createdAt).toLocaleDateString();

        list.innerHTML += `
            <div class="lecture-item">
                <div class="lecture-info">
                    <strong>📄 ${title}</strong>
                    <span class="date-stamp">Posted on ${dateStr}</span>
                </div>
                <a href="${link}" target="_blank" class="lecture-link">Download PDF</a>
            </div>`;
    });
}

function populateAssignments(assignments = [], userRole) {
    const list = document.getElementById('assignmentsList');
    if (!list) return;
    list.innerHTML = '';

    if (!assignments || !assignments.length) {
        list.innerHTML = '<p class="text-muted" style="color:#999">No assignments yet.</p>';
        return;
    }

    const lowerRole = (userRole || '').toLowerCase();
    // Helper boolean: true if Teacher, Admin, or Advisor
    const isStaff = ['teacher', 'admin', 'advisor'].includes(lowerRole) || session.user.isAdvisor;

    assignments.forEach(a => {
        const assId = a.id; 
        const title = a.title || 'Untitled Assignment';
        const deadline = a.deadline ? new Date(a.deadline).toLocaleDateString() : 'No Deadline';
        const desc = a.description || '';
        
        const link = a.fileName ? `${API_URL}/uploads/${encodeURIComponent(a.fileName)}` : null;
        const downloadBtn = link 
            ? `<a href="${link}" target="_blank" class="lecture-link" style="font-size:12px; padding:5px 10px;">Download Instructions</a>` 
            : '';

        let actionHtml = '';

        // --- STUDENT VIEW ---
        if (lowerRole === 'student') {
            const mySub = mySubmissions.find(s => s.AssignmentID == assId);
            
            if (mySub) {
                const gradeHtml = mySub.Grade !== null 
                    ? `<span style="color:#27ae60; font-weight:bold;">Grade: ${mySub.Grade}/100</span>`
                    : `<span style="color:#f39c12; font-weight:bold;">Pending Grade</span>`;

                actionHtml = `
                    <div style="margin-top:15px; background:#f0fff4; padding:12px; border-radius:8px; border:1px solid #c6f6d5;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#27ae60; font-weight: 600;">✅ Submitted on ${new Date(mySub.SubmittedAt).toLocaleDateString()}</span>
                            ${gradeHtml}
                        </div>
                    </div>`;
            } else {
                actionHtml = `
                    <form onsubmit="submitAssignment(event, ${assId})" style="margin-top:10px; display:flex; gap:10px; align-items:center;">
                        <input type="file" id="file-${assId}" accept=".pdf" required class="mini-input" style="margin-bottom:0; width:auto;">
                        <button type="submit" class="mini-btn">Submit PDF</button>
                    </form>`;
            }
        } 
        // --- TEACHER / ADMIN VIEW (GRADING) ---
        else if (isStaff) {
            actionHtml = `
                <div style="margin-top:15px;">
                    <button onclick="toggleGradingView(${assId})" class="mini-btn" style="width:100%; background-color:#6c5ce7; text-align:center;">
                        View Submissions & Grade
                    </button>
                    <div id="grading-area-${assId}" style="display:none; margin-top:10px; background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd;">
                        <p>Loading...</p>
                    </div>
                </div>`;
        }

        list.innerHTML += `
            <div class="lecture-item" style="display:block; padding:20px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="font-size:1.1em; color:#2d3436;">📝 ${title}</strong>
                        <div style="color:#636e72; font-size:0.9em; margin-top:4px;">Due: ${deadline}</div>
                        ${desc ? `<div style="margin-top:8px; color:#555; font-size:0.95em;">${desc}</div>` : ''}
                    </div>
                    ${downloadBtn}
                </div>
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    ${actionHtml}
                </div>
            </div>`;
    });
}

/* ============================
   TEACHER GRADING LOGIC (INLINE)
============================ */

async function toggleGradingView(assId) {
    const area = document.getElementById(`grading-area-${assId}`);
    if (!area) return;

    if (area.style.display === 'block') {
        area.style.display = 'none';
        return;
    }
    area.style.display = 'block';
    area.innerHTML = '<p style="color:#666;">Fetching submissions...</p>';

    try {
        const res = await fetch(`${API_URL}/courses/${courseId}/assignments/${assId}/submissions`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const json = await res.json();
        
        if (!json.data || json.data.length === 0) {
            area.innerHTML = '<p style="color:#636e72; font-style:italic;">No students have submitted this assignment yet.</p>';
            return;
        }

        let html = `
            <table style="width:100%; font-size:14px; border-collapse:collapse;">
                <tr style="background:#f9f9f9; text-align:left; border-bottom:2px solid #eee;">
                    <th style="padding:8px;">Student</th>
                    <th style="padding:8px;">File</th>
                    <th style="padding:8px;">Grade</th>
                    <th style="padding:8px;">Action</th>
                </tr>`;
        
        json.data.forEach(sub => {
            const gradeVal = sub.Grade !== null ? sub.Grade : '';
            const downloadLink = `${API_URL}/uploads/${sub.fileName}`; 
            
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">
                        <strong>${sub.fullName || 'Unknown'}</strong><br>
                        <small style="color:#888">${sub.universityId || ''}</small>
                    </td>
                    <td style="padding:8px;">
                        <a href="${downloadLink}" target="_blank" style="color:#0984e3; text-decoration:none;">Download</a>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" id="grade-${sub.SubmissionID}" value="${gradeVal}" 
                            style="width:60px; padding:5px; border:1px solid #ccc; border-radius:4px;" placeholder="0-100">
                    </td>
                    <td style="padding:8px;">
                        <button onclick="saveGrade(${sub.SubmissionID})" class="approve-btn" style="font-size:12px; padding:6px 12px; background:#00b894; color:white; border:none; border-radius:4px; cursor:pointer;">
                            Save
                        </button>
                    </td>
                </tr>`;
        });
        html += `</table>`;
        area.innerHTML = html;

    } catch(err) { 
        console.error(err); 
        area.innerHTML = '<p style="color:red;">Error loading submissions. Check console (F12).</p>'; 
    }
}

async function saveGrade(subId) {
    const gradeInput = document.getElementById(`grade-${subId}`);
    const grade = gradeInput.value;

    if(grade === '' || grade < 0 || grade > 100) {
        alert("Please enter a valid grade between 0 and 100");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/courses/submissions/${subId}/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ grade: grade, feedback: 'Graded via Web' })
        });

        if(res.ok) {
            alert('Grade saved!');
            gradeInput.style.border = "2px solid #2ecc71";
        } else {
            const data = await res.json();
            alert('Error: ' + (data.message || 'Could not save'));
        }
    } catch(err) { console.error(err); alert("Network error"); }
}

/* ============================
   ACTIONS (POST / SUBMIT)
============================ */
async function submitAssignment(e, assId) {
    e.preventDefault();
    const fileInput = document.getElementById(`file-${assId}`);
    if (!fileInput.files[0]) return alert("Please select a file.");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${API_URL}/courses/${courseId}/assignments/${assId}/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.token}` },
            body: formData
        });
        
        if (res.ok) {
            alert('Assignment submitted successfully!');
            loadCourseDetails(); 
        } else {
            const data = await res.json();
            alert(data.message || 'Upload failed');
        }
    } catch(err) { console.error(err); alert("Network error."); }
}

async function postAnnouncement() {
    const textEl = document.getElementById('newAnnouncementText');
    if(!textEl) return;
    const text = textEl.value;
    
    if(!text) return alert("Please write something!");

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/announcement`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ text })
        });
        
        if(response.ok) {
            textEl.value = '';
            loadCourseDetails(); 
        } else {
            const result = await response.json();
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}

async function postLecture() {
    const title = document.getElementById('lectureTitle').value;
    const fileInput = document.getElementById('lectureFile');
    
    if(!title || fileInput.files.length === 0) return alert("Please enter a title and select a PDF!");

    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', fileInput.files[0]); 

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/lecture`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.token}` },
            body: formData
        });
        
        if(response.ok) {
            document.getElementById('lectureTitle').value = '';
            document.getElementById('lectureFile').value = '';
            loadCourseDetails();
        } else {
            const result = await response.json();
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}

async function postAssignment() {
    const titleEl = document.getElementById('assTitle');
    const deadlineEl = document.getElementById('assDeadline');
    const descEl = document.getElementById('assDesc');
    const fileEl = document.getElementById('assFile');

    if (!titleEl || !deadlineEl) return; 

    if (!titleEl.value || !deadlineEl.value) return alert("Title and Deadline are required!");

    const formData = new FormData();
    formData.append('title', titleEl.value);
    formData.append('deadline', deadlineEl.value);
    formData.append('description', descEl ? descEl.value : ''); 
    if (fileEl && fileEl.files.length > 0) formData.append('file', fileEl.files[0]);

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/assignment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.token}` },
            body: formData
        });

        if (response.ok) {
            alert("Assignment Created!");
            titleEl.value = '';
            deadlineEl.value = '';
            if(descEl) descEl.value = '';
            if(fileEl) fileEl.value = '';
            loadCourseDetails(); 
        } else {
            const result = await response.json();
            alert("Error: " + result.message);
        }
    } catch (err) { console.error(err); }
}