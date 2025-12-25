const { sql } = require("../config/db");

// Get all messages for current user
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sql.query`
      SELECT 
        M.id, M.senderId, M.receiverId, M.message, M.createdAt,
        Sender.fullName as senderName, Sender.role as senderRole,
        Receiver.fullName as receiverName, Receiver.role as receiverRole
      FROM Messages M
      JOIN Users Sender ON M.senderId = Sender.id
      JOIN Users Receiver ON M.receiverId = Receiver.id
      WHERE M.senderId = ${userId} OR M.receiverId = ${userId}
      ORDER BY M.createdAt ASC
    `;

    res.status(200).json({
      status: "success",
      data: { messages: result.recordset }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Receiver ID and message are required" 
      });
    }

    // Verify receiver exists
    const receiverCheck = await sql.query`
      SELECT id, fullName, role FROM Users WHERE id = ${receiverId}
    `;

    if (receiverCheck.recordset.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Receiver not found" 
      });
    }

    // Insert message
    const result = await sql.query`
      INSERT INTO Messages (senderId, receiverId, message)
      OUTPUT INSERTED.*
      VALUES (${senderId}, ${receiverId}, ${message})
    `;

    const newMessage = result.recordset[0];

    // Add sender and receiver names
    newMessage.senderName = req.user.fullName;
    newMessage.receiverName = receiverCheck.recordset[0].fullName;

    res.status(201).json({
      status: "success",
      data: { message: newMessage }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Get conversation between two users
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.userId;

    const result = await sql.query`
      SELECT 
        M.id, M.senderId, M.receiverId, M.message, M.createdAt,
        Sender.fullName as senderName,
        Receiver.fullName as receiverName
      FROM Messages M
      JOIN Users Sender ON M.senderId = Sender.id
      JOIN Users Receiver ON M.receiverId = Receiver.id
      WHERE 
        (M.senderId = ${userId} AND M.receiverId = ${otherUserId})
        OR (M.senderId = ${otherUserId} AND M.receiverId = ${userId})
      ORDER BY M.createdAt ASC
    `;

    res.status(200).json({
      status: "success",
      data: { messages: result.recordset }
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Get messages for parents (parent-to-teacher communication)
const getParentMessages = async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ 
        status: "fail", 
        message: "Parents only" 
      });
    }

    const parentId = req.user.id;

    // Get messages where parent is sender or receiver
    const result = await sql.query`
      SELECT 
        M.id, M.senderId, M.receiverId, M.message, M.createdAt,
        Sender.fullName as senderName, Sender.role as senderRole,
        Receiver.fullName as receiverName, Receiver.role as receiverRole
      FROM Messages M
      JOIN Users Sender ON M.senderId = Sender.id
      JOIN Users Receiver ON M.receiverId = Receiver.id
      WHERE M.senderId = ${parentId} OR M.receiverId = ${parentId}
      ORDER BY M.createdAt DESC
    `;

    res.status(200).json({
      status: "success",
      data: { messages: result.recordset }
    });

  } catch (error) {
    console.error('Error fetching parent messages:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Send message from parent to teacher
const sendParentMessage = async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ 
        status: "fail", 
        message: "Parents only" 
      });
    }

    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Receiver ID and message are required" 
      });
    }

    // Verify receiver is a teacher
    const receiverCheck = await sql.query`
      SELECT id, fullName, role FROM Users WHERE id = ${receiverId}
    `;

    if (receiverCheck.recordset.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Receiver not found" 
      });
    }

    const receiver = receiverCheck.recordset[0];
    if (receiver.role !== 'teacher' && receiver.role !== 'admin') {
      return res.status(403).json({ 
        status: "fail", 
        message: "Parents can only message teachers or administrators" 
      });
    }

    // Insert message
    const result = await sql.query`
      INSERT INTO Messages (senderId, receiverId, message)
      OUTPUT INSERTED.*
      VALUES (${senderId}, ${receiverId}, ${message})
    `;

    const newMessage = result.recordset[0];

    // Add sender and receiver names
    newMessage.senderName = req.user.fullName;
    newMessage.receiverName = receiver.fullName;

    res.status(201).json({
      status: "success",
      data: { message: newMessage }
    });

  } catch (error) {
    console.error('Error sending parent message:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  getConversation,
  getParentMessages,
  sendParentMessage
};