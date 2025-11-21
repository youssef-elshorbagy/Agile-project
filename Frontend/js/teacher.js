const session = requireAuth('teacher');

// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('teacherName').textContent = session.user.fullName;
        
        document.getElementById('teacherFullName').textContent = session.user.fullName;
        document.getElementById('teacherEmail').textContent = session.user.email;
        document.getElementById('teacherId').textContent = session.user.universityId;

        loadTeacherCourses();
    }
});

function switchView(viewName, element) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    
    if(element) element.classList.add('active');
}

async function loadTeacherCourses() {
    const grid = document.getElementById('teacherCoursesGrid');

    try {
        const response = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            grid.innerHTML = '';

            if(result.data.courses.length === 0) {
                grid.innerHTML = '<p>You have not been assigned any courses yet.</p>';
                return;
            }

            result.data.courses.forEach(c => {
                const studentCount = c.studentsEnrolled.length;
                const pendingCount = c.studentsPending.length;

                grid.innerHTML += `
                    <div class="course-card" onclick="window.location.href='course-details.html?id=${c._id}'" style="cursor: pointer;">
                        <h3>${c.name}</h3>
                        <p>${c.code} - ${c.creditHours} Credits</p>
                        <div class="course-info" style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; margin-top: 10px;">
                            <span style="display:block;">Students Enrolled: <strong>${studentCount}</strong></span>
                            <span style="display:block;">Pending Requests: <strong>${pendingCount}</strong></span>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) { console.error(err); }
}