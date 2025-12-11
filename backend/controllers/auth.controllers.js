const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

const signup = async (req, res) => {
  try {
    const { universityId, fullName, email, password, role } = req.body;

    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    
    // Normalize role input (Student, Teacher, Admin)
    const roleName = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    
    const checkQuery = `SELECT * FROM People WHERE email = '${email}' OR universityId = '${universityId}'`;
    const checkResult = await sql.query(checkQuery);
    
    if (checkResult.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "User or ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
        const request = new sql.Request(transaction);

        // A. Insert Person (Using fullName directly)
        const personResult = await request.query(`
            INSERT INTO People (universityId, fullName, email, password)
            OUTPUT INSERTED.person_id
            VALUES ('${universityId}', '${fullName}', '${email}', '${hashedPassword}')
        `);
        const newPersonId = personResult.recordset[0].person_id;

        // B. Get Role ID
        const roleResult = await request.query(`SELECT role_id FROM Roles WHERE role_name = '${roleName}'`);
        if (roleResult.recordset.length === 0) throw new Error("Invalid Role Configuration in DB");
        const roleId = roleResult.recordset[0].role_id;

        // C. Assign Role
        await request.query(`
            INSERT INTO PersonRoles (person_id, role_id)
            VALUES (${newPersonId}, ${roleId})
        `);

        // D. If Student, Assign Attributes
        if (roleName === 'Student') {
            const attrRes = await request.query(`SELECT id, attributeName FROM PersonAttributes WHERE attributeName IN ('GPA', 'Level')`);
            const gpaId = attrRes.recordset.find(a => a.attributeName === 'GPA')?.id;
            const levelId = attrRes.recordset.find(a => a.attributeName === 'Level')?.id;

            if (gpaId && levelId) {
                await request.query(`
                    INSERT INTO PersonAttributeValues (person_id, attribute_id, value) VALUES 
                    (${newPersonId}, ${gpaId}, '0.0'),
                    (${newPersonId}, ${levelId}, '1')
                `);
            }
        }

        await transaction.commit();

        const token = jwt.sign(
            { id: newPersonId, name: fullName, role: role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
        );

        const userDTO = {
            id: newPersonId,
            universityId,
            fullName,
            email,
            role,
            gpa: role === 'student' ? 0.0 : null,
            level: role === 'student' ? 1 : null
        };

        res.status(201).json({ status: "success", token, data: { user: userDTO } });

    } catch (err) {
        await transaction.rollback();
        throw err;
    }

  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) return res.status(400).json({ status: "fail", message: "Email or Password is missing" });

    const query = `
        SELECT P.*, R.role_name 
        FROM People P
        JOIN PersonRoles PR ON P.person_id = PR.person_id
        JOIN Roles R ON PR.role_id = R.role_id
        WHERE P.email = '${email}'
    `;
    const result = await sql.query(query);
    const user = result.recordset[0];

    if (!user) return res.status(404).json({ status: "fail", message: "User not found" });

    const matchedPassword = await bcrypt.compare(password, user.password);
    if (!matchedPassword) return res.status(404).json({ status: "fail", message: "Wrong password" });
  
    const role = user.role_name.toLowerCase();

    const token = jwt.sign(
      { id: user.person_id, name: user.fullName, role: role }, 
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );
  
    const userResponse = {
        id: user.person_id,
        universityId: user.universityId,
        fullName: user.fullName,
        email: user.email,
        role: role
    };

    return res.status(200).json({
      status: "success",
      token: token,
      data: { user: userResponse },
    });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const protectRoutes = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer")) {
      token = token.split(" ")[1];
    }
    if (!token) return res.status(401).json({ status: "fail", message: "You are not logged in" });
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const result = await sql.query(`
        SELECT P.*, R.role_name 
        FROM People P
        LEFT JOIN PersonRoles PR ON P.person_id = PR.person_id
        LEFT JOIN Roles R ON PR.role_id = R.role_id
        WHERE P.person_id = ${decodedToken.id}
    `);
    
    const currentUser = result.recordset[0];

    if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
    
    req.user = {
        id: currentUser.person_id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role_name ? currentUser.role_name.toLowerCase() : 'student'
    };
    req.userId = currentUser.person_id; 
    next();
  } catch (error) {
    res.status(401).json({ status: "fail", message: "Invalid Token" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 5;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            P.person_id as id, 
            P.universityId, 
            P.fullName, 
            P.email, 
            LOWER(R.role_name) as role,
            (SELECT value FROM PersonAttributeValues PAV 
             JOIN PersonAttributes PA ON PAV.attribute_id = PA.id 
             WHERE PAV.person_id = P.person_id AND PA.attributeName = 'GPA') as gpa,
            (SELECT value FROM PersonAttributeValues PAV 
             JOIN PersonAttributes PA ON PAV.attribute_id = PA.id 
             WHERE PAV.person_id = P.person_id AND PA.attributeName = 'Level') as level
        FROM People P
        JOIN PersonRoles PR ON P.person_id = PR.person_id
        JOIN Roles R ON PR.role_id = R.role_id
        ORDER BY P.person_id 
        OFFSET ${offset} ROWS 
        FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);
    
    res.status(200).json({ status: "success", length: result.recordset.length, data: { users: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    res.status(200).json({ status: "success", data: { user: req.user } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName } = req.body;
    const userId = req.user.id;
    
    await sql.query(`
        UPDATE People 
        SET fullName = '${fullName}'
        WHERE person_id = ${userId}
    `);

    const result = await sql.query(`
        SELECT P.person_id as id, P.fullName, P.email, LOWER(R.role_name) as role 
        FROM People P
        JOIN PersonRoles PR ON P.person_id = PR.person_id
        JOIN Roles R ON PR.role_id = R.role_id 
        WHERE P.person_id = ${userId}
    `);
    
    res.status(200).json({ status: "success", data: { user: result.recordset[0] } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

module.exports = { 
  signup, 
  getAllUsers, 
  login, 
  protectRoutes, 
  getProfile,
  updateProfile 
};