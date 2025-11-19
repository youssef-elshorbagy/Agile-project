// 1. Security Check
const session = requireAuth('admin');

// 2. Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('adminName').textContent = session.user.fullName;
        loadUsers();       // Load Users for Tab 1
        loadInstructors(); // Load Teachers for Tab 2 Dropdown
        loadCourses();     // Load Courses for Tab 2 List
    }
});

// --- NAVIGATION LOGIC ---
function switchView(viewName, element) {
    // Hide all views
    document.getElementById('view-users').style.display = 'none';
    document.getElementById('view-courses').style.display = 'none';
    document.getElementById('view-enrollments').style.display = 'none';

    // Show selected
    document.getElementById(`view-${viewName}`).style.display = 'block';

    // Update Active Button
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    if (viewName === 'courses') {
        loadInstructors();
    }
}

// --- TAB 1: USER MANAGEMENT ---

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    const countSpan = document.getElementById('userCount');

    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (response.ok) {
            const users = result.data.users;
            countSpan.textContent = users.length;
            tbody.innerHTML = '';

            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.universityId}</strong></td>

                        <td>${u.email}</td>
                        <td><span class="role-badge role-${u.role}">${u.role}</span></td>
                        <td>${u.fullName}</td>
                    </tr>`;
            });
        }
    } catch (err) { console.error(err); }
}

async function addUser(e) {
    e.preventDefault();
    
    // Get the new value
    const universityId = document.getElementById('universityId').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const fullName = document.getElementById('userName').value;

    const errorDiv = document.getElementById('addUserError');
    const successDiv = document.getElementById('addUserSuccess');

    try {
        const response = await fetch(`${API_URL}/users/signup`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${session.token}` 
            },
            // Send universityId in the body
            body: JSON.stringify({ universityId, email, password, role, fullName })
        });

        const result = await response.json();

        if (response.ok) {
            successDiv.textContent = "User created!";
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            document.getElementById('userForm').reset();
            loadUsers();
            loadInstructors();
        } else {
            // This will show backend errors (like "Password must start with Capital")
            throw new Error(result.message);
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }
}

function toggleAddUserForm() {
    const form = document.getElementById('addUserForm');
    const btn = document.getElementById('addUserBtn');
    if(form.style.display === 'none') {
        form.style.display = 'block';
        btn.textContent = 'Cancel';
    } else {
        form.style.display = 'none';
        btn.textContent = '+ Add New User';
    }
}

// --- TAB 2: COURSE MANAGEMENT ---

// Helper: Populate the Teacher Dropdown
async function loadInstructors() {
    const select = document.getElementById('courseInstructor');
    try {
        // CHANGED: Added ?limit=100 to get everyone
        const response = await fetch(`${API_URL}/users?limit=100`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();
        
        if(response.ok) {
            const teachers = result.data.users.filter(u => u.role === 'teacher');
            
            select.innerHTML = '<option value="">Select a Teacher...</option>';
            
            teachers.forEach(t => {
                const option = document.createElement('option');
                option.value = t._id;
                option.textContent = t.fullName;
                select.appendChild(option);
            });
        }
    } catch (err) { console.error(err); }
}

async function addCourse(e) {
    e.preventDefault();
    
    const name = document.getElementById('courseName').value;
    const code = document.getElementById('courseCode').value;
    const creditHours = document.getElementById('courseCredits').value;
    const instructor = document.getElementById('courseInstructor').value;

    const errorDiv = document.getElementById('addCourseError');
    const successDiv = document.getElementById('addCourseSuccess');

    try {
        const response = await fetch(`${API_URL}/courses`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ name, code, creditHours, instructor })
        });

        const result = await response.json();

        if(response.ok) {
            successDiv.textContent = "Course Created Successfully!";
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            document.getElementById('courseForm').reset();
            loadCourses(); // Refresh list
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }
}

async function loadCourses() {
    const tbody = document.getElementById('coursesTableBody');
    const requestsBody = document.getElementById('requestsTableBody'); // For Tab 3

    try {
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            tbody.innerHTML = '';
            requestsBody.innerHTML = '';

            result.data.courses.forEach(c => {
                // Populate Course List (Tab 2)
                tbody.innerHTML += `
                    <tr>
                        <td>${c.code}</td>
                        <td>${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'Unknown'}</td>
                    </tr>
                `;

                // Populate Requests/Enrollments (Tab 3)
                requestsBody.innerHTML += `
                    <tr>
                        <td>${c.code} - ${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'Unknown'}</td>
                        <td>${c.studentsEnrolled.length} Students</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

// ... existing code ...

async function loadCourses() {
    const tbody = document.getElementById('coursesTableBody');
    const requestsBody = document.getElementById('requestsTableBody');

    try {
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            tbody.innerHTML = '';
            requestsBody.innerHTML = '';

            result.data.courses.forEach(c => {
                // TAB 2: Course List
                tbody.innerHTML += `
                    <tr>
                        <td>${c.code}</td>
                        <td>${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'Unknown'}</td>
                    </tr>
                `;

                // TAB 3: PENDING REQUESTS LOOP
                // We check if this course has any pending students
                if (c.studentsPending && c.studentsPending.length > 0) {
                    c.studentsPending.forEach(student => {
                        requestsBody.innerHTML += `
                            <tr>
                                <td><strong>${c.code}</strong> - ${c.name}</td>
                                <td>${student.fullName} (${student.email})</td>
                                <td>
                                    <button onclick="handleRequest('${c._id}', '${student._id}', 'approve')" 
                                            style="background:#2ed573; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">
                                        Approve
                                    </button>
                                    <button onclick="handleRequest('${c._id}', '${student._id}', 'decline')" 
                                            style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                                        Decline
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                }
            });
            
            if(requestsBody.innerHTML === '') {
                requestsBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No pending requests</td></tr>';
            }
        }
    } catch (err) { console.error(err); }
}

// NEW FUNCTION: Handle the click
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
        
        if(response.ok) {
            // Refresh list to remove the processed request
            loadCourses();
        } else {
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}