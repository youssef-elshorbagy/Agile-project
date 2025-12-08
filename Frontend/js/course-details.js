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
        
        document.getElementById('announcementForm').style.display = 'block';
        document.getElementById('lectureForm').style.display = 'block';
    } else {
        backLink.href = "student.html";
        profileLink.href = "student.html";
    }
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
            // 1. Handle if 'course' is inside data or direct
            const c = result.data?.course || result.data || result;
            
            // 2. Fix Course Info Capitalization
            const instructor = c.instructor || c.Instructor || {};
            const instructorName = instructor.fullName || instructor.FullName || "Unknown Instructor";
            
            document.getElementById('courseName').textContent = c.name || c.Name;
            document.getElementById('courseCode').textContent = `${c.code || c.Code} - Instructor: ${instructorName}`;

            // --- FIXING ANNOUNCEMENTS ---
            const annList = document.getElementById('announcementsList');
            annList.innerHTML = '';
            
            // Safety check: ensure announcements exists and is an array
            const announcements = c.announcements || c.Announcements || [];

            if(announcements.length === 0) {
                annList.innerHTML = '<p style="color:#999">No announcements yet.</p>';
            }

            announcements.forEach(a => {
                // TRIAGE: Check all common SQL column names
                const rawDate = a.date || a.Date || a.createdAt || a.CreatedAt;
                const text = a.text || a.Text || a.content || a.Content || "No content";
                
                // Fix "Invalid Date"
                const dateObj = rawDate ? new Date(rawDate) : new Date();
                const dateStr = dateObj.toLocaleDateString();

                annList.innerHTML += `
                    <div class="announcement-item">
                        <div class="announcement-content">
                            <h4>📢 Announcement</h4>
                            <p>${text}</p>
                            <span class="date-stamp">${dateStr}</span>
                        </div>
                    </div>
                `;
            });

            // --- FIXING LECTURES ---
            const lecList = document.getElementById('lecturesList');
            lecList.innerHTML = '';
            
            // Safety check: ensure lectures exists
            const lectures = c.lectures || c.Lectures || [];

            if(lectures.length === 0) {
                lecList.innerHTML = '<p style="color:#999">No lectures uploaded yet.</p>';
            }

            lectures.forEach(l => {
                // TRIAGE: Check common SQL column names for lectures
                const rawDate = l.date || l.Date || l.createdAt || l.CreatedAt;
                const title = l.title || l.Title || "Untitled Lecture";
                
                // IMPORTANT: Your backend likely returns a file path now, not a full 'link'
                // Ensure we catch 'filePath', 'url', 'Link', etc.
                const link = l.link || l.Link || l.filePath || l.FilePath || l.url || "#";

                const dateObj = rawDate ? new Date(rawDate) : new Date();
                const dateStr = dateObj.toLocaleDateString();

                lecList.innerHTML += `
                    <div class="lecture-item">
                        <div>
                            <strong>
                                <img src="images/pdf.png" style="width:24px; vertical-align: middle; margin-right: 10px;"> 
                                ${title} 
                            </strong>
                            <span class="date-stamp">Posted on ${dateStr}</span>
                        </div>
                        <a href="${link}" target="_blank" class="lecture-link">View</a>
                    </div>
                `;
            });

        }
    } catch (err) { console.error("Error loading details:", err); }
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