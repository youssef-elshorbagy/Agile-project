document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect based on role
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
            // Save Data
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            
            errorDiv.style.display = 'none';
            document.getElementById('loginForm').reset();

            // Redirect Function
            redirectUser(result.data.user);
        } else {
            throw new Error(result.message || 'Login failed');
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
});

// Helper function to handle the 3 different destinations
function redirectUser(user) {
    if (user.role === 'admin') {
        window.location.href = 'admin.html';
    } else if (user.role === 'teacher') {
        window.location.href = 'teacher.html'; // NEW DESTINATION
    } else {
        window.location.href = 'student.html';
    }
}