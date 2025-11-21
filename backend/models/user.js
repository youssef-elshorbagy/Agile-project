const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema({
  universityId: { 
    type: String, 
    required: [true, "University ID is required"], 
    unique: true 
  },
  fullName: { type: String, required: [true, "User Name is Required"] },
  email: {
    type: String,
    required: [true, "Email is Required"],
    unique: true,
    validate: {
      validator: function(v) {
        return v.endsWith("@eng.asu.edu.eg");
      },
      message: "Email must be an official address (@eng.asu.edu.eg)"
    }
  },
  password: {
    type: String,
    required: [true, "Password is Required"],
  },
  role: {
    type: String,
    enum: ["teacher", "student", "admin"],
    required: true
  },
  gpa: { type: Number }, 
  level: { type: Number }
});

const User = mongoose.model("User", userSchema);
module.exports = User;