const session = requireAuth('teacher');

// ==========================================
// 1. STARTUP LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        // Load Profile Info
        document.getElementById('teacherName').textContent = session.user.fullName;
        document.getElementById('teacherFullName').textContent = session.user.fullName;
        document.getElementById('teacherEmail').textContent = session.user.email;
        document.getElementById('teacherId').textContent = session.user.universityId;

        // Load Classes
        loadTeacherCourses();

        // Load Advisor Data (If user is an advisor)
        // NEW CODE (Trusts the Capacity instead)
// If capacity exists and is > 0, you ARE an advisor.
        if (session.user.advisorCapacity > 0 || session.user.isAdvisor) {
        console.log("👨‍🏫 Advisor detected via Capacity Check!"); 
        loadAdvisorRequests();
}
    }
});

// ==========================================
// 2. NAVIGATION
// ==========================================
function switchView(viewName, element) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    
    if(element) element.classList.add('active');
}

// ==========================================
// 3. TEACHER COURSES (My Classes)
// ==========================================
async function loadTeacherCourses() {
    const grid = document.getElementById('teacherCoursesGrid');

    try {
        const response = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            grid.innerHTML = '';
            
            const courses = result.data?.courses || result.data || result;

            if(!courses || courses.length === 0) {
                grid.innerHTML = '<p>You have not been assigned any courses yet.</p>';
                return;
            }

            courses.forEach(c => {
                const studentCount = (c.studentsEnrolled || []).length;
                const pendingCount = (c.studentsPending || []).length;
                const courseName = c.Name || c.name;
                const courseCode = c.Code || c.code;
                const creditHours = c.CreditHours || c.creditHours;
                const courseId = c.id || c.CourseID || c.ID; 

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

// ==========================================
// 4. ADVISOR LOGIC (The Fix)
// ==========================================
async function loadAdvisorRequests() {
    const section = document.getElementById('advisorSection');
    const tbody = document.getElementById('advisorTableBody');
    
    // Show the hidden section
    if(section) section.style.display = 'block';

    try {
        // Fetch data from the NEW route
        const response = await fetch(`${API_URL}/courses/pending-enrollments`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        
        console.log("Advisor Fetch Status:", response.status); // Check Console for 200

        const result = await response.json();

        if (response.ok) {
            tbody.innerHTML = ''; // Clear old data
            
            if (!result.data || result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px;">No pending requests.</td></tr>';
                return;
            }

            // Render rows using the HTML table you already have
            result.data.forEach(req => {
                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${req.StudentName}</td>
                        <td style="padding: 12px;">${req.universityId}</td>
                        <td style="padding: 12px;">${req.code} - ${req.CourseName}</td>
                        <td style="padding: 12px;">
                            <button onclick="handleRequest(${req.EnrollmentID}, 'enrolled')" style="background:#2ed573; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">Approve</button>
                            <button onclick="handleRequest(${req.EnrollmentID}, 'rejected')" style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Reject</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) { 
        console.error("Advisor Load Error:", err); 
    }
}

async function handleRequest(enrollmentId, status) {
    if(!confirm(`Are you sure you want to ${status === 'enrolled' ? 'APPROVE' : 'REJECT'} this student?`)) return;

    try {
        const response = await fetch(`${API_URL}/courses/manage-request`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ enrollmentId, status })
        });

        if (response.ok) {
            alert("Success!");
            loadAdvisorRequests(); // Refresh table immediately
        } else {
            alert("Error updating request.");
        }
    } catch (err) { console.error(err); }
}

