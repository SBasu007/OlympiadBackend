import { supabase } from "../config/db.js";
import { uploadToCloudinary,deleteFromCloudinary } from "../config/uploadCloudinary.js";

//Category Controllers
export async function createCategory(req, res) {
  let uploadedImgPublicId = null;

  try {
    const { name } = req.body;
    const file = req.file;

    if (!name) return res.status(400).json({ message: "Name required" });

    let promo_url = null;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      promo_url = uploadResult.secure_url;
      uploadedImgPublicId = uploadResult.public_id; // save for rollback
    }

    const { data, error } = await supabase
      .from("category")
      .insert([{ name, promo_url }])
      .select("*");

    if (error) {
      // Supabase failed → rollback Cloudinary image if uploaded
      if (uploadedImgPublicId) {
        try {
          const result = await deleteFromCloudinary(uploadedImgPublicId);
          console.log("Rollback Cloudinary result:", result);
        } catch (delErr) {
          console.warn("Cloudinary rollback failed:", delErr.message);
        }
      }

      return res.status(500).json({
        message: "Failed to create category",
        error: error.message
      });
    }

    return res.status(201).json(data[0]);

  } catch (err) {
    console.error("Error creating category:", err);

    // Final safeguard rollback if error occurred AFTER upload but BEFORE insert
    if (uploadedImgPublicId) {
      try {
        const result = await deleteFromCloudinary(uploadedImgPublicId);
        console.log("Rollback after exception:", result);
      } catch (delErr) {
        console.warn("Cloudinary rollback (catch) failed:", delErr.message);
      }
    }

    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
export async function getCategory(req, res) {
  try {
    const { id } = req.params; // pulls id from route (optional)

    let query = supabase.from("category").select("*");

    if (id) {
      // If an ID is passed, fetch a single category
      query = query.eq("category_id", id).single();
    } else {
      // If no ID is passed, fetch all categories
      query = query.order("category_id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching category:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch category data", error });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Internal error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

//Subcategory Controllers
export async function createSubCategory(req, res) {
  let uploadedImgPublicId = null;

  try {
    const { cat_id, name } = req.body;
    const file = req.file;

    if (!cat_id) return res.status(400).json({ message: "Category ID required" });
    if (!name) return res.status(400).json({ message: "Name required" });

    let cat_img_url = null;
    if (file) {
      // Upload image to Cloudinary
      const uploadResult = await uploadToCloudinary(file,"subcategories");
      cat_img_url = uploadResult.secure_url;
      uploadedImgPublicId = uploadResult.public_id;
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from("sub_category")
      .insert([{
        category_id: cat_id,
        name,
        cat_img_url
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
        message: "Failed to create subcategory",
        error: error.message
      });
    }

    // ✅ Only reach here if insert succeeded
    return res.status(201).json(data[0]);

  } catch (err) {
    console.error("Error creating subcategory:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
export async function getSubCategory(req, res) {
  try {
    const { id } = req.params; // extract id if present
    const { catid, category_id } = req.query; // optional category filter

    let query = supabase.from("sub_category").select("*");

    if (id) {
      // Fetch a single subcategory by id
      query = query.eq("subcategory_id", id).single();
    } else {
      // Filter by category if provided
      const resolvedCatId = catid || category_id; // support either query name
      if (resolvedCatId) {
        query = query.eq("category_id", resolvedCatId);
      }
      // Order for list responses
      query = query.order("subcategory_id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching subcategories:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch subcategories", error });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Internal error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

export async function updateSubCategory(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Subcategory id required" });

    const { cat_id, name } = req.body;
    const file = req.file;

    const update = {};
    if (cat_id !== undefined) update.category_id = cat_id;
    if (name !== undefined) update.name = name;

    if (file) {
      try {
        const uploadResult = await uploadToCloudinary(file, "subcategories");
        update.cat_img_url = uploadResult.secure_url;
      } catch (e) {
        return res.status(500).json({ message: "Failed to upload image", error: e?.message });
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("sub_category")
      .update(update)
      .eq("subcategory_id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: "Failed to update subcategory", error });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error updating subcategory:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

export async function deleteSubCategory(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Subcategory id required" });

    const { error } = await supabase
      .from("sub_category")
      .delete()
      .eq("subcategory_id", id);

    if (error) return res.status(500).json({ message: "Failed to delete subcategory", error });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting subcategory:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

//Subject Controllers
export async function createSubject(req, res) {
  try {
    const { subcategory_id, name } = req.body;

    // Basic validation
    if (!subcategory_id) {
      return res.status(400).json({ message: "Subcategory ID required" });
    }
    if (!name) {
      return res.status(400).json({ message: "Name required" });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from("subject")
      .insert([{
        subcategory_id,
        name
      }])

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        message: "Failed to create subject",
        error: error.message
      });
    }

    return res.status(201).json("Inserted successfully"); // return created subject
  } catch (err) {
    console.error("Error creating subject:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
export async function getSubject(req, res) {
  try {
    const { id } = req.params; // extract subject_id if present
    const { subcid } = req.query; // optional subcategory filter

    let query = supabase.from("subject").select("*");

    if (id) {
      // Fetch a single subject by id
      query = query.eq("subject_id", id).single();
    } else {
      // Filter by subcategory if subcid provided
      if (subcid) {
        query = query.eq("subcategory_id", subcid);
      }
      // Order always for list responses
      query = query.order("subject_id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching subjects:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch subjects", error });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Internal error:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

export async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Subject id required" });

    const { name, subcategory_id } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (subcategory_id !== undefined) update.subcategory_id = subcategory_id;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("subject")
      .update(update)
      .eq("subject_id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ message: "Failed to update subject", error });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error updating subject:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

export async function deleteSubject(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Subject id required" });
    const { error } = await supabase
      .from("subject")
      .delete()
      .eq("subject_id", id);
    if (error) return res.status(500).json({ message: "Failed to delete subject", error });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting subject:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

//Exam Controllers
export async function createExam(req, res) {
  let uploadedImgPublicId = null; // Track uploaded image for rollback

  try {
    const {
      subject_id,
      name,
      description,
      start_date,
      end_date,
      fees,
      num_of_ques,
      type,
      study_mat_url,
      duration,
      ques_mark
    } = req.body;

    const file = req.file; // certificate_bg file (if provided)
    let certificate_bg = null;

    // ✅ Basic validation
    if (!subject_id) return res.status(400).json({ message: "Subject ID required" });
    if (!name) return res.status(400).json({ message: "Name required" });
    if (!start_date || !end_date) {
      return res.status(400).json({ message: "Start and End dates are required" });
    }

    // ✅ Upload certificate background if file provided
    if (file) {
      const uploadResult = await uploadToCloudinary(file,"exam_certificates");
      certificate_bg = uploadResult.secure_url;
      uploadedImgPublicId = uploadResult.public_id;
    }

    // ✅ Insert into Supabase
    const { data, error } = await supabase
      .from("exam")
      .insert([{
        subject_id,
        name,
        description,
        start_date,
        end_date,
        fees,
        num_of_ques,
        type,
        study_mat_url,
        duration,
        ques_mark,
        certificate_bg
      }])
      .select("*");

    if (error) {
      // Rollback Cloudinary upload if Supabase fails
      if (uploadedImgPublicId) {
        try {
          await deleteFromCloudinary(uploadedImgPublicId);
          console.log("Rollback: Certificate image deleted from Cloudinary");
        } catch (delErr) {
          console.warn("Cloudinary rollback failed:", delErr.message);
        }
      }

      return res.status(500).json({
        message: "Failed to create exam",
        error: error.message
      });
    }

    return res.status(201).json(data[0]);

  } catch (err) {
    console.error("Error creating exam:", err);

    // Rollback if a file was uploaded but request failed
    if (uploadedImgPublicId) {
      try {
        await deleteFromCloudinary(uploadedImgPublicId);
        console.log("Rollback: Certificate image deleted due to server error");
      } catch (delErr) {
        console.warn("Cloudinary rollback failed:", delErr.message);
      }
    }

    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
export async function getExam(req, res) {
  try {
    const { id } = req.params; // extract exam_id if present
    const { subject_id, subjectId } = req.query; // optional subject filter

    let query = supabase.from("exam").select("*");

    if (id) {
      // Fetch a single exam by id
      query = query.eq("exam_id", id).single();
    } else {
      // Optional filter by subject
      const resolvedSubjectId = subject_id || subjectId;
      if (resolvedSubjectId) {
        query = query.eq("subject_id", resolvedSubjectId);
      }
      // Fetch all exams, ordered by exam_id
      query = query.order("exam_id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching exams:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch exams", error });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Internal error:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

export async function updateExam(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Exam id required" });

    const file = req.file;
    const {
      subject_id,
      name,
      description,
      start_date,
      end_date,
      fees,
      num_of_ques,
      type,
      study_mat_url,
      duration,
      ques_mark
    } = req.body;

    const update = {};
    if (subject_id !== undefined) update.subject_id = subject_id;
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (start_date !== undefined) update.start_date = start_date;
    if (end_date !== undefined) update.end_date = end_date;
    if (fees !== undefined) update.fees = fees;
    if (num_of_ques !== undefined) update.num_of_ques = num_of_ques;
    if (type !== undefined) update.type = type;
    if (study_mat_url !== undefined) update.study_mat_url = study_mat_url;
    if (duration !== undefined) update.duration = duration;
    if (ques_mark !== undefined) update.ques_mark = ques_mark;

    if (file) {
      const uploadResult = await uploadToCloudinary(file, "exam_certificates");
      update.certificate_bg = uploadResult.secure_url;
    }

    if (Object.keys(update).length === 0) return res.status(400).json({ message: "No fields to update" });

    const { data, error } = await supabase
      .from("exam")
      .update(update)
      .eq("exam_id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ message: "Failed to update exam", error });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error updating exam:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

export async function deleteExam(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Exam id required" });
    const { error } = await supabase
      .from("exam")
      .delete()
      .eq("exam_id", id);
    if (error) return res.status(500).json({ message: "Failed to delete exam", error });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting exam:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

//Question Upload Controller
export async function uploadQuestions(req, res) {
  let uploadedImgPublicId = null;

  try {
  const { exam_id, question_text, options, correct_option } = req.body;
    const file = req.file;

    // Basic validation
    let image_url = null;

    // Upload image to Cloudinary (if present)
    if (file) {
      const uploadResult = await uploadToCloudinary(file, "questions");
      image_url = uploadResult.secure_url;
      uploadedImgPublicId = uploadResult.public_id;
    }

    // Insert into Supabase
    // Normalize options and correct value
    let parsedOptions = [];
    try { parsedOptions = JSON.parse(options) || []; } catch { parsedOptions = []; }
    let correctValue = correct_option;
    if (typeof correct_option === 'string') {
      // If numeric string, map to option value; else assume it's already the option content
      const idx = Number.parseInt(correct_option, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < parsedOptions.length) {
        correctValue = parsedOptions[idx];
      }
    } else if (typeof correct_option === 'number') {
      if (correct_option >= 0 && correct_option < parsedOptions.length) {
        correctValue = parsedOptions[correct_option];
      }
    }

    const { data, error } = await supabase
      .from("questions")
      .insert([
        {
          exam_id,
          question:question_text,
          options: parsedOptions,
          correct: correctValue,
          image_url,
        },
      ])
      .select("*");

    // If Supabase insert fails → rollback Cloudinary
    if (error) {
      if (uploadedImgPublicId) {
        try {
          const result = await deleteFromCloudinary(uploadedImgPublicId);
          console.log("Rollback Cloudinary result:", result);
        } catch (delErr) {
          console.warn("Cloudinary rollback failed:", delErr.message);
        }
      }

      return res.status(500).json({
        message: "Failed to upload question",
        error: error.message,
      });
    }

    // Success
    return res.status(201).json(data[0]);

  } catch (err) {
    console.error("Error uploading question:", err);

    // Rollback if exception occurred after upload
    if (uploadedImgPublicId) {
      try {
        const result = await deleteFromCloudinary(uploadedImgPublicId);
        console.log("Rollback after exception:", result);
      } catch (delErr) {
        console.warn("Cloudinary rollback (catch) failed:", delErr.message);
      }
    }

    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// Questions CRUD for Exam Papers
export async function getQuestions(req, res) {
  try {
    const { id } = req.params; // optional question id
    const { exam_id } = req.query; // optional exam id filter

    let query = supabase.from("questions").select("*");
    if (id) {
      query = query.eq("question_id", id).single();
    } else {
      if (exam_id) query = query.eq("exam_id", exam_id);
      // Optional ordering if column exists; ignore if not
      query = query.order("question_id", { ascending: true });
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ message: "Failed to fetch questions", error });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching questions:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

export async function updateQuestion(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Question id required" });

  const { question_text, options, correct_option } = req.body;
    const file = req.file; // optional new image

    let image_url = undefined;
    if (file) {
      const uploadResult = await uploadToCloudinary(file, "questions");
      image_url = uploadResult.secure_url;
    }

    let payload = {};
    if (question_text !== undefined) payload = { ...payload, question: question_text };
    if (options !== undefined) {
      let parsed = options;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      payload = { ...payload, options: parsed };
    }
    if (correct_option !== undefined) {
      let correctValue = correct_option;
      // If we have options in this request, prefer them for index mapping; else we need to fetch existing options
      let optionsArray = undefined;
      if (payload.options && Array.isArray(payload.options)) {
        optionsArray = payload.options;
      } else if (typeof options === 'string') {
        try { const maybe = JSON.parse(options); if (Array.isArray(maybe)) optionsArray = maybe; } catch{}
      }
      if (optionsArray) {
        if (typeof correct_option === 'string') {
          const idx = Number.parseInt(correct_option, 10);
          if (!Number.isNaN(idx) && idx >= 0 && idx < optionsArray.length) {
            correctValue = optionsArray[idx];
          }
        } else if (typeof correct_option === 'number') {
          if (correct_option >= 0 && correct_option < optionsArray.length) {
            correctValue = optionsArray[correct_option];
          }
        }
      }
      payload = { ...payload, correct: correctValue };
    }
    if (image_url !== undefined) payload = { ...payload, image_url };

    const { data, error } = await supabase
      .from("questions")
      .update(payload)
      .eq("question_id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: "Failed to update question", error });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error updating question:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

export async function deleteQuestionsByExam(req, res) {
  try {
    const { exam_id } = req.params;
    if (!exam_id) return res.status(400).json({ message: "Exam ID required" });

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("exam_id", exam_id);

    if (error) return res.status(500).json({ message: "Failed to delete questions", error });
    return res.status(200).json({ success: true, message: "All questions deleted successfully" });
  } catch (err) {
    console.error("Error deleting questions:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}

// Get distinct exam IDs that have questions (optimized for minimal data transfer)
export async function getExamsWithQuestions(req, res) {
  try {
    // Fetch only distinct exam_id values instead of all questions
    const { data, error } = await supabase
      .from("questions")
      .select("exam_id");

    if (error) return res.status(500).json({ message: "Failed to fetch exam IDs", error });
    
    // Extract unique exam IDs
    const uniqueExamIds = [...new Set(data.map(q => q.exam_id))];
    
    return res.status(200).json(uniqueExamIds);
  } catch (err) {
    console.error("Error fetching exams with questions:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
