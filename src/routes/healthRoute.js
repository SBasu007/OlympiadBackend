import { Router } from "express";
import { health, warmup } from "../controllers/healthController.js";

const router = Router();

router.get("/health", health);
router.get("/warmup", warmup);

export default router;
