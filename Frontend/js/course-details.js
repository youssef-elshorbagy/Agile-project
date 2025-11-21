// 1. Get Course ID from URL
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('id');

if (!courseId) {
    alert("No course specified!");
    window.close();
}

// 2. Auth Check
const session = requireAuth(); // Allow any logged in user

// 3. Load Data
document.addEventListener('DOMContentLoaded', () => {
    loadCourseDetails();
    
    const backLink = document.getElementById('backLink');
    const profileLink = document.getElementById('profileLink');
    
    if (session.user.role === 'teacher') {
        backLink.href = "teacher.html";
        profileLink.href = "teacher.html"; // Ideally this would open the profile tab directly
        
        // Show forms
        document.getElementById('announcementForm').style.display = 'block';
        document.getElementById('lectureForm').style.display = 'block';
    } else {
        backLink.href = "student.html";
        profileLink.href = "student.html";
    }
    // Show Teacher Controls if the user is a teacher
    if (session.user.role === 'teacher') {
        document.getElementById('announcementForm').style.display = 'block';
        document.getElementById('lectureForm').style.display = 'block';
    }
});

async function loadCourseDetails() {
    try {
        const response = await fetch(`${API_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (response.ok) {
            const c = result.data.course;
            
            // Header
            document.getElementById('courseName').textContent = c.name;
            document.getElementById('courseCode').textContent = `${c.code} - Instructor: ${c.instructor.fullName}`;

            // Render Announcements
            const annList = document.getElementById('announcementsList');
            annList.innerHTML = '';
            if(c.announcements.length === 0) {
                annList.innerHTML = '<p style="color:#999">No announcements yet.</p>';
            }
            c.announcements.forEach(a => {
                const date = new Date(a.date).toLocaleDateString();
                annList.innerHTML += `
                    <div class="announcement-item">
                        <div class="announcement-content">
                            <h4>📢 Announcement</h4>
                            <p>${a.text}</p>
                            <span class="date-stamp">${date}</span>
                        </div>
                    </div>
                `;
            });

            // Render Lectures
            const lecList = document.getElementById('lecturesList');
            lecList.innerHTML = '';
            if(c.lectures.length === 0) {
                lecList.innerHTML = '<p style="color:#999">No lectures uploaded yet.</p>';
            }
            c.lectures.forEach(l => {
                const date = new Date(l.date).toLocaleDateString();
                lecList.innerHTML += `
                    <div class="lecture-item">
                        <div>
                            <strong><img src="images/pdf.png" style="width:24px; vertical-align: middle; margin-right: 10px;"> ${l.title} </img> </strong>
                            <span class="date-stamp">Posted on ${date}</span>
                        </div>
                        <a href="${l.link}" target="_blank" class="lecture-link">View</a>
                    </div>
                `;
            });

        }
    } catch (err) { console.error(err); }
}

// --- TEACHER FUNCTIONS ---

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
            loadCourseDetails(); // Reload to show new item
        }
    } catch(err) { console.error(err); }
}

async function postLecture() {
    const title = document.getElementById('lectureTitle').value;
    const fileInput = document.getElementById('lectureFile');
    
    if(!title || fileInput.files.length === 0) {
        return alert("Please enter a title and select a PDF file!");
    }

    // Prepare the data package
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', fileInput.files[0]); // The actual PDF file

    try {
        // Note: Do NOT set 'Content-Type': 'application/json'
        // The browser sets the correct content type for files automatically
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