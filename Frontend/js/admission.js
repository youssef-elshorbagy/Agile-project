document.getElementById('admissionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageBox = document.getElementById('messageBox');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // 1. Get Values
    const fullName = document.getElementById('fullName').value;
    const nationalId = document.getElementById('nationalId').value;
    const birthFile = document.getElementById('birthCertificate').files[0];
    const highSchoolFile = document.getElementById('highSchoolCertificate').files[0];

    // 2. Prepare Form Data (Required for file uploads)
    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('nationalId', nationalId);
    formData.append('birthCertificate', birthFile);
    formData.append('highSchoolCertificate', highSchoolFile);

    try {
        // Disable button to prevent double clicks
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading...";
        messageBox.style.display = 'none';

        // 3. Send Request
        const response = await fetch(`${API_URL}/admissions/apply`, {
            method: 'POST',
            // Note: Do NOT set 'Content-Type': 'application/json' here.
            // The browser sets the correct Multipart boundary automatically for FormData.
            body: formData 
        });

        const result = await response.json();

        if (response.ok) {
            // Success: Show green message
            messageBox.style.color = 'green';
            messageBox.style.backgroundColor = '#e8f5e9';
            messageBox.style.border = '1px solid #c8e6c9';
            messageBox.textContent = "Application submitted successfully! Please wait for admin approval.";
            messageBox.style.display = 'block';
            
            // Clear form
            document.getElementById('admissionForm').reset();
        } else {
            throw new Error(result.message || 'Submission failed');
        }

    } catch (err) {
        // Error: Show red message
        messageBox.style.color = '#721c24';
        messageBox.style.backgroundColor = '#f8d7da';
        messageBox.style.border = '1px solid #f5c6cb';
        messageBox.textContent = err.message;
        messageBox.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
    }
});