const { sql } = require("../config/db");

exports.submitAdmission = async (req, res) => {
    try {
        const { fullName, nationalId } = req.body;
        const files = req.files;

        if (!fullName || !nationalId) {
            return res.status(400).json({ status: "fail", message: "Full Name and National ID are required." });
        }
        if (!files || !files.birthCertificate || !files.highSchoolCertificate) {
            return res.status(400).json({ status: "fail", message: "Both certificates are required." });
        }

        const checkNatId = await sql.query`
            SELECT P.id FROM People P
            JOIN PersonAttributeValues PAV ON P.id = PAV.person_id
            JOIN PersonAttributes PA ON PAV.attr_id = PA.attr_id
            WHERE PA.attributeName = 'NationalID' AND PAV.attr_value = ${nationalId}
        `;
        
        if (checkNatId.recordset.length > 0) {
            return res.status(400).json({ status: "fail", message: "Application already exists for this National ID." });
        }


        const tempEmail = `${nationalId}@admission.temp`;
        
        const newPerson = await sql.query`
            INSERT INTO People (universityId, fullName, email, password)
            OUTPUT INSERTED.id
            VALUES (${nationalId}, ${fullName}, ${tempEmail}, 'pending_approval')
        `;
        const personId = newPerson.recordset[0].id;

        await sql.query`
            INSERT INTO PersonRoles (person_id, role_id)
            SELECT ${personId}, role_id FROM Roles WHERE role_name = 'NewComer'
        `;

        await sql.query`
            INSERT INTO PersonAttributeValues (person_id, attr_id, attr_value)
            SELECT ${personId}, attr_id, ${nationalId}
            FROM PersonAttributes WHERE attributeName = 'NationalID'
        `;

        const saveFile = async (fileObj, typeTitle) => {
            if (fileObj) {
                const file = fileObj[0];
                await sql.query`
                    INSERT INTO Uploads (uploaderId, uploadType, title, fileName, filePath)
                    VALUES (${personId}, 'admission_doc', ${typeTitle}, ${file.filename}, ${file.path})
                `;
            }
        };

        // Save Files
        await saveFile(files.birthCertificate, 'Birth Certificate');
        await saveFile(files.highSchoolCertificate, 'High School Certificate');

        res.status(201).json({ 
            status: "success", 
            message: "Admission application submitted successfully." 
        });

    } catch (error) {
        console.error("Admission Error:", error);
        if (error.number === 2627) {
            return res.status(400).json({ status: "fail", message: "This National ID or Email is already in the system." });
        }
        res.status(500).json({ status: "fail", message: error.message });
    }
};
exports.getPendingAdmissions = async (req, res) => {
    try {
        // 1. Get all NewComers
        const result = await sql.query`
            SELECT P.id, P.fullName, P.email, P.createdAt,
                   MAX(CASE WHEN PA.attributeName = 'NationalID' THEN PAV.attr_value END) as nationalId
            FROM People P
            LEFT JOIN PersonRoles PR ON P.id = PR.person_id
            LEFT JOIN Roles R ON PR.role_id = R.role_id
            LEFT JOIN PersonAttributeValues PAV ON P.id = PAV.person_id
            LEFT JOIN PersonAttributes PA ON PAV.attr_id = PA.attr_id
            WHERE R.role_name = 'NewComer'
            GROUP BY P.id, P.fullName, P.email, P.createdAt
        `;
        
        let applicants = result.recordset;

        // 2. Attach their uploaded files
        for (let app of applicants) {
            const files = await sql.query`
                SELECT fileName, title FROM Uploads 
                WHERE uploaderId = ${app.id} AND uploadType = 'admission_doc'
            `;
            app.files = files.recordset; // Array of { fileName, title }
        }

        res.status(200).json({ status: "success", data: { applicants } });
    } catch (error) {
        res.status(500).json({ status: "fail", message: error.message });
    }
};

exports.decideAdmission = async (req, res) => {
    const { userId, action } = req.body; 
    
    try {
        if (action === 'reject') {
            
            await sql.query`DELETE FROM People WHERE id = ${userId}`;
            return res.status(200).json({ status: "success", message: "Application rejected and data removed." });
        } 
        
        if (action === 'accept') {
            // 1. Generate a University ID (Simple logic: Year + 'P' + Random/Seq)
            const year = new Date().getFullYear().toString().substr(-2);
            const randomCode = Math.floor(1000 + Math.random() * 9000); 
            const newUniId = `${year}P${randomCode}`;

            // 2. Update UniversityID and Email
            const newEmail = `${newUniId}@eng.asu.edu.eg`;

            await sql.query`
                UPDATE People 
                SET universityId = ${newUniId}, email = ${newEmail}
                WHERE id = ${userId}
            `;

            const studentRoleRes = await sql.query`SELECT role_id FROM Roles WHERE role_name = 'Student'`;
            const newComerRoleRes = await sql.query`SELECT role_id FROM Roles WHERE role_name = 'NewComer'`;
            
            if(studentRoleRes.recordset.length && newComerRoleRes.recordset.length) {
                const sId = studentRoleRes.recordset[0].role_id;
                const ncId = newComerRoleRes.recordset[0].role_id;

                await sql.query`
                    UPDATE PersonRoles SET role_id = ${sId} 
                    WHERE person_id = ${userId} AND role_id = ${ncId}
                `;
            }

            return res.status(200).json({ status: "success", message: `Student Accepted! New ID: ${newUniId}` });
        }

    } catch (error) {
        res.status(500).json({ status: "fail", message: error.message });
    }
};