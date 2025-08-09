import { body, query } from 'express-validator'

/**
 * Validation rules for user profile updates
 */
export const validateProfile = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('company').optional().isLength({ max: 100 }).withMessage('Company must be less than 100 characters'),
  body('jobTitle').optional().isLength({ max: 100 }).withMessage('Job title must be less than 100 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
]

/**
 * Validation rules for user settings updates
 */
export const validateSettings = [
  body('emailNotifications').optional().isBoolean().withMessage('Email notifications must be boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('Push notifications must be boolean'),
  body('weeklyReports').optional().isBoolean().withMessage('Weekly reports must be boolean'),
  body('autoTranscribe').optional().isBoolean().withMessage('Auto transcribe must be boolean'),
  body('recordingQuality').optional().isIn(['low', 'medium', 'high']).withMessage('Recording quality must be low, medium, or high'),
  body('language').optional().isString().withMessage('Language must be a string')
]

/**
 * Validation rules for account deletion
 */
export const validateDeleteAccount = [
  body('password').notEmpty().withMessage('Password is required for account deletion')
]

/**
 * Validation rules for user search
 */
export const validateSearch = [
  query('q').trim().isLength({ min: 1 }).withMessage('Search query is required')
]
