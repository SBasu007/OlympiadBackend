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