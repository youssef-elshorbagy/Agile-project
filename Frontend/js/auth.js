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
        // allow teachers who are also advisors (isAdvisor flag) to access teacher pages
        if (requiredRole === 'teacher') {
            if (!(user.role === 'teacher' || user.isAdvisor === true)) {
                alert("Access Denied: You are not authorized to view this page.");
                if(user.role === 'admin') window.location.href = 'admin.html';
                else if(user.role === 'teacher') window.location.href = 'teacher.html';
                else window.location.href = 'student.html';
                return null;
            }
        } else {
            if (user.role !== requiredRole) {
                alert("Access Denied: You are not authorized to view this page.");
                if(user.role === 'admin') window.location.href = 'admin.html';
                else if(user.role === 'teacher') window.location.href = 'teacher.html';
                else if(user.role === 'parent') window.location.href = 'parent.html';
                else if(user.role === 'ta') window.location.href = 'ta.html';
                else window.location.href = 'student.html';
                return null;
            }
        }
    }

    return { token, user };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}