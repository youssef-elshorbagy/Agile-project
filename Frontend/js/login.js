document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        const userString = localStorage.getItem('user');
        if (userString) {
            const user = JSON.parse(userString);
            redirectUser(user);
        }
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');

    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (response.ok) {
            const userData = result.data.user;
            
            if (userData.gpa !== undefined) userData.gpa = parseFloat(userData.gpa || 0);
            if (userData.level !== undefined) userData.level = parseInt(userData.level || 1);

            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(userData));
            
            errorDiv.style.display = 'none';
            document.getElementById('loginForm').reset();

            redirectUser(userData);
        } else {
            throw new Error(result.message || 'Login failed');
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
});


function redirectUser(user) {
    if (!user || !user.role) return;

    // Check for advisor status reconstructed by EAV pivot logic
    const isAdvisor = user.isAdvisor === true || user.role === 'Advisor';

    if (user.role === 'Admin') {
        window.location.href = 'admin.html';
    } else if (isAdvisor || user.role === 'Teacher') {
        window.location.href = 'teacher.html';
    } else if (user.role === 'Parent') {
        window.location.href = 'parent.html';
    } else if (user.role === 'Student') {
        window.location.href = 'student.html';
    } else {
        // Fallback for TA or unexpected roles
        window.location.href = 'student.html';
    }
}