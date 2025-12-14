const { sql } = require('../config/db');

const listAdvisors = async (req, res) => {
    try {
        const result = await sql.query`
            SELECT A.userId as id, U.fullName, U.email, A.capacity,
                   (SELECT COUNT(*) FROM StudentAdvisors SA WHERE SA.advisorId = A.userId) as assignedCount
            FROM Advisors A
            JOIN Users U ON U.id = A.userId
        `;
        res.status(200).json({ status: 'success', results: result.recordset.length, data: { advisors: result.recordset } });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

const assignAdvisorToStudent = async (req, res) => {
    try {
        const advisorId = req.params.advisorId;
        const { studentId } = req.body;

        // Ensure both exist
        const stuRes = await sql.query`SELECT id FROM Users WHERE id = ${studentId} AND role = 'student'`;
        if (stuRes.recordset.length === 0) return res.status(404).json({ status: 'fail', message: 'Student not found' });

        const advRes = await sql.query`SELECT userId, capacity FROM Advisors WHERE userId = ${advisorId}`;
        if (advRes.recordset.length === 0) return res.status(404).json({ status: 'fail', message: 'Advisor not found' });

        // Check capacity
        const assignedCountRes = await sql.query`SELECT COUNT(*) as cnt FROM StudentAdvisors WHERE advisorId = ${advisorId}`;
        const cnt = assignedCountRes.recordset[0].cnt || 0;
        const capacity = advRes.recordset[0].capacity || 0;
        if (cnt >= capacity) return res.status(400).json({ status: 'fail', message: 'Advisor capacity reached' });

        // Check if student already has advisor
        const existing = await sql.query`SELECT * FROM StudentAdvisors WHERE studentId = ${studentId}`;
        if (existing.recordset.length > 0) return res.status(400).json({ status: 'fail', message: 'Student already assigned an advisor' });

        await sql.query`INSERT INTO StudentAdvisors (studentId, advisorId) VALUES (${studentId}, ${advisorId})`;
        res.status(201).json({ status: 'success', message: 'Advisor assigned to student' });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

const unassignAdvisorFromStudent = async (req, res) => {
    try {
        const studentId = req.params.studentId;
        await sql.query`DELETE FROM StudentAdvisors WHERE studentId = ${studentId}`;
        res.status(200).json({ status: 'success', message: 'Advisor unassigned from student' });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

module.exports = { listAdvisors, assignAdvisorToStudent, unassignAdvisorFromStudent };
