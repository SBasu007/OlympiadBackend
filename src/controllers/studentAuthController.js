import { supabase } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sanitizeOutput } from "../utils/sanitize.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "1d"; // 1 day session
// const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day in milliseconds

// Helper to generate JWT
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Helper to set HTTP-only cookie
function setAuthCookie(res, token) {
  res.cookie('student_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',
    // maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

// POST /api/auth/student/register
export async function registerUser(req, res) {
  try {
    const { email, password, name, guardian, institute, userClass, contact } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Check if user already exists
    const { data: existing, error: existingErr } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingErr) {
      console.error("Supabase select error:", existingErr);
      return res.status(500).json({ message: "Database error while checking user" });
    }

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          password: password_hash,
          name,
          guardian,
          institute,
          class: userClass,
          contact,
        },
      ])
      .select("user_id, email, name")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ message: "Failed to create account" });
    }

    // Generate JWT and set HTTP-only cookie
    const token = signToken({ sub: data.user_id, email: data.email, type: "user" });
    setAuthCookie(res, token);

    // Sanitize user data before sending
    const sanitizedUser = sanitizeOutput(data);

    return res.status(201).json({ user: sanitizedUser, message: "Registration successful" });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// POST /api/auth/student/login
export async function loginStudent(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const { data: student, error } = await supabase
      .from("users")
      .select("user_id, email, password, name, contact")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("No rows")) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.error("Supabase select error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    const valid = await bcrypt.compare(password, student.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = signToken({ sub: student.user_id, email: student.email, type: 'student' });
    setAuthCookie(res, token);
    
    // Remove password before returning
    delete student.password;

    // Sanitize user data before sending
    const sanitizedStudent = sanitizeOutput(student);

    return res.status(200).json({ user: sanitizedStudent, message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/auth/student/me
export async function getStudentProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { data: student, error } = await supabase
      .from("users")
      .select("user_id, email, name, contact")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Supabase select error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    // Sanitize user data before sending
    const sanitizedStudent = sanitizeOutput(student);

    return res.status(200).json({ user: sanitizedStudent });
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// POST /api/auth/student/logout
export async function logoutStudent(req, res) {
  try {
    // Clear the HTTP-only cookie
    res.clearCookie('student_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}``