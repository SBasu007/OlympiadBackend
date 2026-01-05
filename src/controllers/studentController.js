import { supabase } from "../config/db.js";
import { uploadToCloudinary,deleteFromCloudinary } from "../config/uploadCloudinary.js";
import { sanitizeOutput } from "../utils/sanitize.js";

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
    const { exam_id, user_id, answers, time_taken } = req.body;

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
      if (userAnswer && userAnswer.selectedOption === question.correct) {
        correctCount++;
      }
    });

    // Calculate score using ques_mark
    const score = correctCount * quesMark;
    const totalMarks = totalQuestions * quesMark;
    const percentage = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : "0.00";
    const passed = parseFloat(percentage) >= 50; // Pass threshold: 50%

    // Store result in database
    const { data: resultData, error: resultError } = await supabase
      .from("result")
      .insert([{
        exam_id,
        user_id,
        correct: correctCount,
        incorrect: totalQuestions - correctCount,
        score,
        time_taken
      }])
      .select("*");

    if (resultError) {
      console.error("Error saving result:", resultError);
      return res.status(500).json({ 
        message: "Failed to save result", 
        error: resultError.message 
      });
    }

    // Return comprehensive result data
    return res.status(200).json({
      result_id: resultData[0].result_id,
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