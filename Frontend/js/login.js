document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        const user = JSON.parse(localStorage.getItem('user'));
        redirectUser(user);
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
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            
            errorDiv.style.display = 'none';
            document.getElementById('loginForm').reset();

            redirectUser(result.data.user);
        } else {
            throw new Error(result.message || 'Login failed');
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
});

// Redirect users to their correct dashboard
function redirectUser(user) {
    if (user.role === 'admin') {
        window.location.href = 'admin.html';
    } else if (user.role === 'advisor') {
        window.location.href = 'advisor.html'; // ✅ Added Advisor Redirect
    } else if (user.role === 'teacher') {
        window.location.href = 'teacher.html';
    } else {
        window.location.href = 'student.html';
    }
}