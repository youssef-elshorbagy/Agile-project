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
        console.log("Fetching details for Course ID:", courseId);

        const response = await fetch(`${API_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        
        const result = await response.json();

        // Debugging: Log what the backend actually sent
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

        // 1. Get Course Object
        const c = result.data?.course;
        if (!c) throw new Error("Course data is missing from response");

        // 2. Populate Header Info
        // Backend sends: instructor: { fullName: "Dr. Smith" }
        const instructorName = c.instructor?.fullName || "Unknown Instructor";
        
        document.getElementById('courseName').textContent = c.name;
        document.getElementById('courseCode').textContent = `${c.code} - Instructor: ${instructorName}`;

        // 3. Populate Announcements
        const annList = document.getElementById('announcementsList');
        annList.innerHTML = '';
        
        const announcements = c.announcements || [];

        if (announcements.length === 0) {
            annList.innerHTML = '<p style="color:#999">No announcements yet.</p>';
        } else {
            announcements.forEach(a => {
                // Backend sends: { content: "...", teacherName: "...", createdAt: "..." }
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

        // 4. Populate Lectures
        const lecList = document.getElementById('lecturesList');
        lecList.innerHTML = '';
        
        const lectures = c.lectures || [];

        if (lectures.length === 0) {
            lecList.innerHTML = '<p style="color:#999">No lectures uploaded yet.</p>';
        } else {
            lectures.forEach(l => {
                // Backend sends: { title: "...", link: "http://..." }
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

    } catch (err) { 
        console.error("Error loading details:", err); 
        alert("Failed to load course details. Check console for error.");
    }
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