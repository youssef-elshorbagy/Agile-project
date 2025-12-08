const multer = require("multer");
const path = require("path");

// Configure where to store files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // UPDATED: consistently finds the folder at the project root
    // __dirname = current folder (middleware)
    // ../uploads = go up one level, then into uploads
    cb(null, path.join(__dirname, "../uploads")); 
  },
  filename: function (req, file, cb) {
    // Save as: lecture-TIMESTAMP.pdf
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, "lecture-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter to only allow PDFs 
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;