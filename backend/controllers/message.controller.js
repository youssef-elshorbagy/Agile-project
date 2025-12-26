const { sql } = require("../config/db");

// Get all messages for current user
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    // FIX: Simplified query to avoid duplicates
    const result = await sql.query`
      SELECT 
        M.id, M.message, M.createdAt,
        S.fullName as senderName, R.fullName as receiverName,
        M.senderId, M.receiverId
      FROM Messages M
      JOIN People S ON M.senderId = S.id
      JOIN People R ON M.receiverId = R.id
      WHERE M.senderId = ${userId} OR M.receiverId = ${userId}
      ORDER BY M.createdAt DESC
    `;
    res.status(200).json({ status: "success", data: { messages: result.recordset } });
  } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message) return res.status(400).json({ status: "fail", message: "Required fields missing" });

    const receiverCheck = await sql.query`SELECT id FROM People WHERE id = ${receiverId}`;
    if (receiverCheck.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Receiver not found" });

    const result = await sql.query`
      INSERT INTO Messages (senderId, receiverId, message)
      OUTPUT INSERTED.*
      VALUES (${senderId}, ${receiverId}, ${message})
    `;
    res.status(201).json({ status: "success", data: { message: result.recordset[0] } });
  } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

// Get Parent Messages (FIXED DUPLICATES)
const getParentMessages = async (req, res) => {
  try {
    // Role check handled by Middleware now, but safe double check
    if ((req.user.role || '').toLowerCase() !== 'parent') {
      return res.status(403).json({ status: "fail", message: "Parents only" });
    }

    const parentId = req.user.id;

    // FIX: Removed JOIN Roles to stop duplicates
    const result = await sql.query`
      SELECT 
        M.id, M.senderId, M.receiverId, M.message, M.createdAt,
        S.fullName as senderName, 
        R.fullName as receiverName
      FROM Messages M
      JOIN People S ON M.senderId = S.id
      JOIN People R ON M.receiverId = R.id
      WHERE M.senderId = ${parentId} OR M.receiverId = ${parentId}
      ORDER BY M.createdAt DESC
    `;

    res.status(200).json({ status: "success", data: { messages: result.recordset } });
  } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

// Send Parent Message
const sendParentMessage = async (req, res) => {
  try {
    if ((req.user.role || '').toLowerCase() !== 'parent') {
      return res.status(403).json({ status: "fail", message: "Parents only" });
    }

    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message) return res.status(400).json({ status: "fail", message: "Missing fields" });

    // Verify receiver exists
    const receiverCheck = await sql.query`
      SELECT P.id, P.fullName, R.role_name 
      FROM People P 
      JOIN PersonRoles PR ON P.id = PR.person_id
      JOIN Roles R ON PR.role_id = R.role_id
      WHERE P.id = ${receiverId}
    `;

    if (receiverCheck.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Receiver not found" });

    // Role validation (Case Insensitive)
    const validRoles = receiverCheck.recordset.map(r => (r.role_name || '').toLowerCase());
    if (!validRoles.includes('teacher') && !validRoles.includes('admin')) {
       return res.status(403).json({ status: "fail", message: "Can only message Teachers or Admins" });
    }

    const result = await sql.query`
      INSERT INTO Messages (senderId, receiverId, message)
      OUTPUT INSERTED.*
      VALUES (${senderId}, ${receiverId}, ${message})
    `;

    // Construct response object
    const newMessage = result.recordset[0];
    newMessage.senderName = req.user.fullName;
    newMessage.receiverName = receiverCheck.recordset[0].fullName;

    res.status(201).json({ status: "success", data: { message: newMessage } });

  } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

// Get conversation
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.userId;

    const result = await sql.query`
      SELECT M.*, S.fullName as senderName, R.fullName as receiverName
      FROM Messages M
      JOIN People S ON M.senderId = S.id
      JOIN People R ON M.receiverId = R.id
      WHERE (M.senderId = ${userId} AND M.receiverId = ${otherUserId})
         OR (M.senderId = ${otherUserId} AND M.receiverId = ${userId})
      ORDER BY M.createdAt ASC
    `;
    res.status(200).json({ status: "success", data: { messages: result.recordset } });
  } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

module.exports = { getMessages, sendMessage, getConversation, getParentMessages, sendParentMessage };