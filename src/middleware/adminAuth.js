import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function authRequired(req,res,next){
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith("Bearer ")){
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch(err){
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuth(req,res,next){
  const authHeader = req.headers.authorization;
  if(authHeader && authHeader.startsWith("Bearer ")){
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.sub, email: decoded.email };
    } catch(err){
      // ignore token errors in optional mode
    }
  }
  next();
}
