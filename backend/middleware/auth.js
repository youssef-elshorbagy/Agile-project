const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

// Middleware factory that returns a middleware function for a specific role
const auth = (requiredRole) => {
  return async (req, res, next) => {
    try {
      let token = req.headers.authorization;
      if (token && token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }
      
      if (!token) {
        return res.status(401).json({ 
          status: "fail", 
          message: "You are not logged in" 
        });
      }
      
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      const result = await sql.query`
        SELECT U.*, 
          CASE WHEN EXISTS(SELECT 1 FROM Advisors A WHERE A.userId = U.id) 
            THEN 1 ELSE 0 END AS isAdvisor 
        FROM Users U 
        WHERE id = ${decodedToken.id}
      `;
      
      const currentUser = result.recordset[0];
      
      if (!currentUser) {
        return res.status(401).json({ 
          status: "fail", 
          message: "User no longer exists" 
        });
      }
      
      // Normalize isAdvisor
      currentUser.isAdvisor = currentUser.isAdvisor === 1 || currentUser.isAdvisor === true;
      
      // Check role if required
      if (requiredRole && currentUser.role !== requiredRole) {
        return res.status(403).json({ 
          status: "fail", 
          message: `Access denied. ${requiredRole} role required.` 
        });
      }
      
      req.user = currentUser;
      req.userId = currentUser.id;
      next();
    } catch (error) {
      res.status(401).json({ 
        status: "fail", 
        message: "Invalid Token" 
      });
    }
  };
};

module.exports = auth;

