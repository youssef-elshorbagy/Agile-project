// Checks if you belong there. If not, redirects you to the correct dashboard.

function requireAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');

    if (!token || !userString) {
        window.location.href = 'login.html';
        return null;
    }

    const user = JSON.parse(userString);

    if (requiredRole) {
        const reqRole = requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1);

        if (reqRole === 'Teacher') {
            // Allow Teachers who are also advisors to access teacher pages
            if (!(user.role === 'Teacher' || user.isAdvisor === true || user.role === 'Advisor')) {
                alert("Access Denied: You are not authorized to view this page.");
                redirectByRole(user);
                return null;
            }
        } else {
            // Strict comparison for other roles (Admin, Parent, Student)
            if (user.role !== reqRole) {
                alert("Access Denied: You are not authorized to view this page.");
                redirectByRole(user);
                return null;
            }
        }
    }

    return { token, user };
}

function redirectByRole(user) {
    if (user.role === 'Admin') window.location.href = 'admin.html';
    else if (user.role === 'Teacher' || user.isAdvisor === true) window.location.href = 'teacher.html';
    else if (user.role === 'Parent') window.location.href = 'parent.html';
    else if (user.role === 'TA') window.location.href = 'ta.html';
    else window.location.href = 'student.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}