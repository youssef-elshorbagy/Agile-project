// Security Check
const session = requireAuth('admin');

// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('adminName').textContent = session.user.fullName;
        loadUsers();       
        loadInstructors(); 
        loadCourses();     
    }
    // show advisor checkbox only when Role is 'teacher'
    const roleSelect = document.getElementById('userRole');
    const advisorToggle = document.getElementById('advisorToggle');
    if (roleSelect && advisorToggle) {
        function updateAdvisorToggle() {
            advisorToggle.style.display = roleSelect.value === 'teacher' ? 'flex' : 'none';
            const capacityInput = document.getElementById('advisorCapacityGroup');
            if (capacityInput) capacityInput.style.display = (roleSelect.value === 'teacher' && document.getElementById('makeAdvisorCheckbox').checked) ? 'block' : 'none';
        }
        roleSelect.addEventListener('change', updateAdvisorToggle);
        const makeAdvCheckbox = document.getElementById('makeAdvisorCheckbox');
        if (makeAdvCheckbox) makeAdvCheckbox.addEventListener('change', updateAdvisorToggle);
        updateAdvisorToggle();
    }
});

// Navigation
function switchView(viewName, element) {
    document.getElementById('view-users').style.display = 'none';
    document.getElementById('view-courses').style.display = 'none';
    document.getElementById('view-enrollments').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    if (viewName === 'courses') {
        loadInstructors();
    }
}


async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    const countSpan = document.getElementById('userCount');

    try {
        const response = await fetch(`${API_URL}/users?limit=100`, {
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
                        <td>
                          <span class="role-badge role-${u.role}">${u.role}</span>
                          ${u.isAdvisor ? '<span class="role-badge role-advisor">advisor</span>' : ''}
                        </td>
                        <td>${u.fullName}</td>
                        <!-- Action column removed -->
                    </tr>`;
            });
            // attachAssignAdvisorHandlers removed — assignment feature disabled
        }
    } catch (err) { console.error(err); }
}

async function addUser(e) {
    e.preventDefault();
    
    const universityId = document.getElementById('universityId').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const fullName = document.getElementById('userName').value;
    const isAdvisor = document.getElementById('makeAdvisorCheckbox') ? document.getElementById('makeAdvisorCheckbox').checked : false;
    const advisorCapacity = document.getElementById('advisorCapacity') ? document.getElementById('advisorCapacity').value : undefined;

    const errorDiv = document.getElementById('addUserError');
    const successDiv = document.getElementById('addUserSuccess');

    try {
        const response = await fetch(`${API_URL}/users/signup`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ universityId, email, password, role, fullName, isAdvisor, advisorCapacity })
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


async function loadInstructors() {
    const select = document.getElementById('courseInstructor');
    try {
        const response = await fetch(`${API_URL}/users?limit=100`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();
        
        if(response.ok) {
            const teachers = result.data.users.filter(u => u.role === 'teacher');
            
            select.innerHTML = '<option value="">Select a Teacher...</option>';
            
            teachers.forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
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
            loadCourses(); 
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


    try {
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            tbody.innerHTML = '';
           

            result.data.courses.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.code}</td>
                        <td>${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'Unknown'}</td>
                    </tr>
                `;
                
        
            });
        }
    } catch (err) { console.error(err); }
}

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
            loadCourses();
        } else {
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}

async function assignAdvisorPrompt(studentId) {
    try {
        console.log('assignAdvisorPrompt called for studentId', studentId);
        const resp = await fetch(`${API_URL}/advisors`, { headers: { 'Authorization': `Bearer ${session.token}` } });
        const data = await resp.json();
        if (!resp.ok) return alert('Failed to load advisors: ' + data.message);

        let advisors = data.data.advisors || [];
        // If /advisors returned none, fallback to /users and filter teacher users with isAdvisor flag
        if (!advisors || advisors.length === 0) {
            try {
                const usersResp = await fetch(`${API_URL}/users?limit=100`, { headers: { 'Authorization': `Bearer ${session.token}` } });
                const usersData = await usersResp.json();
                if (usersResp.ok) {
                    advisors = (usersData.data.users || []).filter(u => u.role === 'teacher' && u.isAdvisor === true).map(u => ({ id: u.id, fullName: u.fullName, email: u.email, capacity: u.capacity || null, assignedCount: u.assignedCount || 0 }));
                }
            } catch (e) {
                console.error('fallback /users for advisors failed', e);
            }
        }

        // assignment feature removed
        return alert('Advisor assignment feature has been disabled.');
    } catch (err) {
        console.error(err);
        alert('Error assigning advisor');
    }
}