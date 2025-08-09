import express from 'express'
import {
  getTranscription,
  getChatMessages,
  addSegment,
  searchSegments,
  updateSegment,
  deleteSegment,
  exportTranscription,
  rebuildFullText
} from '../controllers/transcriptionController.js'
import { checkValidation } from '../middleware/validation/index.js'
import {
  validateChatQuery,
  validateSegment,
  validateSearch,
  validateSegmentUpdate,
  validateExport
} from '../middleware/validation/transcriptionValidation.js'

const router = express.Router()

// Routes
router.get('/meeting/:meetingId', getTranscription)
router.get('/meeting/:meetingId/chat', validateChatQuery, checkValidation, getChatMessages)
router.get('/meeting/:meetingId/search', validateSearch, checkValidation, searchSegments)
router.get('/meeting/:meetingId/export', validateExport, checkValidation, exportTranscription)
router.post('/meeting/:meetingId/segments', validateSegment, checkValidation, addSegment)
router.post('/meeting/:meetingId/rebuild', rebuildFullText)
router.put('/segments/:segmentId', validateSegmentUpdate, checkValidation, updateSegment)
router.delete('/segments/:segmentId', deleteSegment)

export default router