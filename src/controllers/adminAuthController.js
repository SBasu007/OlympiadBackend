import { supabase } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "1d"; // can be changed to env var

// Helper to generate JWT
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// POST /api/auth/register
export async function register(req,res){
  try {
    const { username, email, password} = req.body;

    if(!email || !password){
      return res.status(400).json({ message: "Email and password required" });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.status(400).json({ message: "Invalid email format" });
    }

    if(password.length < 8){
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Check if user exists
    const { data: existing, error: existingErr } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if(existingErr){
      console.error("Supabase select error:", existingErr);
      return res.status(500).json({ message: "Database error" });
    }

    if(existing){
      return res.status(409).json({ message: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password,10);

    const { data, error } = await supabase
      .from("admin_users")
      .insert([{ email, password:password_hash, username }])
      .select("user_id,email")
      .single();

    if(error){
      console.error("Supabase insert error:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }

    const token = signToken({ sub: data.user_id, email: data.email });
    return res.status(201).json({ user: data, token });
  } catch(err){
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// POST /api/auth/login
export async function login(req,res){
  try {
    const { email, password } = req.body;
    if(!email || !password){
      return res.status(400).json({ message: "Email and password required" });
    }

    const { data: user, error } = await supabase
      .from("admin_users")
      .select("user_id,email,password")
      .eq("email", email)
      .single();

    if(error){
      if(error.code === "PGRST116" || error.message?.includes("No rows")){
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.error("Supabase select error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if(!valid){
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = signToken({ sub: user.user_id, email: user.email });
    // Remove password before returning
    delete user.password;

    return res.status(200).json({ user, token });
  } catch(err){
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Optional route to get current user
export async function me(req,res){
  try {
    const userId = req.user?.id;
    if(!userId){
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { data: user, error } = await supabase
      .from("admin_users")
      .select("user_id,email")
      .eq("user_id", userId)
      .single();

    if(error){
      console.error("Supabase select error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    return res.status(200).json({ user });
  } catch(err){
    console.error("Me error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/auth/admin/all
export async function listAdmins(req,res){
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id, email, username')
      .order('user_id', { ascending: true });
    if(error){
      console.error('Supabase list admins error:', error);
      return res.status(500).json({ message: 'Database error' });
    }
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch(err){
    console.error('List admins error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
