import express from "express";
import multer from "multer";
import { authRequired } from "../middleware/adminAuth.js";
import { enrollInExam, checkEnrollment, getEnrolledExams, getExamQuestions, submitExam, getExamResult, requestReExam, getPreviousExamResult, getPreviousExamAttempts, generateCertificate
} from "../controllers/studentController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // saves temp files locally

//Exam enrollment route
router.post("/enroll", upload.single("file"), enrollInExam);

// Test endpoint for sendBeacon
router.post("/test-beacon", (req, res) => {
  console.log('[🧪 TEST BEACON RECEIVED]', {
    timestamp: new Date().toISOString(),
    body: req.body,
    contentType: req.headers['content-type']
  });
  res.status(200).json({ success: true, message: 'Test beacon received' });
});

//Check enrollment status route
router.get("/enrollment/:exam_id/:user_id", checkEnrollment);

//Get all enrolled exams for a user
router.get("/enrolled-exams/:user_id", getEnrolledExams);

//Get exam questions
router.get("/exam/:exam_id/questions", getExamQuestions);

//Submit exam
router.post("/exam/submit", submitExam);

//Get exam result
router.get("/exam/result/:result_id", getExamResult);

//Request re-exam
router.post("/re-exam/request", requestReExam);

//Get previous exam result (for resume mode)
router.get("/exam/:exam_id/result/:user_id", getPreviousExamResult);

//Get previous exam attempts (for resume mode)
router.get("/exam/:exam_id/attempts/:user_id", getPreviousExamAttempts);

//Generate certificate PDF
router.get("/certificate/:user_id/:exam_id", generateCertificate);

export default router;