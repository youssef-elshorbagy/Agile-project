function requireAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');

    // 1. Check if logged in
    if (!token || !userString) {
        window.location.href = 'login.html';
        return null;
    }

    const user = JSON.parse(userString);

    // 2. Role Check
    // If the page requires a specific role (e.g. 'admin') and the user doesn't have it
    if (requiredRole && user.role !== requiredRole) {
        
        // Special Case: Maybe you want Admins to be able to see Teacher pages?
        // If not, strict matching is fine.
        
        alert("Access Denied: You are not authorized to view this page.");
        
        // Redirect them to their correct dashboard
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