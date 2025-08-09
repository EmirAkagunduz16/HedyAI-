export const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message

  // Log error
  console.error('Error:', err)

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = {
      message,
      statusCode: 404
    }
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    error = {
      message,
      statusCode: 400
    }
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => error.message).join(', ')
    error = {
      message,
      statusCode: 400
    }
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token'
    error = {
      message,
      statusCode: 401
    }
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired'
    error = {
      message,
      statusCode: 401
    }
  }

  // Multer error (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large'
    error = {
      message,
      statusCode: 400
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export const handleAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
