const session = requireAuth('teacher');
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('courseId'); // Not strictly used for fetching but good for context
const assId = urlParams.get('assId');

if (!assId) {
    alert("No assignment specified.");
    window.location.href = 'teacher.html';
}

document.addEventListener('DOMContentLoaded', () => {
    if (session) {
        // Set Assignment Title in Header if element exists
        const titleEl = document.getElementById('assignmentTitle');
        if(titleEl) titleEl.textContent = `Assignment #${assId}`; 
        
        loadSubmissions();
        document.getElementById('gradeForm').addEventListener('submit', handleGradeSubmission);
    }
});

async function loadSubmissions() {
    const tbody = document.getElementById('submissionsTableBody');
    tbody.innerHTML = '<tr><td colspan="5">Loading submissions...</td></tr>';

    try {
        // Correct Backend Route: /courses/:courseId/assignments/:assId/submissions
        const response = await fetch(`${API_URL}/courses/${courseId || 0}/assignments/${assId}/submissions`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const result = await response.json();

        if (!response.ok || result.status === 'fail') {
            tbody.innerHTML = `<tr><td colspan="5">Error: ${result.message || 'Server error'}</td></tr>`;
            return;
        }

        const data = result.data || [];

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No students have submitted this assignment yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(sub => {
            // FIX: Match SQL aliases (SubmissionID, fullName, Grade)
            const submissionId = sub.SubmissionID || sub.id; 
            const studentName = sub.fullName || sub.StudentName || "Unknown"; 
            const gradeVal = sub.Grade !== null ? sub.Grade : 'N/A';
            const gradeClass = sub.Grade !== null ? 'status-completed' : 'status-pending'; // using CSS classes from style.css

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${studentName}</strong></td>
                <td>${sub.universityId || '-'}</td>
                <td>${new Date(sub.SubmittedAt).toLocaleString()}</td>
                <td><span class="status-badge ${gradeClass}">${gradeVal}</span></td>
                <td>
                    <button onclick="openGradingModal('${submissionId}', '${studentName}', '${sub.downloadLink}', '${sub.Grade || ''}', '${sub.Feedback || ''}')" class="approve-btn">
                        ${sub.Grade !== null ? 'Edit Grade' : 'Grade'}
                    </button>
                    <a href="${sub.downloadLink}" target="_blank" class="reject-btn" style="text-decoration:none; background:#95a5a6;">View PDF</a>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error("Fetch error:", err);
        tbody.innerHTML = '<tr><td colspan="5">Connection error. Please try again.</td></tr>';
    }
}

// Modal Logic
function openGradingModal(subId, studentName, downloadLink, currentGrade, currentFeedback) {
    document.getElementById('submissionIdInput').value = subId;
    document.getElementById('studentNameModal').textContent = studentName;
    
    const linkEl = document.getElementById('downloadLinkModal');
    linkEl.href = downloadLink;
    linkEl.textContent = "Download Student PDF";

    document.getElementById('gradeInput').value = currentGrade === 'null' ? '' : currentGrade;
    document.getElementById('feedbackInput').value = currentFeedback === 'null' ? '' : currentFeedback;
    
    document.getElementById('gradingModal').style.display = 'block';
}

// Submit Grade
async function handleGradeSubmission(e) {
    e.preventDefault();

    const subId = document.getElementById('submissionIdInput').value;
    const grade = document.getElementById('gradeInput').value;
    const feedback = document.getElementById('feedbackInput').value;

    if(grade < 0 || grade > 100) return alert("Grade must be between 0 and 100");

    try {
        const response = await fetch(`${API_URL}/courses/submissions/${subId}/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ grade, feedback })
        });

        const result = await response.json();

        if (response.ok) {
            alert("Grade saved successfully!");
            document.getElementById('gradingModal').style.display = 'none';
            loadSubmissions(); // Refresh list to show new grade
        } else {
            alert(`Error: ${result.message}`);
        }

    } catch (err) {
        console.error("Grading error:", err);
        alert("Network error.");
    }
}