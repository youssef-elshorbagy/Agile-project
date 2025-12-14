const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('id');

if (!courseId) {
    alert("No course specified!");
    window.close();
}

const session = requireAuth(); 

document.addEventListener('DOMContentLoaded', () => {
    loadCourseDetails();
    
    const backLink = document.getElementById('backLink');
    const profileLink = document.getElementById('profileLink');
    
    if (session.user.role === 'teacher') {
        backLink.href = "teacher.html";
        profileLink.href = "teacher.html"; 
    } else {
        backLink.href = "student.html";
        profileLink.href = "student.html";
    }
    
    // Show teacher-only forms
    if (session.user.role === 'teacher') {
        document.getElementById('announcementForm').style.display = 'block';
        document.getElementById('lectureForm').style.display = 'block';
        document.getElementById('assignmentForm').style.display = 'block';
    } else {
        document.getElementById('announcementForm').style.display = 'none';
        document.getElementById('lectureForm').style.display = 'none';
        document.getElementById('assignmentForm').style.display = 'none';
    }
    
    // File name display listener
    const fileInput = document.getElementById('assFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileNameDisplay.textContent = e.target.files[0].name;
            } else {
                fileNameDisplay.textContent = 'No file chosen';
            }
        });
    }
});

async function loadCourseDetails() {
    try {
        console.log("Fetching details for Course ID:", courseId);

        const response = await fetch(`${API_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        
        const result = await response.json();

        console.log("Backend Response:", result);

        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please login again.");
                window.location.href = "index.html";
                return;
            }
            alert(`Error: ${result.message}`);
            return;
        }

        const c = result.data?.course;
        if (!c) throw new Error("Course data is missing from response");

        // Populate Header
        const instructorName = c.instructor?.fullName || "Unknown Instructor";
        document.getElementById('courseName').textContent = c.name;
        document.getElementById('courseCode').textContent = `${c.code} - Instructor: ${instructorName}`;

        // Populate Announcements
        populateAnnouncements(c.announcements);

        // Populate Lectures
        populateLectures(c.lectures);

        // Populate Assignments
        populateAssignments(c.assignments);

    } catch (err) { 
        console.error("Error loading details:", err); 
        alert("Failed to load course details. Check console for error.");
    }
}

function populateAnnouncements(announcements = []) {
    const annList = document.getElementById('announcementsList');
    annList.innerHTML = '';
    
    if (announcements.length === 0) {
        annList.innerHTML = '<p style="color:#999">No announcements yet.</p>';
        return;
    }
    
    announcements.forEach(a => {
        const text = a.content || "No content"; 
        const teacher = a.teacherName || "Instructor";
        const dateStr = new Date(a.createdAt).toLocaleDateString();

        annList.innerHTML += `
            <div class="announcement-item">
                <div class="announcement-content">
                    <h4>📢 Announcement <small style="font-size:0.8em; color:#666">by ${teacher}</small></h4>
                    <p>${text}</p>
                    <span class="date-stamp">${dateStr}</span>
                </div>
            </div>
        `;
    });
}

function populateLectures(lectures = []) {
    const lecList = document.getElementById('lecturesList');
    lecList.innerHTML = '';
    
    if (lectures.length === 0) {
        lecList.innerHTML = '<p style="color:#999">No lectures uploaded yet.</p>';
        return;
    }
    
    lectures.forEach(l => {
        const title = l.title || "Untitled Lecture";
        const link = l.link || "#";
        const dateStr = new Date(l.createdAt).toLocaleDateString();

        lecList.innerHTML += `
            <div class="lecture-item">
                <div>
                    <strong>
                        <img src="images/pdf.png" style="width:24px; vertical-align: middle; margin-right: 10px;"> 
                        ${title} 
                    </strong>
                    <br>
                    <span class="date-stamp" style="margin-left:38px">Posted on ${dateStr}</span>
                </div>
                <a href="${link}" target="_blank" class="lecture-link">View</a>
            </div>
        `;
    });
}

// Helper: parse SQL/ISO datetime into JS Date
function parseSqlDate(dateVal) {
    if (!dateVal) return new Date();
    // If it's already a Date
    if (dateVal instanceof Date) return dateVal;
    // Handle strings like 'YYYY-MM-DD HH:MM:SS' or ISO strings
    if (typeof dateVal === 'string') {
        // Replace space between date and time with 'T' to make it ISO-compatible
        const s = dateVal.trim().replace(' ', 'T');
        const d = new Date(s);
        if (!isNaN(d)) return d;
        // fallback: try creating Date from original string
        const d2 = new Date(dateVal);
        return isNaN(d2) ? new Date() : d2;
    }
    // numeric timestamp
    if (typeof dateVal === 'number') return new Date(dateVal);
    return new Date();
}

function populateAssignments(assignments = []) {
    const assList = document.getElementById('assignmentsList');
    assList.innerHTML = '';

    if (!assignments || assignments.length === 0) {
        assList.innerHTML = '<p style="color:#999">No assignments yet.</p>';
        return;
    }

    assignments.forEach(a => {
        // Prefer createdAt for "Posted on" label, fall back to deadline
        const dateObj = parseSqlDate(a.createdAt || a.deadline);
        const dateStr = isNaN(dateObj.getTime()) ? 'Unknown Date' : dateObj.toLocaleDateString();

        const title = a.title || 'Untitled Assignment';
        // Derive filename/link fallback if backend returned filePath but not fileName/link
        const fileName = a.fileName || (a.filePath ? a.filePath.split(/[\\/]/).pop() : null);
        const link = a.link || (fileName ? `${API_URL.replace(/\/$/, '')}/uploads/${encodeURIComponent(fileName)}` : null);
        const fileAvailable = !!link;
        const viewButton = fileAvailable
            ? `<a href="${link}" target="_blank" rel="noopener" class="lecture-link" style="padding:8px 18px; border-radius:20px;">View</a>`
            : `<button disabled style="padding:8px 18px; border-radius:20px; background:#ccc; color:#666; border:none;">No File</button>`;
        assList.innerHTML += `
            <div class="lecture-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    <img src="images/pdf.png" style="width:34px; height:34px;" />
                    <div>
                        <strong style="display:block; color:#333; font-size:15px">${title}</strong>
                        <span class="date-stamp" style="color:#b2bec3; font-weight:600; font-size:12px;">Posted on ${dateStr}</span>
                    </div>
                </div>
                <div style="margin-left:12px; display:flex; align-items:center;">
                    ${viewButton}
                </div>
            </div>
        `;
    });
}


async function postAnnouncement() {
    const text = document.getElementById('newAnnouncementText').value;
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
            document.getElementById('newAnnouncementText').value = '';
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
    
    if(!title || fileInput.files.length === 0) {
        return alert("Please enter a title and select a PDF file!");
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', fileInput.files[0]); 

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/lecture`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${session.token}`
            },
            body: formData
        });
        
        const result = await response.json();

        if(response.ok) {
            document.getElementById('lectureTitle').value = '';
            document.getElementById('lectureFile').value = '';
            loadCourseDetails();
        } else {
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}

async function postAssignment() {
    const title = document.getElementById('assTitle').value;
    const deadline = document.getElementById('assDeadline').value;
    const desc = document.getElementById('assDesc').value;
    const fileInput = document.getElementById('assFile');

    // Validation
    if (!title || !deadline) {
        return alert("Title and Deadline are required!");
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('deadline', deadline);
    formData.append('description', desc);
    
    if (fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }

    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/assignment`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${session.token}`
            },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            alert("Assignment Created Successfully!");
            // Clear form
            document.getElementById('assTitle').value = '';
            document.getElementById('assDesc').value = '';
            document.getElementById('assDeadline').value = '';
            document.getElementById('assFile').value = '';
            document.getElementById('fileNameDisplay').textContent = 'No file chosen';
            
            // Refresh assignments list
            loadCourseDetails(); 
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("Error posting assignment: " + err.message);
    }
}
