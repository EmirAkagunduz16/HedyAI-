import User from '../models/User.js'
import { verifyToken } from '../utils/jwt.js'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided or invalid format.' 
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token)
      const user = await User.findById(decoded.userId)
      
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid token. User not found.' 
        })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      req.user = user
      next()
    } catch (jwtError) {
      return res.status(401).json({ 
        message: 'Invalid token.' 
      })
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({ 
      message: 'Server error during authentication.' 
    })
  }
}

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      })
    }

    next()
  }
}

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next() // Continue without authentication
    }

    const token = authHeader.substring(7)

    try {
      const decoded = verifyToken(token)
      const user = await User.findById(decoded.userId)
      
      if (user) {
        req.user = user
      }
    } catch (jwtError) {
      // Invalid token, but continue without authentication
    }

    next()
  } catch (error) {
    next() // Continue without authentication on error
  }
}
