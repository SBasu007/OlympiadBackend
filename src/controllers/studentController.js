import { supabase } from "../config/db.js";
import { uploadToCloudinary,deleteFromCloudinary } from "../config/uploadCloudinary.js";
import { sanitizeOutput } from "../utils/sanitize.js";
import PDFDocument from "pdfkit";
import axios from "axios";

// Exam Enrollment
export async function enrollInExam(req, res) {
  let uploadedImgPublicId = null;

  try {
    const { exam_id, user_id } = req.body;
    const file = req.file;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });

    let payment_url = null;
    if (file) {
      // Upload image to Cloudinary
      const uploadResult = await uploadToCloudinary(file,"exam_enrollments_payments");
      payment_url = uploadResult.secure_url;
      uploadedImgPublicId = uploadResult.public_id;
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from("enrol_exam")
      .insert([{
        exam_id,
        user_id,
        payment_url
      }])
      .select("*");

    if (error) {
      // Rollback Cloudinary upload if Supabase fails
      if (uploadedImgPublicId) {
        try {
          const result = await deleteFromCloudinary(uploadedImgPublicId);
          console.log("Rollback Cloudinary result:", result);
        } catch (delErr) {
          console.warn("Cloudinary rollback failed:", delErr.message);
        }
      }

      // Send error response and STOP execution
      return res.status(500).json({
        message: "Failed to enrol in exam",
        error: error.message
      });
    }

    // ✅ Only reach here if insert succeeded
    return res.status(201).json(sanitizeOutput(data[0]));

  } catch (err) {
    console.error("Error enrolling in exam:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
//Exam Enrollment Check
export async function checkEnrollment(req, res) {
  try {
    const { exam_id, user_id } = req.params;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });

    // Check if enrollment exists in Supabase
    const { data, error } = await supabase
      .from("enrol_exam")
      .select("*")
      .eq("exam_id", exam_id)
      .eq("user_id", user_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is not an error in this case
      console.error("Error checking enrollment:", error);
      return res.status(500).json({ 
        message: "Failed to check enrollment", 
        error: error.message 
      });
    }

    // Return enrollment status with status field
    if (data !== null) {
      return res.status(200).json(sanitizeOutput({ 
        enrolled: true, 
        status: data.status || 'pending' 
      }));
    } else {
      return res.status(200).json({ enrolled: false });
    }

  } catch (err) {
    console.error("Error checking enrollment:", err);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
}

// Get all enrolled exams for a user
export async function getEnrolledExams(req, res) {
  try {
    const { user_id } = req.params;

    if (!user_id) return res.status(400).json({ message: "User ID required" });

    // Fetch all enrollments for the user with exam details
    const { data, error } = await supabase
      .from("enrol_exam")
      .select(`
        exam_id,
        status,
        exam (
          exam_id,
          name,
          description,
          start_date,
          end_date,
          subject_id
        )
      `)
      .eq("user_id", user_id);

    if (error) {
      console.error("Error fetching enrolled exams:", error);
      return res.status(500).json({ 
        message: "Failed to fetch enrolled exams", 
        error: error.message 
      });
    }

    // Transform the data to return exam details with enrollment status, filtering out null values
    const enrolledExams = data
      .filter(enrollment => enrollment.exam !== null)
      .map(enrollment => ({
        ...enrollment.exam,
        enrollment_status: enrollment.status || 'pending'
      }));
    
    return res.status(200).json(sanitizeOutput(enrolledExams));

  } catch (err) {
    console.error("Error fetching enrolled exams:", err);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
}

// Get all questions for a specific exam
export async function getExamQuestions(req, res) {
  try {
    const { exam_id } = req.params;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });

    // Fetch all questions for the exam
    const { data, error } = await supabase
      .from("questions")
      .select("question_id, exam_id, question, image_url, options")
      .eq("exam_id", exam_id)

    if (error) {
      console.error("Error fetching questions:", error);
      return res.status(500).json({ 
        message: "Failed to fetch questions", 
        error: error.message 
      });
    }


    return res.status(200).json(data);

  } catch (err) {
    console.error("Error fetching questions:", err);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
}

// Submit exam and calculate score
export async function submitExam(req, res) {
  try {
    const { exam_id, user_id, answers, time_taken, submission_status } = req.body;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });
    if (!answers) return res.status(400).json({ message: "Answers required" });

    // Fetch all questions with correct answers
    const { data: questions, error } = await supabase
      .from("questions")
      .select("question_id, correct")
      .eq("exam_id", exam_id);

    if (error) {
      console.error("Error fetching questions:", error);
      return res.status(500).json({ 
        message: "Failed to fetch questions", 
        error: error.message 
      });
    }

    // Fetch exam details including ques_mark and name
    const { data: examData, error: examError } = await supabase
      .from("exam")
      .select("ques_mark, name, num_of_ques")
      .eq("exam_id", exam_id)
      .single();

    if (examError) {
      console.error("Error fetching exam details:", examError);
      return res.status(500).json({
        message: "Failed to fetch exam details",
        error: examError.message
      });
    }

    const quesMark = examData?.ques_mark ?? 1; // Default to 1 if not found
    // Calculate score
    let correctCount = 0;
    let totalQuestions = questions.length;

    questions.forEach(question => {
      const userAnswer = answers[question.question_id];
      const isCorrect = userAnswer && userAnswer.selectedOption === question.correct;
      
      if (isCorrect) {
        correctCount++;
      }
      
      // Add correct property to each answer object
      if (userAnswer) {
        userAnswer.correct = isCorrect;
      }
    });

    // Calculate score using ques_mark
    const score = correctCount * quesMark;
    const totalMarks = totalQuestions * quesMark;
    const percentage = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : "0.00";
    const passed = parseFloat(percentage) >= 50; // Pass threshold: 50%

    // Only store result if submission_status is 'submitted'
    if (submission_status == 'submitted') {
      // Store result in database
      const { data: resultData, error: resultError } = await supabase
        .from("result")
        .insert([{
          exam_id,
          user_id,
          correct: correctCount,
          incorrect: totalQuestions - correctCount,
          score,
          percentage,
          time_taken,
        }])
        .select("*");

      if (resultError) {
        console.error("Error saving result:", resultError);
        return res.status(500).json({ 
          message: "Failed to save result", 
          error: resultError.message 
        });
      }    
    } 
   
    // Update exam access to mark as submitted/ended
    const {data: AccessData, error: AccessDataError } = await supabase
      .from("exam_access")
      .update({ attempted: submission_status })
      .eq("exam_id", exam_id)
      .eq("user_id", user_id);

    if (AccessDataError) {
      console.error("Error updating exam access:", AccessDataError);
    }  
    
    // Log user attempt with answers
    const { data: answerLogData, error: answerLogError } = await supabase
      .from("user_attempt")
      .insert([{
        exam_id,
        user_id,
        answers}])

    if (answerLogError) {
      console.error("Error logging user attempt:", answerLogError);
    }    
      
    // Return comprehensive result data
    return res.status(200).json({
      exam_name: examData.name,
      exam_type: "MCQ",
      score,
      total: totalMarks,
      correct: correctCount,
      incorrect: totalQuestions - correctCount,
      total_questions: totalQuestions,
      percentage,
      passed
    });

  } catch (err) {
    console.error("Error submitting exam:", err);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
}

