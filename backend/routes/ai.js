import express from 'express'
import {
  transcribeAudio,
  askQuestion,
  generateSummary,
  getInsights
} from '../controllers/aiController.js'
import { checkValidation } from '../middleware/validation/index.js'
import {
  validateTranscription,
  validateQuestion
} from '../middleware/validation/aiValidation.js'

const router = express.Router()

// Routes
router.post('/transcribe', validateTranscription, checkValidation, transcribeAudio)
router.post('/ask', validateQuestion, checkValidation, askQuestion)
router.post('/summarize/:meetingId', generateSummary)
router.get('/insights/:meetingId', getInsights)

export default router