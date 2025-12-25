document.addEventListener("DOMContentLoaded", () => {
    const session = requireAuth("parent");
    if (!session) return;

    attachNavHandlers();
    loadStudentProgress(); // default
});

/* =========================
   NAVIGATION
========================= */

function attachNavHandlers() {
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();

            document.querySelectorAll(".nav-link")
                .forEach(l => l.classList.remove("active"));

            link.classList.add("active");

            const view = link.dataset.view;

            if (view === "progress") loadStudentProgress();
            if (view === "messages") loadMessages();
            if (view === "announcements") loadAnnouncements();
            if (view === "logout") logout();
        });
    });
}

/* =========================
   STUDENT PROGRESS
========================= */

async function loadStudentProgress() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `<h2>Student Progress</h2><p>Loading...</p>`;

    try {
        const res = await fetch(`${API_URL}/parent/children`, {
            headers: authHeader()
        });

        if (!res.ok) {
            throw new Error('Failed to load children');
        }

        const result = await res.json();
        const children = result.data?.children || result.children || [];

        if (!children.length) {
            container.innerHTML = `
                <h2>Student Progress</h2>
                <div class="empty-state">
                    <p>No linked students found.</p>
                    <p class="text-muted">Please contact the administrator to link your account to your child's account.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="content-header">
                <h2>Student Progress</h2>
                <p class="subtitle">View your children's academic progress and course information</p>
            </div>
            <div class="children-grid">
        `;

        for (const child of children) {
            // Load courses for each child
            let coursesHtml = '<p class="text-muted">Loading courses...</p>';
            try {
                const coursesRes = await fetch(`${API_URL}/parent/children/${child.studentId}/courses`, {
                    headers: authHeader()
                });
                if (coursesRes.ok) {
                    const coursesResult = await coursesRes.json();
                    const courses = coursesResult.data?.courses || [];
                    if (courses.length > 0) {
                        coursesHtml = `
                            <div class="courses-list">
                                <h4>Enrolled Courses (${courses.length})</h4>
                                <ul>
                                    ${courses.map(c => `<li><strong>${c.code}</strong> - ${c.name}</li>`).join('')}
                                </ul>
                            </div>
                        `;
                    } else {
                        coursesHtml = '<p class="text-muted">No enrolled courses</p>';
                    }
                }
            } catch (err) {
                coursesHtml = '<p class="text-muted">Unable to load courses</p>';
            }

            html += `
                <div class="child-card">
                    <div class="child-header">
                        <h3>${child.name || 'Unknown'}</h3>
                        <span class="child-id">ID: ${child.universityId || child.studentId}</span>
                    </div>
                    <div class="child-info">
                        <div class="info-item">
                            <span class="label">GPA:</span>
                            <span class="value">${child.gpa !== null && child.gpa !== undefined ? child.gpa.toFixed(2) : 'N/A'}</span>
                        </div>
                        ${child.level ? `
                        <div class="info-item">
                            <span class="label">Level:</span>
                            <span class="value">${child.level}</span>
                        </div>
                        ` : ''}
                        ${child.email ? `
                        <div class="info-item">
                            <span class="label">Email:</span>
                            <span class="value">${child.email}</span>
                        </div>
                        ` : ''}
                    </div>
                    ${coursesHtml}
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (err) {
        console.error('Error loading student progress:', err);
        container.innerHTML = `
            <h2>Student Progress</h2>
            <div class="error-state">
                <p>Error loading student data: ${err.message}</p>
            </div>
        `;
    }
}

/* =========================
   MESSAGES
========================= */

async function loadMessages() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `<h2>Messages</h2><p>Loading...</p>`;

    try {
        const res = await fetch(`${API_URL}/messages/parent`, {
            headers: authHeader()
        });

        if (!res.ok) {
            throw new Error('Failed to load messages');
        }

        const result = await res.json();
        const messages = result.data?.messages || [];

        let html = `
            <div class="content-header">
                <h2>Messages</h2>
                <button class="btn btn-primary" onclick="showSendMessageForm()">Send Message to Teacher</button>
            </div>
            <div id="sendMessageForm" class="send-message-form" style="display: none;">
                <h3>Send Message</h3>
                <form id="messageForm" onsubmit="sendMessage(event)">
                    <div class="form-group">
                        <label for="teacherSelect">Select Teacher:</label>
                        <select id="teacherSelect" required>
                            <option value="">Loading teachers...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="messageText">Message:</label>
                        <textarea id="messageText" rows="5" required placeholder="Type your message here..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Send</button>
                        <button type="button" class="btn btn-secondary" onclick="hideSendMessageForm()">Cancel</button>
                    </div>
                </form>
            </div>
            <div class="messages-container">
        `;

        if (messages.length === 0) {
            html += `
                <div class="empty-state">
                    <p>No messages yet.</p>
                    <p class="text-muted">Click "Send Message to Teacher" to start a conversation.</p>
                </div>
            `;
        } else {
            messages.forEach(msg => {
                const isFromMe = msg.senderId === parseInt(localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).id : -1);
                html += `
                    <div class="message-card ${isFromMe ? 'message-sent' : 'message-received'}">
                        <div class="message-header">
                            <strong>${isFromMe ? 'You' : (msg.senderName || 'Unknown')}</strong>
                            <span class="message-role">${msg.senderRole || ''}</span>
                            <span class="message-time">${new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="message-body">
                            ${msg.message || msg.content || 'No content'}
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        container.innerHTML = html;

        // Load teachers for the dropdown
        loadTeachers();

    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = `
            <h2>Messages</h2>
            <div class="error-state">
                <p>Error loading messages: ${err.message}</p>
            </div>
        `;
    }
}

async function loadTeachers() {
    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: authHeader()
        });
        if (res.ok) {
            const result = await res.json();
            const teachers = (result.data?.users || []).filter(u => u.role === 'teacher');
            const select = document.getElementById('teacherSelect');
            if (select) {
                select.innerHTML = '<option value="">Select a teacher...</option>';
                teachers.forEach(teacher => {
                    select.innerHTML += `<option value="${teacher.id}">${teacher.fullName} (${teacher.email})</option>`;
                });
            }
        }
    } catch (err) {
        console.error('Error loading teachers:', err);
        const select = document.getElementById('teacherSelect');
        if (select) {
            select.innerHTML = '<option value="">Error loading teachers</option>';
        }
    }
}