// Get exam result by result_id
export async function getExamResult(req, res) {
  try {
    const { result_id } = req.params;

    if (!result_id) return res.status(400).json({ message: "Result ID required" });

    const { data, error } = await supabase
      .from("exam_results")
      .select("*")
      .eq("id", result_id)
      .single();

    if (error) {
      console.error("Error fetching result:", error);
      return res.status(500).json({ 
        message: "Failed to fetch result", 
        error: error.message 
      });
    }

    if (!data) {
      return res.status(404).json({ message: "Result not found" });
    }

    return res.status(200).json(sanitizeOutput(data));

  } catch (err) {
    console.error("Error fetching result:", err);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: err.message 
    });
  }
}

// Request re-exam
export async function requestReExam(req, res) {
  try {
    const { exam_id, user_id, reason } = req.body;

    // Validation
    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });
    if (!reason) return res.status(400).json({ message: "Reason required" });

    // Check if enrollment exists for this user and exam
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("re_attempt")
      .select("status")
      .eq("exam_id", exam_id)
      .eq("user_id", user_id)
      .single();

    if (enrollmentError && enrollmentError.code !== 'PGRST116') {
      console.error("Error checking enrollment:", enrollmentError);
      return res.status(500).json({
        message: "Failed to check enrollment status",
        error: enrollmentError.message
      });
    }

    if (enrollmentData)
    {if (enrollmentData.status == "pending" || enrollmentData.status == "approved") {
      return res.status(400).json({
        message: "You have already requested a re-exam for this exam."
      });
    }}
    

    // Insert into re_attempt table
    const { data, error } = await supabase
      .from("re_attempt")
      .insert([{
        exam_id,
        user_id,
        reason,
      }])
      .select("*");

    if (error) {
      console.error("Error requesting re-exam:", error);
      return res.status(500).json({
        message: "Failed to request re-exam",
        error: error.message
      });
    }

    return res.status(201).json({
      message: "Re-exam request submitted successfully",
      data: sanitizeOutput(data[0])
    });

  } catch (err) {
    console.error("Error requesting re-exam:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
}

// Get previous exam result by exam_id and user_id for resume mode
export async function getPreviousExamResult(req, res) {
  try {
    const { exam_id, user_id } = req.params;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });

    // Fetch the most recent result for this exam and user
    const { data, error } = await supabase
      .from("result")
      .select("*")
      .eq("exam_id", exam_id)
      .eq("user_id", user_id)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching previous result:", error);
      return res.status(500).json({
        message: "Failed to fetch previous result",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({ message: "No previous result found" });
    }

    return res.status(200).json(sanitizeOutput(data));

  } catch (err) {
    console.error("Error fetching previous result:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
}

// Get previous exam attempts by exam_id and user_id for resume mode
export async function getPreviousExamAttempts(req, res) {
  try {
    const { exam_id, user_id } = req.params;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });

    // Fetch the most recent attempt with answers
    const { data, error } = await supabase
      .from("user_attempt")
      .select("*")
      .eq("exam_id", exam_id)
      .eq("user_id", user_id)
      .order("answer_id", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching previous attempts:", error);
      return res.status(500).json({
        message: "Failed to fetch previous attempts",
        error: error.message
      });
    }

    if (!data || !data.answers) {
      return res.status(404).json({ message: "No previous attempts found" });
    }

    // Convert answers object to array format for easier consumption
    const answersArray = Object.entries(data.answers).map(([questionId, answer]) => ({
      question_id: parseInt(questionId),
      question: answer.question,
      selected_option: answer.selectedOption,
      saved_at: answer.savedAt
    }));

    return res.status(200).json(answersArray);

  } catch (err) {
    console.error("Error fetching previous attempts:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
}

// Generate certificate PDF
export async function generateCertificate(req, res) {
  try {
    const { user_id, exam_id } = req.params;

    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });
    if (!user_id) return res.status(400).json({ message: "User ID required" });

    /* ================= EXAM ================= */
    const { data: examData, error: examError } = await supabase
      .from("exam")
      .select("exam_id, name, certificate_bg")
      .eq("exam_id", exam_id)
      .single();

    if (examError || !examData)
      return res.status(404).json({ message: "Exam not found" });

    if (!examData.certificate_bg)
      return res
        .status(400)
        .json({ message: "Certificate template not available" });

    /* ================= USER ================= */
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_id, name")
      .eq("user_id", user_id)
      .single();

    if (userError || !userData)
      return res.status(404).json({ message: "User not found" });

    /* ================= RESULT ================= */
    const { data: resultData, error: resultError } = await supabase
      .from("result")
      .select("*")
      .eq("exam_id", exam_id)
      .eq("user_id", user_id)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .single();

    if (resultError || !resultData)
      return res
        .status(404)
        .json({ message: "No exam result found" });

    if (Number(resultData.percentage) < 50)
      return res.status(400).json({
        message: "Certificate available only for 50% and above"
      });

    /* ================= DOWNLOAD TEMPLATE ================= */
    const imageResponse = await axios.get(examData.certificate_bg, {
      responseType: "arraybuffer"
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    /* ================= HEADERS ================= */
    const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const fileName = `certificate_${safe(userData.name)}_${safe(
      examData.name
    )}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileName}"`
    );
    res.setHeader("Cache-Control", "no-store");

    /* ================= PDF ================= */
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0
    });

    doc.pipe(res);

    /* ================= BACKGROUND ================= */
    doc.image(imageBuffer, 0, 0, {
      width: 842,
      height: 595
    });

    /* ================= TEXT AREA ================= */
    const LEFT_X = 80;
    const CONTENT_WIDTH = 560;

    /* Student Name */
    doc
      .font("Helvetica-Bold")
      .fontSize(34)
      .fillColor("#1a1a1a")
      .text(userData.name, LEFT_X, 260, {
        width: CONTENT_WIDTH,
        align: "center"
      });

    /* Subtitle */
    doc
      .font("Helvetica")
      .fontSize(18)
      .fillColor("#333333")
      .text(
        "has successfully participated and achieved qualifying performance in the",
        LEFT_X,
        315,
        {
          width: CONTENT_WIDTH,
          align: "center"
        }
      );

    /* Exam Name */
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#000000")
      .text(examData.name, LEFT_X, 365, {
        width: CONTENT_WIDTH,
        align: "center"
      });

    /* Score */
    doc
      .font("Helvetica")
      .fontSize(16)
      .fillColor("#555555")
      .text(
        `Score: ${resultData.score}   |   Percentage: ${resultData.percentage}%`,
        LEFT_X,
        410,
        {
          width: CONTENT_WIDTH,
          align: "center"
        }
      );

    /* Date (Bottom Left) */
    const certificateDate = new Date(
      resultData.attempted_at
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    doc
      .fontSize(14)
      .fillColor("#444444")
      .text(`${certificateDate}`, 90, 511);

    /* Signature Text (Bottom Right safe zone) */
   

    doc.end();
  } catch (err) {
    console.error("Certificate Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Internal server error",
        error: err.message
      });
    }
  }
}