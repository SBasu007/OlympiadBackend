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

// Comprehensive logging for all requests to /student/exam/submit
app.use((req, res, next) => {
  if (req.path.includes('/student/exam/submit') && req.method === 'POST') {
    console.log('\n[🔍 REQUEST RECEIVED]', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      bodyKeys: typeof req.body === 'object' ? Object.keys(req.body) : 'N/A'
    });
  }
  next();
});

// Handle sendBeacon requests (text/plain content-type) - AFTER json parser
app.use(express.text({ type: 'text/plain' }));
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain' && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
      console.log('[✅ Parsed text/plain as JSON]', { bodyKeys: Object.keys(req.body) });
    } catch (e) {
      console.log('[❌ Failed to parse text/plain]', { error: e.message });
      // If parsing fails, leave body as is
    }
  }
  next();
});
// app.use(rateLimiter);


app.use("/api", healthRoute);
app.use("/api/auth/admin", authRoute);
app.use("/api/auth/student", studentAuthRoute);
app.use("/api/admin", adminRoute);
app.use("/api/student", studentRoute);


app.listen(PORT, ()=>{
console.log("App running on: ",PORT)});
