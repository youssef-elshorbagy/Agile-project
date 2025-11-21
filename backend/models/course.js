const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Course Name is required"] 
  },
  code: { 
    type: String, 
    required: [true, "Course Code is required"],
    unique: true, 
    uppercase: true
  },
  creditHours: {
    type: Number,
    required: [true, "Credit Hours are required"],
    min: 1,
    max: 6
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
    required: [true, "Instructor is required"]
  },
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
    link: String, 
    date: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;