function showSendMessageForm() {
    const form = document.getElementById('sendMessageForm');
    if (form) {
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function hideSendMessageForm() {
    const form = document.getElementById('sendMessageForm');
    if (form) {
        form.style.display = 'none';
    }
}

async function sendMessage(event) {
    event.preventDefault();
    const receiverId = document.getElementById('teacherSelect').value;
    const message = document.getElementById('messageText').value;

    if (!receiverId || !message) {
        alert('Please select a teacher and enter a message');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/messages/parent`, {
            method: 'POST',
            headers: authHeader(),
            body: JSON.stringify({ receiverId: parseInt(receiverId), message })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to send message');
        }

        alert('Message sent successfully!');
        document.getElementById('messageForm').reset();
        hideSendMessageForm();
        loadMessages(); // Reload messages
    } catch (err) {
        alert('Error sending message: ' + err.message);
    }
}

/* =========================
   ANNOUNCEMENTS
========================= */

async function loadAnnouncements() {
    const container = document.querySelector(".main-content");
    container.innerHTML = `<h2>Announcements</h2><p>Loading...</p>`;

    try {
        const res = await fetch(`${API_URL}/announcements`, {
            headers: authHeader()
        });

        if (!res.ok) {
            throw new Error('Failed to load announcements');
        }

        const result = await res.json();
        const announcements = result.data?.announcements || [];

        let html = `
            <div class="content-header">
                <h2>Announcements</h2>
                <p class="subtitle">Important updates and announcements from teachers</p>
            </div>
            <div class="announcements-container">
        `;

        if (announcements.length === 0) {
            html += `
                <div class="empty-state">
                    <p>No announcements at this time.</p>
                </div>
            `;
        } else {
            announcements.forEach(a => {
                html += `
                    <div class="announcement-card">
                        <div class="announcement-header">
                            <h4>${a.content || a.title || 'Announcement'}</h4>
                            ${a.courseName ? `<span class="course-badge">${a.courseCode || ''} - ${a.courseName}</span>` : ''}
                            ${a.isGlobal ? `<span class="global-badge">Global</span>` : ''}
                        </div>
                        <div class="announcement-body">
                            <p>${a.content || 'No content'}</p>
                        </div>
                        <div class="announcement-footer">
                            <span class="announcement-teacher">${a.teacherName || 'Teacher'}</span>
                            <span class="announcement-date">${new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (err) {
        console.error('Error loading announcements:', err);
        container.innerHTML = `
            <h2>Announcements</h2>
            <div class="error-state">
                <p>Error loading announcements: ${err.message}</p>
            </div>
        `;
    }
}

/* =========================
   HELPERS
========================= */

function authHeader() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token) {
        window.location.href = 'login.html';
        return {};
    }
    
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}
