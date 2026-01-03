import express from "express";
import multer from "multer";
import { authRequired } from "../middleware/adminAuth.js";
import { enrollInExam, checkEnrollment, getEnrolledExams
} from "../controllers/studentController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // saves temp files locally

//Exam enrollment route
router.post("/enroll", upload.single("file"), enrollInExam);

//Check enrollment status route
router.get("/enrollment/:exam_id/:user_id", checkEnrollment);

//Get all enrolled exams for a user
router.get("/enrolled-exams/:user_id", getEnrolledExams);

export default router;