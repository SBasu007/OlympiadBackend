import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function studentAuthRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }
  
  const token = authHeader.split(" ")[1];
  
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