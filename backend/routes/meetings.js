import express from 'express'
import {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  startMeeting,
  endMeeting,
  joinMeeting,
  leaveMeeting,
  getMeetingByRoomId,
  getMeetingAnalytics
} from '../controllers/meetingController.js'
import { checkValidation } from '../middleware/validation/index.js'
import {
  validateQuery,
  validateCreateMeeting,
  validateUpdateMeeting
} from '../middleware/validation/meetingValidation.js'

const router = express.Router()

// Routes
router.get('/', validateQuery, checkValidation, getMeetings)
router.get('/room/:roomId', getMeetingByRoomId)
router.get('/:id', getMeetingById)
router.get('/:id/analytics', getMeetingAnalytics)
router.post('/', validateCreateMeeting, checkValidation, createMeeting)
router.post('/:id/start', startMeeting)
router.post('/:id/end', endMeeting)
router.post('/:id/join', joinMeeting)
router.post('/:id/leave', leaveMeeting)
router.put('/:id', validateUpdateMeeting, checkValidation, updateMeeting)
router.delete('/:id', deleteMeeting)

export default router