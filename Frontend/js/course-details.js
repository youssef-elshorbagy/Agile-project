document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (!courseId) {
        alert('No course ID provided');
        window.location.href = 'teacher.html';
        return;
    }

    await loadCourseDetails(courseId);
});

// Global variable to store student's own submissions
let mySubmissions = [];

async function loadCourseDetails(courseId) {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    try {
        // 1. If user is a student, fetch their submissions first
        if (user.role === 'student') {
            const subResponse = await fetch(`${API_URL}/courses/${courseId}/my-submissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const subData = await subResponse.json();
            if (subData.status === 'success') {
                mySubmissions = subData.data;
            }
        }

        // 2. Fetch Course Data
        const response = await fetch(`${API_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.status === 'success') {
            const course = data.data.course;
            
            // Fill Info
            const nameEl = document.getElementById('courseName');
            const codeEl = document.getElementById('courseCode');
            if(nameEl) nameEl.textContent = course.name || course.Name;
            if(codeEl) codeEl.textContent = course.code || course.Code;

            // Load Lists
            renderAnnouncements(course.announcements);
            renderLectures(course.lectures);
            renderAssignments(course.assignments, user.role);

            // Show Teacher Controls
            if (user && (user.role === 'teacher' || user.role === 'admin')) {
                document.querySelectorAll('.teacher-controls').forEach(el => el.style.display = 'block');
            }
        }
    } catch (error) {
        console.error('Error loading course:', error);
    }
}

// --- RENDER FUNCTIONS ---

function renderAssignments(assignments, userRole) {
    const list = document.getElementById('assignmentsList');
    if (!list) return;
    list.innerHTML = ''; 

    if (!assignments || assignments.length === 0) {
        list.innerHTML = '<p style="color:#666; font-style:italic;">No assignments yet.</p>';
        return;
    }

    assignments.forEach(ass => {
        // Handle Capitalization
        const title = ass.title || ass.Title || ass.name || ass.Name || "Assignment";
        const desc = ass.description || ass.Description || "";
        const deadline = ass.deadline || ass.Deadline;
        const fileName = ass.fileName || ass.FileName;
        // Important: Get the correct ID
        const assId = ass.AssignmentID || ass.id; 

        // Date Formatting
        let dateStr = "No Deadline";
        if(deadline) {
            const d = new Date(deadline);
            dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        }

        // Create Container
        const item = document.createElement('div');
        item.className = 'lecture-item'; 
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';

        // 1. Assignment Info Section
        let html = `
            <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start;">
                <div class="lecture-info">
                    <strong>${title}</strong>
                    <span style="font-size:12px; color:#666;">Due: ${dateStr}</span>
                    <p style="font-size:13px; margin:5px 0;">${desc}</p>
                </div>
                ${fileName ? `<a href="${API_URL}/uploads/${fileName}" target="_blank" class="lecture-link">Download PDF</a>` : ''}
            </div>
            <div style="width:100%; margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
        `;

        // 2. Student View: Submit or View Grade
        if (userRole === 'student') {
            const mySub = mySubmissions.find(s => s.AssignmentID === assId);

            if (mySub) {
                // Already Submitted
                const gradeDisplay = mySub.Grade !== null 
                    ? `<span style="color:#2ed573; font-weight:bold;">Grade: ${mySub.Grade} / 100</span>`
                    : `<span style="color:#ffa502; font-weight:bold;">Pending Grading</span>`;
                
                const feedbackDisplay = mySub.Feedback 
                    ? `<p style="font-size:12px; color:#555; margin-top:5px;"><strong>Feedback:</strong> ${mySub.Feedback}</p>` 
                    : '';

                html += `
                    <div>
                        <span style="font-size:13px; color:#3742fa;">✅ Submitted on ${new Date(mySub.SubmittedAt).toLocaleDateString()}</span>
                        <div style="margin-top:5px;">${gradeDisplay}</div>
                        ${feedbackDisplay}
                    </div>
                `;
            } else {
                // Not Submitted
                html += `
                    <form onsubmit="submitAssignment(event, '${assId}')" style="display:flex; gap:10px; align-items:center;">
                        <input type="file" id="file-${assId}" required class="mini-input" style="width:auto; padding:5px;">
                        <button type="submit" class="mini-btn" style="background:#3742fa;">Submit Solution</button>
                    </form>
                `;
            }
        }

        // 3. Teacher View: Grade Button
        if (userRole === 'teacher' || userRole === 'admin') {
            html += `
                <button onclick="toggleGradingView('${assId}')" class="mini-btn" style="background:#5352ed; width:100%;">Create Grades / View Submissions</button>
                <div id="grading-area-${assId}" style="display:none; margin-top:10px; background:#f8f9fa; padding:10px; border-radius:5px; border:1px solid #ddd;">
                    <p>Loading...</p>
                </div>
            `;
        }

        html += `</div>`; // Close container
        item.innerHTML = html;
        list.appendChild(item);
    });
}

// --- ACTIONS: STUDENT ---

async function submitAssignment(e, assId) {
    e.preventDefault();
    const fileInput = document.getElementById(`file-${assId}`);
    if (!fileInput.files[0]) return alert("Please select a file.");

    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = "Uploading...";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/courses/${courseId}/assignments/${assId}/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        // 1. Read text first to debug crash reports (HTML)
        const responseText = await response.text();
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonErr) {
            console.error("Server returned non-JSON:", responseText);
            throw new Error("Server Error: " + responseText.substring(0, 50) + "..."); 
        }

        if (response.ok) {
            alert("Submitted Successfully!");
            window.location.reload();
        } else {
            alert(data.message || "Upload Failed");
        }
    } catch (err) { 
        console.error(err); 
        alert("Submission Error: " + err.message); 
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- ACTIONS: TEACHER ---

async function toggleGradingView(assId) {
    const area = document.getElementById(`grading-area-${assId}`);
    
    // Toggle visibility
    if (area.style.display === 'block') {
        area.style.display = 'none';
        return;
    }
    area.style.display = 'block';

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/assignments/${assId}/submissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await response.json();

        if (res.data.length === 0) {
            area.innerHTML = '<p style="color:#666;">No students have submitted this assignment yet.</p>';
            return;
        }

        let tableHtml = `
            <table style="width:100%; font-size:13px; border-collapse: collapse;">
                <tr style="background:#ddd; text-align:left;">
                    <th style="padding:5px;">Student</th>
                    <th style="padding:5px;">File</th>
                    <th style="padding:5px;">Grade (0-100)</th>
                    <th style="padding:5px;">Action</th>
                </tr>
        `;

        res.data.forEach(sub => {
            tableHtml += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:5px;">
                        <strong>${sub.fullName}</strong><br>
                        <small>${sub.universityId}</small>
                    </td>
                    <td style="padding:5px;">
                        <a href="${API_URL}/uploads/${sub.FilePath}" target="_blank" style="color:#3742fa;">View PDF</a>
                    </td>
                    <td style="padding:5px;">
                        <input type="number" id="grade-${sub.SubmissionID}" value="${sub.Grade || ''}" placeholder="0" style="width:50px;">
                    </td>
                    <td style="padding:5px;">
                        <button onclick="saveGrade('${sub.SubmissionID}')" style="cursor:pointer; background:#2ed573; color:white; border:none; padding:4px 8px; border-radius:3px;">Save</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += '</table>';
        area.innerHTML = tableHtml;

    } catch (err) {
        console.error(err);
        area.innerHTML = 'Error loading submissions.';
    }
}

async function saveGrade(subId) {
    const grade = document.getElementById(`grade-${subId}`).value;
    if (grade === '') return alert("Please enter a grade.");

    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/courses/submissions/${subId}/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ grade: grade, feedback: "Great work!" }) // You can add a prompt for feedback if you want
        });

        if (response.ok) {
            alert("Grade Saved!");
        } else {
            alert("Error saving grade.");
        }
    } catch (err) { console.error(err); }
}

