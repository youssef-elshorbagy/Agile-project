const session = requireAuth('Teacher'); 

document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        // Populate Teacher Info
        document.getElementById('teacherName').textContent = session.user.fullName;
        document.getElementById('teacherFullName').textContent = session.user.fullName;
        document.getElementById('teacherEmail').textContent = session.user.email;
        document.getElementById('teacherId').textContent = session.user.universityId || 'N/A';

        // Load Dashboard Data
        loadTeacherCourses();
        loadPendingGrading(); 

        // Show Advisor Tab if applicable (reconstructed from PersonRoles)
        if (session.user.isAdvisor) {
            const navRequests = document.getElementById('navRequests');
            if (navRequests) navRequests.style.display = 'inline-block';
            loadAdvisorRequests();
        }
    }
});

// Navigation Handler
function switchView(viewName, element) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-requests').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';
    document.getElementById('view-messages').style.display = 'none';

    document.getElementById(`view-${viewName}`).style.display = 'block';

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    
    if(element) element.classList.add('active');

    if (viewName === 'messages') {
        loadTeacherMessages();
    }
}

/* ================================
   1. LOAD COURSES
   ================================ */
async function loadTeacherCourses() {
    const grid = document.getElementById('teacherCoursesGrid');
    grid.innerHTML = '<p style="color:#666;">Loading courses...</p>';

    try {
        const response = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            grid.innerHTML = '';
            const courses = result.data?.courses || [];

            if(courses.length === 0) {
                grid.innerHTML = '<p>You have not been assigned any courses yet.</p>';
                return;
            }

            courses.forEach(c => {
                // Handle casing differences from EAV reconstruction
                const courseId = c.id;
                const name = c.name;
                const code = c.code;
                const credits = c.creditHours;
                const studentCount = (c.studentsEnrolled || []).length;
                const pendingCount = (c.studentsPending || []).length;

                grid.innerHTML += `
                    <div class="course-card" onclick="window.location.href='course-details.html?id=${courseId}'" style="cursor: pointer;">
                        <h3 style="color: white;">${name}</h3>
                        <p>${code} - ${credits} Credits</p>
                        <div class="course-info" style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; margin-top: 10px;">
                            <span style="display:block;">Students: <strong>${studentCount}</strong></span>
                            ${pendingCount > 0 ? `<span style="display:block; color:#ffd700;">Pending Requests: <strong>${pendingCount}</strong></span>` : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            grid.innerHTML = `<p>Error: ${result.message}</p>`;
        }
    } catch (err) { 
        console.error("Error loading courses:", err); 
        grid.innerHTML = `<p>Error loading courses.</p>`;
    }
}

/* ================================
   2. PENDING GRADING (THE MISSING FUNCTION)
   ================================ */
async function loadPendingGrading() {
    // Finds the container used in your teacher.html
    let container = document.querySelector('.assignments-section');
    if (!container) return;
    
    container.innerHTML = '<h2>Pending Grading</h2><p class="text-muted">Checking submissions...</p>';

    try {
        // 1. Get My Courses
        const courseRes = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const courseData = await courseRes.json();
        const courses = courseData.data?.courses || [];

        let html = '<h2>Pending Grading</h2>';
        let totalUngraded = 0;

        // 2. Iterate Courses to find Assignments
        // Note: This matches the logic you had, looping client-side because there isn't a global "all submissions" endpoint
        for (const course of courses) {
            // Fetch Course Details (to get assignments list)
            const detailsRes = await fetch(`${API_URL}/courses/${course.id}`, {
                 headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const detailsData = await detailsRes.json();
            const assignments = detailsData.data?.course?.assignments || [];

            for (const ass of assignments) {
                // Fetch Submissions for this Assignment
                const subRes = await fetch(`${API_URL}/courses/${course.id}/assignments/${ass.id}/submissions`, {
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                const subData = await subRes.json();
                const submissions = subData.data || [];

                // 3. Filter for Ungraded (Grade is null)
                const pending = submissions.filter(s => s.Grade === null || s.Grade === undefined);
                
                if (pending.length > 0) {
                    totalUngraded += pending.length;
                    html += `
                        <div style="background:white; padding:15px; border-radius:8px; border-left:5px solid #f1c40f; margin-bottom:12px; box-shadow:0 2px 5px rgba(0,0,0,0.05); cursor:pointer;"
                             onclick="window.location.href='course-details.html?id=${course.id}'">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:#2c3e50; font-size:1.05em;">${ass.title}</strong>
                                    <div style="font-size:0.9em; color:#7f8c8d; margin-top:4px;">${course.code} - ${course.name}</div>
                                </div>
                                <span class="badge" style="background:#f1c40f; color:#fff; padding:6px 12px; border-radius:12px; font-weight:bold;">
                                    ${pending.length} to grade
                                </span>
                            </div>
                        </div>
                    `;
                }
            }
        }

        if (totalUngraded === 0) {
            html += '<div style="padding:20px; background:#f0fff4; border-radius:8px; color:#27ae60; text-align:center;">🎉 You have no pending grading tasks!</div>';
        }

        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading grading:", err);
        container.innerHTML = '<h2>Pending Grading</h2><p class="error-text">Error loading grading tasks.</p>';
    }
}

/* ================================
   3. ADVISOR REQUESTS
   ================================ */
async function loadAdvisorRequests() {
    const tbody = document.getElementById('advisorRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Loading requests...</td></tr>';

    try {
        // Advisors can see all courses to manage enrollments
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="3">Error loading data</td></tr>`;
            return;
        }

        const courses = result.data?.courses || [];
        const rows = [];

        courses.forEach(c => {
            (c.studentsPending || []).forEach(s => {
                rows.push({ 
                    enrollmentId: s.EnrollmentID, 
                    courseName: c.name, 
                    studentName: s.fullName 
                });
            });
        });

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No pending enrollment requests.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${r.courseName}</strong></td>
                <td>${r.studentName}</td>
                <td>
                    <button class="approve-btn">Approve</button>
                    <button class="reject-btn">Reject</button>
                </td>
            `;

            const approveBtn = tr.querySelector('.approve-btn');
            const rejectBtn = tr.querySelector('.reject-btn');

            // Enrollment Actions
            approveBtn.addEventListener('click', () => handleRequest(r.enrollmentId, 'enrolled'));
            rejectBtn.addEventListener('click', () => handleRequest(r.enrollmentId, 'rejected'));

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error:', err);
        tbody.innerHTML = `<tr><td colspan="3">Error loading requests</td></tr>`;
    }
}

async function handleRequest(enrollmentId, status) {
    if(!confirm(`Are you sure you want to set status to ${status}?`)) return;

    try {
        const response = await fetch(`${API_URL}/courses/manage-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ enrollmentId, status })
        });

        const result = await response.json();
        if (response.ok) {
            loadAdvisorRequests(); // Refresh table
            loadTeacherCourses();  // Refresh course counts
        } else {
            alert(result.message || 'Action failed');
        }
    } catch (err) {
        console.error(err);
        alert('Network error');
    }
}

