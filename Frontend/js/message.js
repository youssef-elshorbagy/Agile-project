// Ensure API_URL is defined (from config.js)
if (typeof API_URL === 'undefined') {
    console.error("API_URL is not defined. Ensure config.js is loaded.");
}

const session = requireAuth(); // Ensure user is logged in

function send() {
  const receiverId = document.getElementById('receiver').value;
  const messageContent = document.getElementById('msg').value;

  if (!receiverId || !messageContent) return alert("Please fill in all fields");

  fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem('token')
    },
    body: JSON.stringify({
      receiverId: receiverId,
      message: messageContent
    })
  })
  .then(res => res.json())
  .then(data => {
      if(data.status === 'success') {
          alert("Message sent successfully");
          document.getElementById('msg').value = ''; // Clear input
      } else {
          alert("Error: " + data.message);
      }
  })
  .catch(err => {
      console.error(err);
      alert("Network Error");
  });
}