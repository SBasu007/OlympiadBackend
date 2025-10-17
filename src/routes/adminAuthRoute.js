import express from "express";
import { register, login, me, listAdmins } from "../controllers/adminAuthController.js";
import { authRequired } from "../middleware/adminAuth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authRequired, me);
router.get("/all", listAdmins);

export default router;