// --- STANDARD RENDER FUNCTIONS (Announcements/Lectures) ---

function renderAnnouncements(announcements) {
    const list = document.getElementById('announcementsList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!announcements || announcements.length === 0) {
        list.innerHTML = '<p>No announcements.</p>';
        return;
    }
    announcements.forEach(ann => {
        const content = ann.Content || ann.content || "";
        const created = ann.CreatedAt || ann.createdAt || new Date();
        const item = document.createElement('div');
        item.className = 'announcement-item';
        item.innerHTML = `<div class="announcement-content"><p>${content}</p><span class="date-stamp">${new Date(created).toLocaleDateString()}</span></div>`;
        list.appendChild(item);
    });
}

function renderLectures(lectures) {
    const list = document.getElementById('lecturesList');
    if (!list) return;
    list.innerHTML = '';
    if (!lectures || lectures.length === 0) {
        list.innerHTML = '<p>No lectures uploaded.</p>';
        return;
    }
    lectures.forEach(lec => {
        const title = lec.Title || lec.title || "Lecture";
        const fileName = lec.FileName || lec.fileName;
        let link = lec.Link || lec.link;
        if (fileName && !link) link = `${API_URL}/uploads/${fileName}`;
        const item = document.createElement('div');
        item.className = 'lecture-item';
        item.innerHTML = `<div class="lecture-info"><strong>${title}</strong><span>${fileName || 'Link'}</span></div><a href="${link}" target="_blank" class="lecture-link">Download</a>`;
        list.appendChild(item);
    });
}

// --- POST FUNCTIONS (Teacher) ---

async function postAssignment() {
    const title = document.getElementById('assTitle').value;
    const desc = document.getElementById('assDesc').value;
    const deadline = document.getElementById('assDeadline').value;
    const fileInput = document.getElementById('assFile');

    if (!title || !deadline) return alert("Please fill in Title and Deadline");

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('deadline', deadline);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/courses/${courseId}/assignment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (response.ok) { alert('Assignment Created!'); window.location.reload(); }
        else { alert('Error creating assignment'); }
    } catch (e) { console.error(e); }
}

async function postAnnouncement() {
    const text = document.getElementById('newAnnouncementText').value;
    if (!text) return alert("Write something!");
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/courses/${courseId}/announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        if (response.ok) { alert('Posted!'); window.location.reload(); }
        else { alert('Error posting'); }
    } catch (e) { console.error(e); }
}

async function postLecture() {
    const title = document.getElementById('lectureTitle').value;
    const fileInput = document.getElementById('lectureFile');
    if (!title || !fileInput.files[0]) return alert("Provide title and file");
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', fileInput.files[0]);
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/courses/${courseId}/lecture`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (response.ok) { alert('Uploaded!'); window.location.reload(); }
        else { alert('Error uploading'); }
    } catch (e) { console.error(e); }
}