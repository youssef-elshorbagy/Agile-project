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