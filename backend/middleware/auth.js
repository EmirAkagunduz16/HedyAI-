import User from '../models/User.js'
import { verifyToken } from '../utils/jwt.js'

export const authenticate = async (req, res, next) => {
  try {
    console.log(`Auth middleware - ${req.method} ${req.originalUrl}`)
    const authHeader = req.header('Authorization')
    console.log(`Auth header present: ${!!authHeader}, starts with Bearer: ${authHeader?.startsWith('Bearer ')}`)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth failed: No token or invalid format')
      return res.status(401).json({ 
        message: 'Access denied. No token provided or invalid format.' 
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token)
      console.log(`Token decoded successfully for user: ${decoded.userId}`)
      const user = await User.findById(decoded.userId)
      
      if (!user) {
        console.log(`User not found for ID: ${decoded.userId}`)
        return res.status(401).json({ 
          message: 'Invalid token. User not found.' 
        })
      }

      console.log(`Authentication successful for user: ${user.name} (${user._id})`)
      
      // Update last login
      user.lastLogin = new Date()
      await user.save()

      req.user = user
      next()
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError.message)
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
