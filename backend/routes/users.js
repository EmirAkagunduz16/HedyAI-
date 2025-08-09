import express from 'express'
import {
  getProfile,
  updateProfile,
  updateSettings,
  getDashboardStats,
  uploadAvatar,
  deleteAccount,
  exportUserData,
  searchUsers
} from '../controllers/userController.js'
import { checkValidation } from '../middleware/validation/index.js'
import {
  validateProfile,
  validateSettings,
  validateDeleteAccount,
  validateSearch
} from '../middleware/validation/userValidation.js'

const router = express.Router()

// Routes
router.get('/profile', getProfile)
router.get('/dashboard', getDashboardStats)
router.get('/export', exportUserData)
router.get('/search', validateSearch, checkValidation, searchUsers)
router.put('/profile', validateProfile, checkValidation, updateProfile)
router.put('/settings', validateSettings, checkValidation, updateSettings)
router.post('/avatar', uploadAvatar)
router.delete('/account', validateDeleteAccount, checkValidation, deleteAccount)

export default router