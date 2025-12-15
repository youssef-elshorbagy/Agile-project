const session = requireAuth('teacher');
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('courseId');
const assId = urlParams.get('assId');

if (!courseId || !assId) {
    alert("Missing course or assignment ID.");
    window.location.href = 'teacher.html';
}

document.addEventListener('DOMContentLoaded', () => {
    if (session) {
        loadSubmissions();
        document.getElementById('gradeForm').addEventListener('submit', handleGradeSubmission);
    }
});

async function loadSubmissions() {
    const tbody = document.getElementById('submissionsTableBody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        // API Route: /courses/:courseId/assignments/:assId/submissions
        const response = await fetch(`${API_URL}/courses/${courseId}/assignments/${assId}/submissions`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const submissions = await response.json();

        if (!response.ok || submissions.status === 'fail') {
            tbody.innerHTML = `<tr><td colspan="5">Error loading submissions: ${submissions.message || 'Server error'}</td></tr>`;
            return;
        }

        if (submissions.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No submissions yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        submissions.data.forEach(sub => {
            const gradeText = sub.Grade !== null ? sub.Grade : 'N/A';
            const gradeClass = sub.Grade !== null ? 'graded' : 'ungraded';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sub.StudentName}</td>
                <td>${sub.universityId}</td>
                <td>${new Date(sub.SubmittedAt).toLocaleString()}</td>
                <td class="${gradeClass}"><strong>${gradeText}</strong></td>
                <td>
                    <button onclick="openGradingModal('${sub.id}', '${sub.StudentName}', '${sub.downloadLink}', '${sub.Grade || ''}', '${sub.Feedback || ''}')" class="approve-btn">
                        ${sub.Grade !== null ? 'Edit Grade' : 'Grade'}
                    </button>
                    <a href="${sub.downloadLink}" target="_blank" class="reject-btn" style="text-decoration:none;">Download</a>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error("Fetch error:", err);
        tbody.innerHTML = '<tr><td colspan="5">Connection error loading submissions.</td></tr>';
    }
}

// Opens the modal and populates the data
function openGradingModal(subId, studentName, downloadLink, currentGrade, currentFeedback) {
    document.getElementById('submissionIdInput').value = subId;
    document.getElementById('studentNameModal').textContent = studentName;
    document.getElementById('downloadLinkModal').href = downloadLink;
    document.getElementById('gradeInput').value = currentGrade;
    document.getElementById('feedbackInput').value = currentFeedback;
    
    document.getElementById('gradingModal').style.display = 'block';
}

// Handles form submission
async function handleGradeSubmission(e) {
    e.preventDefault();

    const subId = document.getElementById('submissionIdInput').value;
    const grade = document.getElementById('gradeInput').value;
    const feedback = document.getElementById('feedbackInput').value;

    try {
        // API Route: /courses/submissions/:subId/grade
        const response = await fetch(`${API_URL}/courses/submissions/${subId}/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}` 
            },
            body: JSON.stringify({ grade: grade, feedback: feedback })
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            document.getElementById('gradingModal').style.display = 'none';
            loadSubmissions(); // Refresh the table
        } else {
            alert(`Error saving grade: ${result.message}`);
        }

    } catch (err) {
        console.error("Grading error:", err);
        alert("Failed to connect to the server to save the grade.");
    }
}