import { body, query } from 'express-validator'

/**
 * Validation rules for meeting queries
 */
export const validateQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['scheduled', 'live', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('sortBy').optional().isIn(['createdAt', 'scheduledAt', 'title']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order')
]

/**
 * Validation rules for creating a meeting
 */
export const validateCreateMeeting = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('scheduledAt').optional().isISO8601().withMessage('Scheduled date must be valid'),
  body('settings.maxParticipants').optional().isInt({ min: 1, max: 1000 }).withMessage('Max participants must be between 1 and 1000')
]

/**
 * Validation rules for updating a meeting
 */
export const validateUpdateMeeting = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('scheduledAt').optional().isISO8601().withMessage('Scheduled date must be valid')
]
