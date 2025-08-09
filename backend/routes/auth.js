import express from 'express'
import { 
  register, 
  login, 
  getCurrentUser, 
  forgotPassword, 
  resetPassword, 
  changePassword 
} from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { checkValidation } from '../middleware/validation/index.js'
import { 
  validateRegistration, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword, 
  validateChangePassword 
} from '../middleware/validation/authValidation.js'

const router = express.Router()

// Routes
router.post('/register', validateRegistration, checkValidation, register)
router.post('/login', validateLogin, checkValidation, login)
router.get('/me', authenticate, getCurrentUser)
router.post('/forgot-password', validateForgotPassword, checkValidation, forgotPassword)
router.post('/reset-password', validateResetPassword, checkValidation, resetPassword)
router.put('/change-password', authenticate, validateChangePassword, checkValidation, changePassword)

export default router
