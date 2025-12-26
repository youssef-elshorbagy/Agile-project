const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

const auth = (requiredRole) => {
  return async (req, res, next) => {
    try {
      let token = req.headers.authorization;
      if (token && token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }
      
      if (!token) {
        return res.status(401).json({ status: "fail", message: "You are not logged in" });
      }
      
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      // FIX: Use TOP 1 to handle users with multiple roles gracefully in the auth object
      const result = await sql.query`
        SELECT TOP 1 
            P.*, R.role_name as role,
            CASE WHEN EXISTS(
                SELECT 1 FROM PersonRoles PR2 
                JOIN Roles R2 ON PR2.role_id = R2.role_id 
                WHERE PR2.person_id = P.id AND R2.role_name = 'Advisor'
            ) THEN 1 ELSE 0 END AS isAdvisor
        FROM People P 
        LEFT JOIN PersonRoles PR ON P.id = PR.person_id
        LEFT JOIN Roles R ON PR.role_id = R.role_id
        WHERE P.id = ${decodedToken.id}
      `;
      
      const currentUser = result.recordset[0];
      if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
      
      currentUser.isAdvisor = currentUser.isAdvisor === 1;
      
      // FIX: Case-Insensitive Role Check to prevent "Access Denied"
      if (requiredRole) {
        const userRole = (currentUser.role || '').toLowerCase();
        const reqRole = requiredRole.toLowerCase();

        // Allow access if roles match OR if it's a special case (Teacher accessing Advisor stuff)
        const isAuthorized = 
            userRole === reqRole || 
            (reqRole === 'teacher' && currentUser.isAdvisor) ||
            (reqRole === 'advisor' && userRole === 'teacher'); // Advisors are Teachers

        if (!isAuthorized) {
            return res.status(403).json({ 
                status: "fail", 
                message: `Access denied. ${requiredRole} role required.` 
            });
        }
      }
      
      req.user = currentUser;
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ status: "fail", message: "Invalid Token" });
    }
  };
};

module.exports = auth;