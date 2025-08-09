import { body, query } from 'express-validator'

/**
 * Validation rules for chat message queries
 */
export const validateChatQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
]

/**
 * Validation rules for transcription segments
 */
export const validateSegment = [
  body('text').trim().isLength({ min: 1 }).withMessage('Text is required'),
  body('startTime').isNumeric().withMessage('Start time must be a number'),
  body('endTime').isNumeric().withMessage('End time must be a number'),
  body('speaker').optional().isObject().withMessage('Speaker must be an object'),
  body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1')
]

/**
 * Validation rules for transcription search
 */
export const validateSearch = [
  query('q').trim().isLength({ min: 1 }).withMessage('Search query is required'),
  query('speaker').optional().isString().withMessage('Speaker filter must be a string'),
  query('startTime').optional().isNumeric().withMessage('Start time must be a number'),
  query('endTime').optional().isNumeric().withMessage('End time must be a number')
]

/**
 * Validation rules for updating transcription segments
 */
export const validateSegmentUpdate = [
  body('text').optional().trim().isLength({ min: 1 }).withMessage('Text cannot be empty'),
  body('startTime').optional().isNumeric().withMessage('Start time must be a number'),
  body('endTime').optional().isNumeric().withMessage('End time must be a number')
]

/**
 * Validation rules for exporting transcriptions
 */
export const validateExport = [
  query('format').optional().isIn(['txt', 'json', 'srt']).withMessage('Format must be txt, json, or srt')
]
