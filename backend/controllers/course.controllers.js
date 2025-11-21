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
    const courses = await Course.find()
      .populate("instructor", "fullName")
      .populate("studentsEnrolled", "fullName email")
      .populate("studentsPending", "fullName email");
    
    res.status(200).json({ status: "success", results: courses.length, data: { courses } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const requestEnrollment = async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ status: "fail", message: "Course not found" });

        if (course.studentsEnrolled.includes(studentId)) {
            return res.status(400).json({ status: "fail", message: "You are already enrolled" });
        }
        if (course.studentsPending.includes(studentId)) {
            return res.status(400).json({ status: "fail", message: "Request already pending" });
        }

        course.studentsPending.push(studentId);
        await course.save();

        res.status(200).json({ status: "success", message: "Request sent successfully" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const manageEnrollment = async (req, res) => {
    try {
        const { courseId, studentId, action } = req.body; 
        
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ status: "fail", message: "Course not found" });

        course.studentsPending = course.studentsPending.filter(id => id.toString() !== studentId);

        if (action === 'approve') {
            if (!course.studentsEnrolled.includes(studentId)) {
                course.studentsEnrolled.push(studentId);
            }
        }

        await course.save();
        res.status(200).json({ status: "success", message: `Request ${action}d successfully` });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};


const getMyCourses = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.user.role; 

        let query = {};

        if (userRole === 'teacher') {
            query = { instructor: userId };
        } else {
            query = { studentsEnrolled: userId };
        }

        const courses = await Course.find(query)
            .populate("instructor", "fullName")
            .populate("studentsEnrolled", "fullName"); 

        res.status(200).json({ 
            status: "success", 
            results: courses.length, 
            data: { courses } 
        });

    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};


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

const addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body;
        const course = await Course.findById(req.params.id);
        
        course.announcements.unshift({ text });
        await course.save();

        res.status(200).json({ status: "success", message: "Announcement added" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addLecture = async (req, res) => {
    try {
        const { title } = req.body;
        const course = await Course.findById(req.params.id);
        
        if (!req.file) {
            return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        course.lectures.push({ 
            title, 
            link: fileUrl
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
