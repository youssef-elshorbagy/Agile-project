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
            
            // 1. IMPORTANT: Check if the data is inside 'result.data.courses' or just 'result'
            // SQL backends sometimes just return the array directly.
            const courses = result.data?.courses || result.data || result;

            if(!courses || courses.length === 0) {
                grid.innerHTML = '<p>You have not been assigned any courses yet.</p>';
                return;
            }

            courses.forEach(c => {
                // 2. SAFETY FIX: Use ( || [] ) to prevent crashing if the array is missing
                // This says: "If studentsEnrolled is undefined, use an empty list instead"
                const studentCount = (c.studentsEnrolled || []).length;
                const pendingCount = (c.studentsPending || []).length;

                // 3. CAPITALIZATION FIX: SQL often returns PascalCase (Name vs name)
                // We check both c.Name AND c.name just to be safe.
                const courseName = c.Name || c.name;
                const courseCode = c.Code || c.code;
                const creditHours = c.CreditHours || c.creditHours;
                const courseId = c.id || c.CourseID || c.ID; // Check for ID variations

                grid.innerHTML += `
                    <div class="course-card" onclick="window.location.href='course-details.html?id=${courseId}'" style="cursor: pointer;">
                        <h3>${courseName}</h3>
                        <p>${courseCode} - ${creditHours} Credits</p>
                        <div class="course-info" style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; margin-top: 10px;">
                            <span style="display:block;">Students Enrolled: <strong>${studentCount}</strong></span>
                            <span style="display:block;">Pending Requests: <strong>${pendingCount}</strong></span>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) { 
        console.error("Error loading courses:", err); 
    }
}