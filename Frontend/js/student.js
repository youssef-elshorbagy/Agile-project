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
