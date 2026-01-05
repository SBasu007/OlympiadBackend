import express from "express";
import multer from "multer";
import { authRequired } from "../middleware/adminAuth.js";
import { enrollInExam, checkEnrollment, getEnrolledExams, getExamQuestions, submitExam, getExamResult
} from "../controllers/studentController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // saves temp files locally

//Exam enrollment route
router.post("/enroll", upload.single("file"), enrollInExam);

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

export default router;