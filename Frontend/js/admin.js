const session = requireAuth('admin');

// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('adminName').textContent = session.user.fullName;
        loadUsers();       
        loadInstructors(); 
        loadCourses();     
    }
    // show advisor checkbox only when Role is 'Teacher'
    const roleSelect = document.getElementById('userRole');
    const advisorToggle = document.getElementById('advisorToggle');
    if (roleSelect && advisorToggle) {
        function updateAdvisorToggle() {
            // EAV roles are typically capitalized: 'Teacher'
            const isTeacherSelected = roleSelect.value.toLowerCase() === 'teacher';
            advisorToggle.style.display = isTeacherSelected ? 'flex' : 'none';
            const capacityInput = document.getElementById('advisorCapacityGroup');
            if (capacityInput) {
                capacityInput.style.display = (isTeacherSelected && document.getElementById('makeAdvisorCheckbox').checked) ? 'block' : 'none';
            }
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
    document.getElementById('view-staff').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    if (viewName === 'courses') {
        loadInstructors();
        loadCourses();
    } else if (viewName === 'staff') {
        loadStaffDirectory();
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
                // Ensure role casing matches database for CSS badges
                const roleClass = (u.role || 'student').toLowerCase();
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.universityId}</strong></td>
                        <td>${u.email}</td>
                        <td>
                          <span class="role-badge role-${roleClass}">${u.role}</span>
                        </td>
                        <td>${u.fullName}</td>
                    </tr>`;
            });
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
    if (!select) return;

    try {
        const response = await fetch(`${API_URL}/users?limit=100`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();
        
        if(response.ok) {
            const teachers = result.data.users.filter(u => 
                u.role === 'Teacher' || u.role === 'teacher'
            );
            
            select.innerHTML = '<option value="">Select a Teacher...</option>';
            
            teachers.forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
                option.textContent = t.fullName;
                select.appendChild(option);
            });
        }
    } catch (err) { 
        console.error("Error loading instructors:", err); 
        select.innerHTML = '<option value="">Error loading list</option>';
    }
}



async function addCourse(e) {
    e.preventDefault();
    
    const name = document.getElementById('courseName').value;
    const code = document.getElementById('courseCode').value;
    const creditHours = document.getElementById('courseCredits').value;
    const instructor = document.getElementById('courseInstructor').value;
    
    // Get EAV fields
    const level = document.getElementById('courseLevel') ? document.getElementById('courseLevel').value : null;
    const prerequisite = document.getElementById('coursePrereq') ? document.getElementById('coursePrereq').value : null;

    const errorDiv = document.getElementById('addCourseError');
    const successDiv = document.getElementById('addCourseSuccess');

    try {
        const response = await fetch(`${API_URL}/courses`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ 
                name, 
                code, 
                creditHours, 
                instructor,
                level,
                prerequisite 
            })
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
                // Displaying Credits and Level
                tbody.innerHTML += `
                    <tr>
                        <td>${c.code}</td>
                        <td>${c.name}</td>
                        <td>${c.instructor ? c.instructor.fullName : 'Unknown'}</td>
                        <td>${c.creditHours || '-'}</td>
                        <td>${c.level || '-'}</td>
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
// ============================================================================
// PARENT-STUDENT MANAGEMENT SECTION
// Copy everything below and paste at the BOTTOM of your admin.js file
// ============================================================================

function loadParentStudentManagement() {
    const container = document.querySelector('.main-content');
    container.innerHTML = `
        <div class="content-header">
            <h2>Parent-Student Management</h2>
            <p class="subtitle">Link parents to their children's accounts</p>
        </div>
        <div class="loading">Loading...</div>
    `;

    fetchParentsAndStudents();
}

async function fetchParentsAndStudents() {
    try {
        const res = await fetch(`${API_URL}/admin/parents-students`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Failed to load data');

        const result = await res.json();
        const { parents, students, links } = result.data;

        renderParentStudentManagement(parents, students, links);
    } catch (err) {
        console.error('Error:', err);
        document.querySelector('.main-content').innerHTML = `
            <div class="error-state">
                <p>Error loading data: ${err.message}</p>
            </div>
        `;
    }
}

function renderParentStudentManagement(parents, students, links) {
    const container = document.querySelector('.main-content');
    
    let html = `
        <div class="content-header">
            <h2>Parent-Student Management</h2>
            <button class="btn btn-primary" onclick="showLinkForm()">+ Link Parent to Student</button>
        </div>

        <div id="linkForm" class="link-form-card" style="display: none;">
            <h3>Link Parent to Student</h3>
            <form onsubmit="handleLinkParentStudent(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label for="parentSelect">Select Parent:</label>
                        <select id="parentSelect" required>
                            <option value="">-- Select Parent --</option>
                            ${parents.map(p => `
                                <option value="${p.id}">
                                    ${p.fullName} (${p.universityId}) - ${p.email}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="studentSelect">Select Student:</label>
                        <select id="studentSelect" required>
                            <option value="">-- Select Student --</option>
                            ${students.map(s => `
                                <option value="${s.id}">
                                    ${s.fullName} (${s.universityId}) - Level ${s.level || 1}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Link</button>
                    <button type="button" class="btn btn-secondary" onclick="hideLinkForm()">Cancel</button>
                </div>
            </form>
        </div>

        <div class="links-section">
            <h3>Existing Links (${links.length})</h3>
    `;

    if (links.length === 0) {
        html += `
            <div class="empty-state">
                <p>No parent-student links found</p>
                <p class="text-muted">Click "Link Parent to Student" to create a link</p>
            </div>
        `;
    } else {
        html += `
            <div class="links-table-container">
                <table class="links-table">
                    <thead>
                        <tr>
                            <th>Parent Name</th>
                            <th>Student Name</th>
                            <th>Student ID</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${links.map(link => `
                            <tr>
                                <td>${link.parentName}</td>
                                <td>${link.studentName}</td>
                                <td>${link.studentUniversityId}</td>
                                <td>
                                    <button class="btn-danger-small" onclick="handleUnlink(${link.linkId}, '${link.parentName}', '${link.studentName}')">
                                        Unlink
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function showLinkForm() {
    document.getElementById('linkForm').style.display = 'block';
    document.getElementById('linkForm').scrollIntoView({ behavior: 'smooth' });
}

function hideLinkForm() {
    document.getElementById('linkForm').style.display = 'none';
    document.getElementById('parentSelect').value = '';
    document.getElementById('studentSelect').value = '';
}

async function handleLinkParentStudent(event) {
    event.preventDefault();
    
    const parentId = parseInt(document.getElementById('parentSelect').value);
    const studentId = parseInt(document.getElementById('studentSelect').value);

    if (!parentId || !studentId) {
        alert('Please select both parent and student');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/link-parent-student`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ parentId, studentId })
        });

        const result = await res.json();

        if (res.ok) {
            alert('Parent linked to student successfully!');
            hideLinkForm();
            fetchParentsAndStudents();
        } else {
            alert(result.message || 'Failed to link parent to student');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error linking parent to student');
    }
}

async function handleUnlink(linkId, parentName, studentName) {
    if (!confirm(`Are you sure you want to unlink ${parentName} from ${studentName}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/unlink-parent-student/${linkId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const result = await res.json();

        if (res.ok) {
            alert('Parent unlinked successfully!');
            fetchParentsAndStudents();
        } else {
            alert(result.message || 'Failed to unlink');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error unlinking parent from student');
    }
}