import express from "express";
import { registerUser, loginStudent, getStudentProfile, logoutStudent } from "../controllers/studentAuthController.js";
import { studentAuthRequired } from "../middleware/studentAuth.js";
import { sanitizeRegisterInput, sanitizeLoginInput, checkValidationErrors } from "../utils/sanitize.js";

const router = express.Router();

router.post("/register", sanitizeRegisterInput, checkValidationErrors, registerUser);
router.post("/login", sanitizeLoginInput, checkValidationErrors, loginStudent);
router.post("/logout", studentAuthRequired, logoutStudent);
router.get("/me", studentAuthRequired, getStudentProfile);

export default router;