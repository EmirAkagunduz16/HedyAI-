import { body } from 'express-validator'

/**
 * Validation rules for audio transcription
 */
export const validateTranscription = [
  body('meetingId').isMongoId().withMessage('Valid meeting ID is required'),
  body('audioData').notEmpty().withMessage('Audio data is required'),
  body('speaker').optional().isObject().withMessage('Speaker must be an object')
]

/**
 * Validation rules for AI questions
 */
export const validateQuestion = [
  body('meetingId').isMongoId().withMessage('Valid meeting ID is required'),
  body('question').trim().isLength({ min: 1, max: 1000 }).withMessage('Question is required and must be less than 1000 characters')
]
