# OlympiadBackend - System Overview & Architecture

## 1. Overall Backend Functionality
This backend serves as the core API for an Olympiad Management System. It is built using **Node.js** with **Express.js** and connects to a **Supabase (PostgreSQL)** database.

Key functionalities include:
- **Authentication & Authorization**: Independent JWT-based authentication flows for Admins and Students, protected by custom middleware (`adminAuth.js`, `studentAuth.js`).
- **Data Management (Admin)**: Full CRUD capabilities for Categories, Subcategories, Subjects, and Exams. Support for image uploads via `multer`.
- **Question Management**: Supports both single question uploads and bulk batch uploads (up to 100 questions per request) with image support.
- **Exam Engine**: Manages student enrollments, status tracking (pending/approved), tracking exam attempts, submitting exams, computing results, and re-exam requests.
- **Certificate Generation**: Uses `pdfkit` to dynamically generate PDF certificates for students upon exam completion.
- **Background Cron Jobs**: Two automated jobs (`cron.js`) ensure the server doesn't sleep (pings every 14 minutes) and the Supabase DB connection remains hot (pings every 6 hours).

---

## 2. API Routes & Endpoints

### 🟢 Health & Maintenance (`/api`)
- `GET /api/health` - Server health check.
- `GET /api/warmup` - DB warmup ping.

### 🛡️ Admin Authentication (`/api/auth/admin`)
- `POST /register` - Register a new admin.
- `POST /login` - Admin login (issues JWT).
- `GET /me` - Get current admin profile (Auth required).
- `GET /all` - List all admins.

### 🎓 Student Authentication (`/api/auth/student`)
- `POST /register` - Register a new student (input sanitized).
- `POST /login` - Student login.
- `POST /logout` - Student logout.
- `GET /me` - Get current student profile.

### 🛠️ Admin Dashboard & Operations (`/api/admin`)
*(All routes require Admin JWT)*
- `GET /dashboard-data` - **Aggregated endpoint** fetching Categories, SubCategories, Subjects, and Exams in one call.
- **Category:** `POST /category`, `GET /category`, `GET /category/:id`
- **SubCategory:** `POST /subcategory`, `GET /subcategory`, `GET /subcategory/:id`, `PUT /subcategory/:id`, `DELETE /subcategory/:id`
- **Subject:** `POST /subject`, `GET /subject`, `GET /subject/:id`, `PUT /subject/:id`, `DELETE /subject/:id`
- **Exam:** `POST /exam`, `GET /exam`, `GET /exam/:id`, `PUT /exam/:id`, `DELETE /exam/:id`
- **Questions:** 
  - `POST /upload-questions` - Single upload.
  - `POST /upload-questions-batch` - Bulk upload (Multipart form parsing up to 100 files).
  - `GET /questions`, `GET /questions/:id`, `PUT /questions/:id`, `DELETE /questions/exam/:exam_id`
  - `GET /exams-with-questions` - Optimized query for exams.
- **Enrollments:** `GET /enrollments/pending`, `PUT /enrollments/:enrol_id/status`
- **Requests & Re-exams:** `GET /request`, `GET /user-attempts/:user_id`, `PUT /request/:re_attempt_id/approve`, `PUT /request/:re_attempt_id/decline`
- **Reports:** `GET /exam-access/:user_id`, `GET /merit-list`

### 🧑‍🎓 Student Operations (`/api/student`)
*(Most routes require Student JWT)*
- `POST /enroll` - Enroll in an exam.
- `GET /enrollment/:exam_id/:user_id` - Check enrollment status.
- `GET /enrolled-exams/:user_id` - Fetch all exams a student is enrolled in.
- `GET /exam/:exam_id/questions` - Fetch exam questions (shuffled/structured).
- `POST /exam/submit` - Submit exam answers, compute score, insert result. (Has active `sendBeacon` fallback `text/plain` parser).
- `GET /exam/result/:result_id` - Get specific exam result.
- `POST /re-exam/request` - Submit request for re-attempt.
- `GET /exam/:exam_id/result/:user_id` - Get previous result (for resume mode).
- `GET /exam/:exam_id/attempts/:user_id` - Check total previous attempts.
- `GET /certificate/:user_id/:exam_id` - Generate and return completion certificate (PDF).

---

## 3. Server Load & Database Call Estimates

### 🖥️ Server Load (Node.js/Express)
1. **Memory & I/O Heaviness**:
   - **Image Uploads (`multer`)**: The server handles raw multipart form data buffering. The batch question upload (`/upload-questions-batch`) configures up to 100 files dynamically. This will spike Node.js RAM usage temporarily if many admins upload simultaneously.
   - **Certificate Generation (`pdfkit`)**: PDF generation is heavily CPU-bound in Node.js (which is single-threaded). Concurrent requests to `/certificate/:user_id/:exam_id` during peak exam completion times could severely block the event loop, causing latency for other API requests.
2. **Payload Parsing**: The custom `sendBeacon` fallback for `/exam/submit` uses a custom `text/plain` body parser which incurs a synchronous `JSON.parse()`. Since payload sizes for exam answers are typically small, this is manageable but should be monitored.

### 🗄️ Database Load (Supabase / PostgreSQL)
The application relies heavily on the Supabase JS SDK (`@supabase/supabase-js`), meaning all DB calls are executed via Supabase's REST API (PostgREST).
1. **High Volume Reads**:
   - The `/dashboard-data` endpoint makes **4 parallel `select` queries** (`category`, `sub_category`, `subject`, `exam`). While it reduces HTTP round-trips for the client, it generates a quick burst of DB queries.
   - Getting exam questions `/exam/:exam_id/questions` fetches potentially large arrays of JSON objects.
2. **Write Heavy Operations**:
   - `/exam/submit`: This is the most critical transaction. It requires fetching the exam (to get correct answers/time), computing the score in memory, and inserting the result into the `results` table. If hundreds of students finish an exam concurrently, write contention and network latency to Supabase could spike.
   - `upload-questions-batch`: Inserts multiple rows simultaneously.
3. **Database Connection Resilience**:
   - Because it's serverless/SaaS (Supabase REST), there's no direct TCP connection pooling exhaustion on the Node server.
   - The `cron.js` explicitly issues a `/warmup` ping every 6 hours. This is a clever optimization to keep the Supabase instance from pausing due to inactivity, ensuring fast cold-start responses.

### 🚀 Optimization Recommendations
- **PDF Offloading**: Move the `pdfkit` generation to a background worker or serverless function to prevent blocking the Express event loop.
- **Caching**: Implement Redis (or memory cache) for read-heavy, rarely changing data like Categories, Subjects, and Exams to minimize Supabase API quotas.
- **Batching DB Writes**: On exam submission, consider queueing the score computation and result insertion to handle large traffic spikes gracefully.
