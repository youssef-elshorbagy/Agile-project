const Course = require("../models/course");

const createCourse = async (req, res) => {
  try {
    const { name, code, creditHours, instructor } = req.body;
    const existingCourse = await Course.findOne({ code });
    if (existingCourse) return res.status(400).json({ status: "fail", message: "Course Code already exists" });

    const newCourse = await Course.create({ name, code, creditHours, instructor });
    res.status(201).json({ status: "success", data: { course: newCourse } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getAllCourses = async (req, res) => {
  try {
    // Populate Instructor AND both student lists so we can show names in Frontend
    const courses = await Course.find()
      .populate("instructor", "fullName")
      .populate("studentsEnrolled", "fullName email")
      .populate("studentsPending", "fullName email");
    
    res.status(200).json({ status: "success", results: courses.length, data: { courses } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

// 1. Student: Make a Request
const requestEnrollment = async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ status: "fail", message: "Course not found" });

        // Check if already enrolled OR already pending
        if (course.studentsEnrolled.includes(studentId)) {
            return res.status(400).json({ status: "fail", message: "You are already enrolled" });
        }
        if (course.studentsPending.includes(studentId)) {
            return res.status(400).json({ status: "fail", message: "Request already pending" });
        }

        // Add to Pending List
        course.studentsPending.push(studentId);
        await course.save();

        res.status(200).json({ status: "success", message: "Request sent successfully" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

// 2. Admin: Approve/Decline Logic
const manageEnrollment = async (req, res) => {
    try {
        const { courseId, studentId, action } = req.body; // action = "approve" or "decline"
        
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ status: "fail", message: "Course not found" });

        // Remove from pending list regardless of action
        course.studentsPending = course.studentsPending.filter(id => id.toString() !== studentId);

        if (action === 'approve') {
            // Add to enrolled if not already there
            if (!course.studentsEnrolled.includes(studentId)) {
                course.studentsEnrolled.push(studentId);
            }
        }
        // If 'decline', we just removed them from pending, so we are done.

        await course.save();
        res.status(200).json({ status: "success", message: `Request ${action}d successfully` });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

// ... existing imports

// NEW FUNCTION: Get courses specific to the logged-in user
const getMyCourses = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.user.role; // This comes from the protectRoutes middleware

        let query = {};

        if (userRole === 'teacher') {
            // If Teacher: Find courses where I am the instructor
            query = { instructor: userId };
        } else {
            // If Student: Find courses where I am in the enrolled list
            query = { studentsEnrolled: userId };
        }

        const courses = await Course.find(query)
            .populate("instructor", "fullName")
            .populate("studentsEnrolled", "fullName"); // Useful for teachers to see count

        res.status(200).json({ 
            status: "success", 
            results: courses.length, 
            data: { courses } 
        });

    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

// ... existing imports (Course, User)

// 1. Get Single Course Details
const getCourseDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate("instructor", "fullName");
        if(!course) return res.status(404).json({ status: "fail", message: "Course not found" });
        
        res.status(200).json({ status: "success", data: { course } });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

// 2. Add Announcement (Teacher Only)
const addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body;
        const course = await Course.findById(req.params.id);
        
        // Add to beginning of array (newest first)
        course.announcements.unshift({ text });
        await course.save();

        res.status(200).json({ status: "success", message: "Announcement added" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

// 3. Add Lecture (Teacher Only)
const addLecture = async (req, res) => {
    try {
        const { title } = req.body;
        const course = await Course.findById(req.params.id);
        
        if (!req.file) {
            return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });
        }

        // Create the URL (e.g., http://localhost:3000/uploads/lecture-123.pdf)
        // We store the relative path
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        course.lectures.push({ 
            title, 
            link: fileUrl // We save the generated URL here
        });
        
        await course.save();

        res.status(200).json({ status: "success", message: "Lecture uploaded" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

module.exports = { 
    createCourse, getAllCourses, requestEnrollment, manageEnrollment, getMyCourses,
    getCourseDetails, addAnnouncement, addLecture
};
