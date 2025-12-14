const session = requireAuth('teacher');

// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('teacherName').textContent = session.user.fullName;
        
        document.getElementById('teacherFullName').textContent = session.user.fullName;
        document.getElementById('teacherEmail').textContent = session.user.email;
        document.getElementById('teacherId').textContent = session.user.universityId;

        loadTeacherCourses();
        // If this teacher is also an advisor, load advisor requests
        if (session.user.isAdvisor) {
            injectAdvisorSection();
            loadAdvisorRequests();
        }
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

// Injects a simple Advisor Requests section into the dashboard
function injectAdvisorSection() {
    const dashboard = document.getElementById('view-dashboard');
    if (!dashboard) return;

    const container = document.createElement('div');
    container.id = 'advisorRequestsSection';
    container.className = 'users-section';
    container.innerHTML = `
        <h2>Pending Course Requests (Advisor)</h2>
        <div class="users-table-container">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Course Requested</th>
                        <th>Student Name</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="advisorRequestsTableBody">
                    <tr><td colspan="3">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    // insert before assignments-section if present
    const assignments = dashboard.querySelector('.assignments-section');
    if (assignments) dashboard.insertBefore(container, assignments);
    else dashboard.appendChild(container);
}

// Load pending requests for all courses and render them for the advisor
async function loadAdvisorRequests() {
    const tbody = document.getElementById('advisorRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="3">Error: ${result.message || 'Failed to load'}</td></tr>`;
            return;
        }

        const courses = result.data?.courses || [];
        const rows = [];

        courses.forEach(c => {
            (c.studentsPending || []).forEach(s => {
                rows.push({ courseId: c.id, courseName: c.name || c.Name || c.code, studentId: s.id, studentName: s.fullName });
            });
        });

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No pending requests.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.courseName}</td>
                <td>${r.studentName}</td>
                <td>
                    <button class="approve-btn">Approve</button>
                    <button class="reject-btn">Reject</button>
                </td>
            `;

            const approveBtn = tr.querySelector('.approve-btn');
            const rejectBtn = tr.querySelector('.reject-btn');

            approveBtn.addEventListener('click', () => handleRequest(r.courseId, r.studentId, 'approve'));
            rejectBtn.addEventListener('click', () => handleRequest(r.courseId, r.studentId, 'reject'));

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error loading advisor requests:', err);
        tbody.innerHTML = `<tr><td colspan="3">Error loading requests</td></tr>`;
    }
}

// Sends approve/reject action to backend and refreshes lists
async function handleRequest(courseId, studentId, action) {
    try {
        const response = await fetch(`${API_URL}/courses/manage-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ courseId, studentId, action })
        });

        const result = await response.json();
        if (response.ok) {
            // refresh both advisor requests and teacher courses
            loadAdvisorRequests();
            loadTeacherCourses();
        } else {
            alert(result.message || 'Action failed');
        }
    } catch (err) {
        console.error('Error managing request:', err);
        alert('Request failed');
    }
}