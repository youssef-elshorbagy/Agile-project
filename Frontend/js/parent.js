document.addEventListener("DOMContentLoaded", () => {
    // 1. Auth Check (Case Insensitive)
    const session = requireAuth("Parent"); 
    if (!session) return;

    // 2. Setup Navigation
    attachNavHandlers();
    
    // 3. Load Default View
    loadStudentProgress(); 
});

/* =========================
   NAVIGATION HANDLER
========================= */
function attachNavHandlers() {
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            
            // Toggle Active Class
            document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
            link.classList.add("active");
            
            // Route View
            const view = link.dataset.view;
            if (view === "progress") loadStudentProgress();
            else if (view === "messages") loadMessages();
            else if (view === "announcements") loadAnnouncements();
            else if (view === "logout") logout();
        });
    });
}

/* =========================
   VIEW: STUDENT PROGRESS
========================= */
async function loadStudentProgress() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `
        <div class="content-header">
            <h2>Student Progress</h2>
        </div>
        <div class="loading">Loading your children...</div>`;

    try {
        const token = localStorage.getItem('token');

        // A. Get List of Children
        const res = await fetch(`${API_URL}/parent/children`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.message || 'Failed to load children');

        const children = result.data?.children || [];

        if (children.length === 0) {
            container.innerHTML = `
                <div class="content-header"><h2>Student Progress</h2></div>
                <div class="empty-state">
                    <h3>No Students Linked</h3>
                    <p>Contact the administration to link your account to your children.</p>
                </div>`;
            return;
        }

        // B. Build UI for Each Child
        let html = `<div class="children-grid">`;

        for (const child of children) {
            const gpa = child.gpa ? parseFloat(child.gpa).toFixed(2) : '0.00';
            const level = child.level || 1;

            // Fetch specific course progress for this child
            let coursesHtml = '<div class="loading-small">Loading courses...</div>';
            
            try {
                const progRes = await fetch(`${API_URL}/parent/children/${child.studentId}/progress`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const progData = await progRes.json();
                
                if (progData.status === 'success' && progData.data.courses.length > 0) {
                    coursesHtml = '<div class="courses-list">';
                    progData.data.courses.forEach(c => {
                        const stats = c.statistics || { totalAssignments: 0, submittedAssignments: 0, averageScore: 0 };
                        const avgScore = Math.round(stats.averageScore || 0);
                        const color = avgScore >= 75 ? '#27ae60' : (avgScore >= 50 ? '#f39c12' : '#e74c3c');

                        coursesHtml += `
                            <div class="course-grade-item" style="padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                                <div>
                                    <div style="font-weight:600; color:#2c3e50;">${c.code} - ${c.name}</div>
                                    <div style="font-size:0.85em; color:#7f8c8d;">${stats.submittedAssignments}/${stats.totalAssignments} Assignments</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-weight:bold; color:${color};">${avgScore}%</div>
                                    <div style="font-size:0.7em; color:#aaa;">AVG</div>
                                </div>
                            </div>
                        `;
                    });
                    coursesHtml += '</div>';
                } else {
                    coursesHtml = '<p style="color:#999; font-size:0.9em; padding:10px;">No enrolled courses.</p>';
                }
            } catch (e) {
                console.error(e);
                coursesHtml = '<p style="color:red; font-size:0.9em;">Error loading courses</p>';
            }

            html += `
                <div class="child-card" style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div>
                            <h3 style="margin:0; color:#2c3e50;">${child.name}</h3>
                            <span style="font-size:0.9em; color:#7f8c8d;">ID: ${child.universityId}</span>
                        </div>
                        <div style="text-align:right;">
                            <span class="badge" style="background:#e0f7fa; color:#006064; padding:4px 8px; border-radius:4px; font-size:0.8em;">Level ${level}</span>
                        </div>
                    </div>

                    <div style="display:flex; gap:15px; margin-bottom:15px; background:#f8f9fa; padding:10px; border-radius:6px;">
                        <div>
                            <div style="font-size:0.8em; color:#666;">GPA</div>
                            <div style="font-weight:bold; color:#2d3436;">${gpa}</div>
                        </div>
                    </div>

                    <h4 style="font-size:1em; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">Course Performance</h4>
                    ${coursesHtml}
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = `
            <div class="content-header"><h2>Student Progress</h2></div>
            ${html}
        `;

    } catch (err) {
        console.error("Error:", err);
        container.innerHTML = `<div class="error-state">Error loading data: ${err.message}</div>`;
    }
}

/* =========================
   VIEW: MESSAGES
========================= */
async function loadMessages() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `<div class="loading">Loading messages...</div>`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/messages/parent`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        // Setup HTML Structure
        let html = `
            <div class="content-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2>Messages</h2>
                <button onclick="toggleMessageForm()" style="background:#6c5ce7; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">+ New Message</button>
            </div>

            <div id="msgForm" style="display:none; background:white; padding:20px; border-radius:8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                <h3>Send Message</h3>
                <div class="form-group">
                    <label>Recipient (Teacher/Admin):</label>
                    <select id="teacherSelect" class="mini-input" style="width:100%; margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:4px;">
                        <option>Loading recipients...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Message:</label>
                    <textarea id="msgBody" class="mini-input" style="width:100%; margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:4px;" rows="4"></textarea>
                </div>
                <button onclick="sendMessage()" style="background:#00b894; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; margin-right:10px;">Send</button>
                <button onclick="toggleMessageForm()" style="background:#b2bec3; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">Cancel</button>
            </div>

            <div class="messages-list">
        `;

        const messages = result.data?.messages || [];
        
        if (messages.length === 0) {
            html += `<div class="empty-state">No messages found.</div>`;
        } else {
            // Retrieve current user ID to correctly check "Me" vs "Them"
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : { id: 0 };

            messages.forEach(msg => {
                const isMe = msg.senderId === currentUser.id;
                const otherName = isMe ? msg.receiverName : msg.senderName;
                
                html += `
                    <div style="background:white; border-left: 5px solid ${isMe ? '#a29bfe' : '#00b894'}; padding:15px; margin-bottom:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong>${isMe ? 'Me' : otherName} <span style="font-weight:normal; color:#888; font-size:0.9em;">to ${isMe ? otherName : 'Me'}</span></strong>
                            <small style="color:#aaa;">${new Date(msg.createdAt).toLocaleDateString()}</small>
                        </div>
                        <div style="color:#333;">${msg.message}</div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;

        // Load recipients list for the form
        loadRecipients();

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="error">Error loading messages</p>`;
    }
}

function toggleMessageForm() {
    const form = document.getElementById('msgForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function loadRecipients() {
    // Fetch list of teachers/admins to message
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        
        const select = document.getElementById('teacherSelect');
        if (!select) return;

        if (res.ok) {
            // Filter: Parents can message Teachers and Admins (Case Insensitive)
            const recipients = result.data.users.filter(u => {
                const r = (u.role || '').toLowerCase();
                return r === 'teacher' || r === 'admin';
            });
            
            if (recipients.length > 0) {
                select.innerHTML = recipients.map(r => 
                    `<option value="${r.id}">${r.fullName} (${r.role})</option>`
                ).join('');
            } else {
                select.innerHTML = '<option value="">No teachers found</option>';
            }
        }
    } catch(err) { console.error("Error loading recipients", err); }
}

async function sendMessage() {
    const receiverId = document.getElementById('teacherSelect').value;
    const message = document.getElementById('msgBody').value;

    if (!receiverId || !message) return alert("Please fill all fields");

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/messages/parent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ receiverId, message })
        });

        if (res.ok) {
            alert("Message sent!");
            toggleMessageForm();
            loadMessages(); // Refresh
        } else {
            const data = await res.json();
            alert(data.message || "Failed to send");
        }
    } catch (err) { alert("Network error"); }
}

/* =========================
   VIEW: ANNOUNCEMENTS
========================= */
async function loadAnnouncements() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `<div class="loading">Loading announcements...</div>`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/announcements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        const announcements = result.data?.announcements || [];

        let html = `<div class="content-header"><h2>Announcements</h2></div><div class="announcements-list">`;

        if (announcements.length === 0) {
            html += `<div class="empty-state">No announcements.</div>`;
        } else {
            announcements.forEach(a => {
                html += `
                    <div style="background:white; padding:20px; margin-bottom:15px; border-radius:10px; border-left:4px solid #6c5ce7; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                        <h4 style="margin-top:0; color:#2c3e50;">${a.content}</h4>
                        <div style="display:flex; justify-content:space-between; margin-top:10px; color:#7f8c8d; font-size:0.9em;">
                            <span>By: ${a.teacherName || 'Admin'}</span>
                            <span>${new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                        ${a.courseCode ? `<div style="margin-top:5px;"><span class="badge" style="background:#dfe6e9; color:#636e72;">${a.courseCode}</span></div>` : ''}
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<p class="error">Error loading announcements</p>`;
    }
}