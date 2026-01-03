import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import adminRoute from "./routes/adminRoute.js";
import studentRoute from "./routes/studentRoute.js";
import authRoute from "./routes/adminAuthRoute.js";
import studentAuthRoute from "./routes/studentAuthRoute.js";
import healthRoute from "./routes/healthRoute.js";
import {job,dbjob} from "./config/cron.js";
// import rateLimiter from "./middleware/rateLimiter.js";
// import job from "./config/cron.js";


const app = express();
const PORT = process.env.PORT || 3000;
const ENABLE_CRON = process.env.ENABLE_CRON === "true";
if (process.env.NODE_ENV === "production" || ENABLE_CRON) {
  job.start();
  dbjob.start(); // 👈 Start the second cron job
}

//middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(rateLimiter);


app.use("/api", healthRoute);
app.use("/api/auth/admin", authRoute);
app.use("/api/auth/student", studentAuthRoute);
app.use("/api/admin", adminRoute);
app.use("/api/student", studentRoute);


app.listen(PORT, ()=>{
console.log("App running on: ",PORT)});
