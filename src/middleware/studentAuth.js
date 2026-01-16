import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function studentAuthRequired(req, res, next) {
  // Read token from HTTP-only cookie
  const token = req.cookies?.student_token;
  
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ensure it's a student token
    if (decoded.type !== 'student') {
      return res.status(403).json({ message: "Invalid token type" });
    }
    
    req.user = { id: decoded.sub, email: decoded.email, type: decoded.type };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}