/* ================================
   4. MESSAGES
   ================================ */
async function loadTeacherMessages() {
    const container = document.getElementById('teacherMessagesList');
    container.innerHTML = '<div class="loading">Loading messages...</div>';

    try {
        const res = await fetch(`${API_URL}/messages`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await res.json();

        if (result.status === 'success') {
            const messages = result.data.messages || [];
            
            if (messages.length === 0) {
                container.innerHTML = '<div class="empty-state">No messages found.</div>';
                return;
            }

            let html = '';
            messages.forEach(msg => {
                const isMe = msg.senderId === session.user.id;
                const otherName = isMe ? msg.receiverName : msg.senderName;
                
                html += `
                    <div class="message-card" style="border-left: 5px solid ${isMe ? '#a29bfe' : '#00b894'}; background: ${isMe ? '#f8f9fa' : 'white'};">
                        <div>
                            <span class="msg-sender">${isMe ? 'Me' : otherName}</span>
                            <span class="msg-time">${new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="msg-body">
                            ${isMe ? `<small style="color:#666">To: ${otherName}</small><br>` : ''}
                            ${msg.message}
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (err) {
        container.innerHTML = '<p>Error loading messages.</p>';
    }
}

function showTeacherMessageForm() {
    document.getElementById('teacherMessageForm').style.display = 'block';
    loadRecipients();
}

async function loadRecipients() {
    const select = document.getElementById('recipientSelect');
    select.innerHTML = '<option>Loading...</option>';

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await res.json();

        if (result.status === 'success') {
            // Filter recipients: Parents and Students
            const recipients = result.data.users.filter(u => {
                const r = (u.role || '').toLowerCase();
                return r === 'parent' || r === 'student';
            });
            
            if (recipients.length === 0) {
                select.innerHTML = '<option value="">No recipients available</option>';
            } else {
                select.innerHTML = recipients.map(u => 
                    `<option value="${u.id}">${u.fullName} (${u.role})</option>`
                ).join('');
            }
        }
    } catch (err) {
        select.innerHTML = '<option>Error loading users</option>';
    }
}

async function sendTeacherMessage() {
    const receiverId = document.getElementById('recipientSelect').value;
    const message = document.getElementById('teacherMsgBody').value;

    if (!receiverId || !message) return alert("Please fill all fields.");

    try {
        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ receiverId, message })
        });

        if (res.ok) {
            alert("Message sent!");
            document.getElementById('teacherMessageForm').style.display = 'none';
            document.getElementById('teacherMsgBody').value = '';
            loadTeacherMessages(); 
        } else {
            alert("Failed to send message.");
        }
    } catch (err) { console.error(err); }
}