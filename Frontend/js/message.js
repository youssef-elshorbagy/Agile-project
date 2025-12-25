function send() {
  fetch(`${API}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken()
    },
    body: JSON.stringify({
      receiverId: receiver.value,
      message: msg.value
    })
  }).then(() => alert("Message sent"));
}
