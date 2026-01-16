import { body, validationResult } from 'express-validator';

// Sanitization middleware for student registration
export const sanitizeRegisterInput = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
  body('password').trim().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().escape().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
  body('guardian').optional().trim().escape().isLength({ max: 100 }),
  body('institute').optional().trim().escape().isLength({ max: 200 }),
  body('userClass').optional().trim().escape().isLength({ max: 50 }),
  body('contact').optional().trim().escape().isLength({ max: 20 }),
];

// Sanitization middleware for login
export const sanitizeLoginInput = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

// Middleware to check validation results
export const checkValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array().map(e => e.msg) 
    });
  }
  next();
};

// Helper function to sanitize output data (prevent XSS in responses)
export function sanitizeOutput(data) {
  // List of field names that contain URLs and should not be sanitized
  const urlFields = ['image_url', 'url', 'link', 'href', 'src', 'payment_url', 'study_mat_url'];
  
  if (typeof data === 'string') {
    // Escape HTML characters (but not forward slashes for URLs)
    return data
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
      // Note: NOT escaping forward slashes to preserve URLs
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeOutput(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        // Don't sanitize certain fields that should remain as-is
        if (['password', 'password_hash', 'token'].includes(key)) {
          sanitized[key] = data[key];
        } 
        // Don't sanitize URL fields - keep them as-is
        else if (urlFields.includes(key) || key.endsWith('_url') || key.endsWith('_link')) {
          sanitized[key] = data[key];
        }
        else {
          sanitized[key] = sanitizeOutput(data[key]);
        }
      }
    }
    return sanitized;
  }
  
  return data;
}
