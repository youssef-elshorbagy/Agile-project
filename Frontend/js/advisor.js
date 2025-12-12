// Security Check
const session = requireAuth('advisor');

document.addEventListener('DOMContentLoaded', () => {
    if(session) {
        document.getElementById('advisorName').textContent = session.user.fullName;
        
        // Logout Logic
        document.getElementById("logoutBtn").addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "login.html";
        });

        loadRequests();
    }
});

async function loadRequests() {
    const requestsBody = document.getElementById('requestsTableBody');

    try {
        // We fetch courses because the backend attaches 'studentsPending' inside the course object
        const response = await fetch(`${API_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if(response.ok) {
            requestsBody.innerHTML = '';
            let hasRequests = false;

            result.data.courses.forEach(c => {
                if (c.studentsPending && c.studentsPending.length > 0) {
                    hasRequests = true;
                    c.studentsPending.forEach(student => {
                        requestsBody.innerHTML += `
                            <tr>
                                <td><strong>${c.code}</strong> - ${c.name}</td>
                                <td>${student.fullName} <br> <small>${student.email}</small></td>
                                <td>
                                    <button onclick="handleRequest('${c.id}', '${student.id}', 'approve')" 
                                            style="background:#2ed573; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">
                                            Approve
                                    </button>
                                    <button onclick="handleRequest('${c.id}', '${student.id}', 'decline')" 
                                            style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                                            Decline
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                }
            });
            
            if(!hasRequests) {
                requestsBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No pending requests</td></tr>';
            }
        }
    } catch (err) { console.error(err); }
}

async function handleRequest(courseId, studentId, action) {
    if(!confirm(`Are you sure you want to ${action} this request?`)) return;

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
            alert(result.message);
            loadRequests(); // Refresh list
        } else {
            alert(result.message);
        }
    } catch(err) { console.error(err); }
}