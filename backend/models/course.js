const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Course Name is required"] 
  },
  code: { 
    type: String, 
    required: [true, "Course Code is required"],
    unique: true, // No two courses can have the same code (e.g. CS101)
    uppercase: true
  },
  creditHours: {
    type: Number,
    required: [true, "Credit Hours are required"],
    min: 1,
    max: 6
  },
  // This links to the User Table (Only Users with role 'teacher')
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
    required: [true, "Instructor is required"]
  },
  // We track which students registered here
  studentsEnrolled: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  studentsPending: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
}],

announcements: [{
    text: String,
    date: { type: Date, default: Date.now }
  }],
  lectures: [{
    title: String,
    link: String, // URL to the file or video
    date: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;