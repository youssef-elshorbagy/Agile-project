// Checks if you belong there. If not, redirects you to the correct dashboard.

function requireAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');

    if (!token || !userString) {
        window.location.href = 'login.html';
        return null;
    }

    const user = JSON.parse(userString);

    if (requiredRole && user.role !== requiredRole) {
                
        alert("Access Denied: You are not authorized to view this page.");
        
        if(user.role === 'admin') window.location.href = 'admin.html';
        else if(user.role === 'teacher') window.location.href = 'teacher.html';
        else window.location.href = 'student.html';
        
        return null;
    }

    return { token, user };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}