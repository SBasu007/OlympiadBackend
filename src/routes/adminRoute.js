import express from "express";
import multer from "multer";
import { authRequired } from "../middleware/adminAuth.js";
import { createCategory,createSubCategory,createSubject,createExam,
        getCategory, getSubCategory,getSubject,getExam,
        uploadQuestions, uploadQuestionsBatch, getQuestions, updateQuestion, deleteQuestionsByExam, getExamsWithQuestions,
        updateSubCategory, deleteSubCategory,
        updateSubject, deleteSubject,
        updateExam, deleteExam,
        getPendingEnrollments, updateEnrollmentStatus, getExamAccess, getRequest, updateRequestStatus, getFilteredMeritList,
        getDashboardData
} from "../controllers/adminController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // saves temp files locally

// 🚀 AGGREGATED ENDPOINT - Single call replaces 5 API calls
router.get("/dashboard-data", getDashboardData);

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
//Batch Question Upload (NEW - sends all questions in one request)
router.post("/upload-questions-batch", upload.fields([
  // We'll dynamically accept file_0, file_1, file_2, etc.
  // Multer's fields with maxCount allows multiple files with different names
  ...Array.from({ length: 100 }, (_, i) => ({ name: `file_${i}`, maxCount: 1 }))
]), uploadQuestionsBatch);
//Questions list/update/delete
router.get("/questions", getQuestions);
router.get("/questions/:id", getQuestions);
router.put("/questions/:id", upload.single("file"), updateQuestion);
router.delete("/questions/exam/:exam_id", deleteQuestionsByExam);
// Get exams with questions (optimized)
router.get("/exams-with-questions", getExamsWithQuestions);

// Enrollment management routes
router.get("/enrollments/pending", getPendingEnrollments);
router.put("/enrollments/:enrol_id/status", updateEnrollmentStatus);

// Exam access routes
router.get("/exam-access/:user_id", getExamAccess);

// Request Re-Exam routes
router.get("/request", getRequest);
router.put("/request/:re_attempt_id/approve", updateRequestStatus);
router.put("/request/:re_attempt_id/decline", updateRequestStatus);

// Get filtered merit list
router.get("/merit-list", getFilteredMeritList);

export default router;