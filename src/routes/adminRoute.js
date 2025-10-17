import express from "express";
import multer from "multer";
import { authRequired } from "../middleware/adminAuth.js";
import { createCategory,createSubCategory,createSubject,createExam,
        getCategory, getSubCategory,getSubject,getExam,
        uploadQuestions, getQuestions, updateQuestion,
        updateSubCategory, deleteSubCategory,
        updateSubject, deleteSubject,
        updateExam, deleteExam
} from "../controllers/adminController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // saves temp files locally

// Category Routes
router.post("/category", upload.single("file"), createCategory);
router.get("/category", getCategory);      // Fetch all categories
router.get("/category/:id", getCategory);  // Fetch a specific category by ID


// Subcategory Routes
router.post("/subcategory",upload.single("file"), createSubCategory);
router.get("/subcategory", getSubCategory);     
router.get("/subcategory/:id", getSubCategory);
router.put("/subcategory/:id", upload.single("file"), updateSubCategory);
router.delete("/subcategory/:id", deleteSubCategory);


// Subject Routes
router.post("/subject", upload.none(), createSubject);
router.get("/subject", getSubject);        // Fetch all subjects
router.get("/subject/:id", getSubject);    // Fetch single subject by ID
router.put("/subject/:id", upload.none(), updateSubject);
router.delete("/subject/:id", deleteSubject);

// Exam Routes
router.post("/exam", upload.single("file"),createExam);
router.get("/exam", getExam);              // Fetch all exams
router.get("/exam/:id", getExam);          // Fetch single exam by ID
router.put("/exam/:id", upload.single("file"), updateExam);
router.delete("/exam/:id", deleteExam);

//Question Upload
router.post("/upload-questions", upload.single("file"), uploadQuestions);
//Questions list/update
router.get("/questions", getQuestions);
router.get("/questions/:id", getQuestions);
router.put("/questions/:id", upload.single("file"), updateQuestion);

export default router;