const session = requireAuth('student');

// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('studentName').textContent = session.user.fullName;
        document.getElementById('studentFullName').textContent = session.user.fullName;
        document.getElementById('studentEmail').textContent = session.user.email;
        
        document.getElementById('studentId').textContent = session.user.universityId || 'N/A';

        const level = session.user.level || 1;
        const gpa = session.user.gpa || 0.00;

        const levelTextEl = document.getElementById('studentLevel'); 
        if(levelTextEl) levelTextEl.textContent = level;

        const gpaTextEl = document.getElementById('displayGPA');
        if(gpaTextEl) gpaTextEl.textContent = gpa.toFixed(2);

        const percentage = (gpa / 4.0) * 100;
        setTimeout(() => {
            const bar = document.getElementById('gpaBar');
            if(bar) bar.style.width = `${percentage}%`;
        }, 300);

        loadMyCourses();
    }
});



// Navigation 
function switchView(viewName, element) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-register').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';
   const assignmentFormEl = document.getElementById('assignmentForm');
    if (assignmentFormEl) assignmentFormEl.style.display = 'block';
    
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));

    if (element) {
        element.classList.add('active');
    }

    if (viewName === 'register') {
        loadAvailableCourses();
    }
}




async function loadMyCourses() {
    const grid = document.getElementById('coursesGrid');
    if(!grid) return;

    try {
        const response = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            grid.innerHTML = ''; 

            if(result.data.courses.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#666;">You are not enrolled in any courses yet.</p>';
                return;
            }

            result.data.courses.forEach(c => {
                grid.innerHTML += `
                    <div class="course-card" onclick="window.location.href='course-details.html?id=${c.id}'" style="cursor: pointer;">
                        <h3>${c.name}</h3>
                        <p>${c.code} - ${c.creditHours} Credit Hours</p>
                        <div class="course-info">
                            <span>Instructor: ${c.instructor ? c.instructor.fullName : 'TBA'}</span>
                            <span>Status: <strong style="color: #aaffaa">Enrolled</strong></span>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) { console.error(err); }
}






async function loadAvailableCourses() {
    const tbody = document.querySelector('#view-register tbody');
    if(!tbody) return; 

    try {
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            tbody.innerHTML = '';
            const myId = session.user.id; 

            result.data.courses.forEach(c => {
                let actionBtn = '';
                
                const isEnrolled = c.studentsEnrolled.some(s => s.id === myId || s === myId);
                const isPending = c.studentsPending.some(s => s.id === myId || s === myId);

                if (isEnrolled) {
                    actionBtn = `<span class="status-badge status-completed">Enrolled</span>`;
                } else if (isPending) {
                    actionBtn = `<span class="status-badge status-pending">Pending</span>`;
                } else {
                    actionBtn = `<button onclick="requestCourse('${c.id}')" class="register-btn">Request</button>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td>${c.code}</td>
                        <td>${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'TBA'}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function requestCourse(courseId) {
    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/request`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();
        
        if(response.ok) {
            alert("Request Sent! Waiting for Academic Advisor approval.");
            loadAvailableCourses(); 
        } else {
            alert(result.message);
        }
    } catch (err) { console.error(err); }
}

// 1. Add this line inside your existing DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        // ... existing code ...
        loadMyCourses();
        loadDashboardAssignments(); // <--- ADD THIS LINE
    }
});

// 2. Add this entire function to the bottom of the file
async function loadDashboardAssignments() {
    const container = document.getElementById('dashboardAssignments');
    if(!container) return;

    try {
        const response = await fetch(`${API_URL}/courses/my-assignments`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (response.ok) {
            const assignments = result.data;

            if (assignments.length === 0) {
                container.innerHTML = '<p style="color:#666;">No pending assignments. Good job!</p>';
                return;
            }

            container.innerHTML = ''; // Clear loading text

            assignments.forEach(ass => {
                // --- TIME LOGIC ---
                const now = new Date();
                const deadline = new Date(ass.Deadline);
                const diffMs = deadline - now;
                
                // Calculate Status
                let timeString = "";
                let statusColor = "#666"; // Default gray
                let statusText = "";

                if (ass.Grade !== null) {
                    // CASE 1: Graded
                    statusText = `✅ Graded: ${ass.Grade}/100`;
                    statusColor = "#2ed573"; // Green
                    timeString = "Completed";
                } else if (ass.SubmissionID) {
                    // CASE 2: Submitted but not graded
                    statusText = "⏳ Submitted (Pending Grade)";
                    statusColor = "#ffa502"; // Orange
                    timeString = "Done";
                } else if (diffMs < 0) {
                    // CASE 3: Overdue
                    statusText = "❌ Overdue";
                    statusColor = "#ff4757"; // Red
                    timeString = getTimeRemainingString(diffMs); // Will return "X days ago"
                } else {
                    // CASE 4: Pending
                    statusText = "📝 To Do";
                    statusColor = "#3742fa"; // Blue
                    timeString = getTimeRemainingString(diffMs); // Will return "X days left"
                }

                // Render Card
                const card = document.createElement('div');
                card.className = 'assignment-card'; // Make sure to style this in CSS
                card.style.cssText = "background:white; padding:15px; margin-bottom:10px; border-radius:8px; border-left: 5px solid " + statusColor + "; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";
                
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0; font-size:16px;">${ass.Title}</h4>
                            <small style="color:#666;">${ass.CourseCode} - ${ass.CourseName}</small>
                        </div>
                        <div style="text-align:right;">
                            <strong style="display:block; color:${statusColor}">${statusText}</strong>
                            <span style="font-size:12px; color:#888;">${timeString}</span>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        console.error("Error loading dashboard assignments:", err);
    }
}

// Helper function to make time readable
function getTimeRemainingString(diffMs) {
    const isOverdue = diffMs < 0;
    const absMs = Math.abs(diffMs);
    
    const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    let text = "";
    if (days > 0) text = `${days}d ${hours}h`;
    else text = `${hours} hours`;

    return isOverdue ? `${text} overdue` : `${text} remaining`;
}
