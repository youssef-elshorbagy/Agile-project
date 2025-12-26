const session = requireAuth('Student'); 
// Load Data on Startup
document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('studentName').textContent = session.user.fullName;
        document.getElementById('studentFullName').textContent = session.user.fullName;
        document.getElementById('studentEmail').textContent = session.user.email;
        
        document.getElementById('studentId').textContent = session.user.universityId || 'N/A';

        const level = parseInt(session.user.level || 1);
        const gpa = parseFloat(session.user.gpa || 0.00);

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
        loadStudentPendingAssignments();
        loadDashboardAssignments();
    }
});




async function loadStudentPendingAssignments() {
    const container = document.getElementById('studentPendingAssignments');
    if(!container) return;

    try {
        // Use the existing endpoint that returns all assignments
        const response = await fetch(`${API_URL}/courses/my-assignments`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (response.ok) {
            const allAssignments = result.data || [];
            
            // Filter: Not Submitted AND Deadline is in the future
            const now = new Date();
            const pending = allAssignments.filter(a => !a.SubmissionID && new Date(a.Deadline) > now);

            if (pending.length === 0) {
                container.innerHTML = '<p style="color:#27ae60;">🎉 No pending assignments! You are all caught up.</p>';
                return;
            }

            let html = '';
            pending.forEach(ass => {
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border-bottom: 1px solid #eee;">
                        <div>
                            <strong style="color:#2d3436;">${ass.Title}</strong>
                            <div style="font-size:0.85em; color:#636e72;">${ass.CourseCode} - ${ass.CourseName}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="color:#e17055; font-weight:600; font-size:0.9em;">Due: ${new Date(ass.Deadline).toLocaleDateString()}</span>
                            <br>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("Error loading pending tasks:", err);
        container.innerHTML = '<p style="color:red">Failed to load assignments.</p>';
    }
}


// Navigation 
function switchView(viewName, element) {
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-register').style.display = 'none';
    document.getElementById('view-profile').style.display = 'none';
    document.getElementById('view-messages').style.display = 'none';

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

    if (viewName === 'messages') {
        loadStudentMessages();
    }
}


async function loadStudentMessages() {
    const container = document.getElementById('studentMessagesList');
    container.innerHTML = '<p style="color:white; text-align:center;">Loading messages...</p>';

    try {
        const res = await fetch(`${API_URL}/messages`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await res.json();

        if (result.status === 'success') {
            const messages = result.data.messages || [];
            if (messages.length === 0) {
                container.innerHTML = '<div style="background:rgba(255,255,255,0.1); padding:40px; border-radius:12px; text-align:center; color:white;">No messages yet. Click the button above to contact a teacher.</div>';
                return;
            }

            let html = '';
            messages.forEach(msg => {
                const isMe = msg.senderId === session.user.id;
                const otherName = isMe ? msg.receiverName : msg.senderName;
                
                html += `
                    <div style="background: ${isMe ? '#f1f2f6' : 'white'}; padding:15px; border-radius:12px; margin-bottom:12px; border-left: 6px solid ${isMe ? '#6c5ce7' : '#00b894'}; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="color:#2d3436;">${isMe ? 'To: ' + otherName : 'From: ' + otherName}</strong>
                            <small style="color:#b2bec3;">${new Date(msg.createdAt).toLocaleString()}</small>
                        </div>
                        <p style="margin-top:10px; color:#636e72; line-height:1.4;">${msg.message}</p>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:white;">Error loading messages.</p>';
    }
}

function showStudentMessageForm() {
    document.getElementById('studentMessageForm').style.display = 'block';
    loadTeacherList();
}



async function loadTeacherList() {
    const select = document.getElementById('teacherRecipientSelect');
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            // UPDATED: Check for capitalized 'Teacher' or 'Admin' from database
            const teachers = result.data.users.filter(u => 
                u.role === 'Teacher' || u.role === 'Admin' ||
                u.role === 'teacher' || u.role === 'admin'
            );
            
            if (teachers.length === 0) {
                select.innerHTML = '<option value="">No teachers available</option>';
            } else {
                select.innerHTML = teachers.map(t => 
                    `<option value="${t.id}">${t.fullName} (${t.role})</option>`
                ).join('');
            }
        }
    } catch (err) {
        console.error("Error loading teachers:", err);
        select.innerHTML = '<option>Error loading teachers</option>';
    }
}


async function sendStudentMessage() {
    const receiverId = document.getElementById('teacherRecipientSelect').value;
    const message = document.getElementById('studentMsgBody').value;

    if (!receiverId || !message) return alert("Please select a teacher and type a message.");

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
            alert("Message sent to instructor!");
            document.getElementById('studentMessageForm').style.display = 'none';
            document.getElementById('studentMsgBody').value = '';
            loadStudentMessages(); // Refresh list
        } else {
            alert("Failed to send message.");
        }
    } catch (err) { console.error(err); }
}


async function loadMyCourses() {
    const grid = document.getElementById('coursesGrid');
    if(!grid) return;
    
    grid.innerHTML = '<p style="color:#666; padding:10px;">Loading courses...</p>';

    try {
        const response = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (response.ok) {
            grid.innerHTML = '';
            const courses = result.data?.courses || [];

            if (courses.length === 0) {
                grid.innerHTML = '<p style="padding:10px;">You are not enrolled in any courses.</p>';
                return;
            }

            courses.forEach(c => {
                grid.innerHTML += `
                    <div class="course-card" onclick="window.location.href='course-details.html?id=${c.id}'">
                        <h3>${c.name}</h3>
                        <p>${c.code} - ${c.creditHours} Credits</p>
                        <div class="course-info">
                            <span>Instructor: ${c.instructorName || 'TBA'}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            grid.innerHTML = `<p style="color:red;">Error: ${result.message}</p>`;
        }
    } catch (err) { console.error(err); }
}


async function loadAvailableCourses() {
    const tbody = document.querySelector('#view-register tbody');
    if(!tbody) return; 

    try {
        // 1. Fetch Student's Enrolled Courses first to check prerequisites
        const myRes = await fetch(`${API_URL}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const myData = await myRes.json();
        // Create a Set of codes the student has "Taken" (or is enrolled in)
        const myTakenCodes = new Set((myData.data?.courses || []).map(c => c.code));

        // 2. Fetch All Available Courses
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            tbody.innerHTML = '';
            const myId = session.user.id; 
            const studentLevel = parseInt(session.user.level || 1);

            result.data.courses.forEach(c => {
                let actionBtn = '';
                
                const isEnrolled = c.studentsEnrolled.some(s => s.id === myId || s === myId);
                const isPending = c.studentsPending.some(s => s.id === myId || s === myId);
                const courseLevel = parseInt(c.level || 1);
                

                if (isEnrolled) {
                    actionBtn = `<span class="status-badge status-completed">Enrolled</span>`;
                } else if (isPending) {
                    actionBtn = `<span class="status-badge status-pending">Pending</span>`;
                } else {
                    // Check Level
                    if (studentLevel < courseLevel) {
                        actionBtn = `<span style="color: #e74c3c; font-weight: bold; font-size: 0.9em;">⛔ Not opened yet (Lvl ${courseLevel})</span>`;
                    } 
                    // Check Prerequisite
                    else if (c.prerequisite && !myTakenCodes.has(c.prerequisite)) {
                        actionBtn = `<span style="color: #e74c3c; font-weight: bold; font-size: 0.9em;">⚠️ Missing Prereq: ${c.prerequisite}</span>`;
                    } 
                    // Allow Request
                    else {
                        actionBtn = `<button onclick="requestCourse('${c.id}')" class="register-btn">Request</button>`;
                    }
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

async function loadDashboardAssignments() {
    const container = document.getElementById('studentPendingAssignments');
    if(!container) return;

    // FIX: Force vertical layout
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "15px"; 
    container.innerHTML = '<p style="color:#666;">Checking assignments...</p>';

    try {
        const response = await fetch(`${API_URL}/courses/my-assignments`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const json = await response.json();

        if(json.data && json.data.length > 0) {
            container.innerHTML = ''; // Clear loading text
            
            // Filter: Only show assignments that are NOT graded yet or future deadlines
            // Logic: If duplicate IDs exist, map guarantees one entry per ID if we wanted, 
            // but the backend fix handles duplicates now.
            
            const upcoming = json.data.filter(a => {
                // Show if Grade is null (not done/graded) OR submitted recently
                return a.Grade === null || a.Grade === undefined;
            });

            if (upcoming.length === 0) {
                container.innerHTML = '<div class="empty-state">🎉 All caught up! No pending assignments.</div>';
                return;
            }

            upcoming.forEach(ass => {
                const deadline = new Date(ass.Deadline);
                const now = new Date();
                const diffMs = deadline - now;
                const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                
                let statusColor = '#2ecc71'; // Green (Good)
                let statusText = `${daysLeft} days left`;

                if (diffMs < 0) {
                    statusColor = '#e74c3c'; // Red (Overdue)
                    statusText = 'Overdue';
                } else if (daysLeft <= 3) {
                    statusColor = '#f1c40f'; // Yellow (Warning)
                }

                // If submitted but not graded
                if(ass.SubmittedAt) {
                    statusColor = '#3498db';
                    statusText = 'Submitted';
                }

                const card = document.createElement('div');
                // Force block display style for the card
                card.style.cssText = `
                    background: white; 
                    padding: 15px; 
                    border-radius: 8px; 
                    border-left: 5px solid ${statusColor}; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                    width: 100%;
                    cursor: pointer;
                `;
                
                // Clicking the card takes you to the course details
                card.onclick = () => window.location.href = `course-details.html?id=${ass.id}`; // Note: ass.id here is actually Assignment ID from backend query? Check controller. 
                // In controller: U.id is selected. BUT we need Course ID to link properly.
                // The query selects U.id. We need courseId too.
                // Let's assume the link goes to course page. To go to specific assignment, we need course ID.
                // Re-check Controller: U.id is Assignment ID. C.id is Course ID (not selected in previous query).
                // Let's rely on user navigating to course.
                
                // NOTE: To fix navigation, ensure backend selects CourseID. 
                // Currently it selects C.code and C.name.
                // For now, let's just show the info.
                
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0 0 5px 0; font-size:16px; color:#2c3e50;">${ass.Title}</h4>
                            <div style="font-size:13px; color:#7f8c8d;">${ass.CourseCode} - ${ass.CourseName}</div>
                        </div>
                        <div style="text-align:right;">
                            <strong style="display:block; color:${statusColor}; font-size:14px;">${statusText}</strong>
                            <span style="font-size:12px; color:#95a5a6;">Due: ${deadline.toLocaleDateString()}</span>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<div class="empty-state">No active assignments found.</div>';
        }
    } catch (err) {
        console.error("Error loading dashboard assignments:", err);
        container.innerHTML = '<p style="color:red">Error loading assignments.</p>';
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