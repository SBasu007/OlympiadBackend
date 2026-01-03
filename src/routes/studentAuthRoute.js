import express from "express";
import { registerUser, loginStudent, getStudentProfile } from "../controllers/studentAuthController.js";
import { studentAuthRequired } from "../middleware/studentAuth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginStudent);
router.get("/me", studentAuthRequired, getStudentProfile);

export default router;