import Meeting from '../models/Meeting.js'
import Transcription from '../models/Transcription.js'
import { generateRoomId } from '../utils/meeting.js'
import { updateUserStats } from '../utils/user.js'

export const getMeetings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    const status = req.query.status
    const sortBy = req.query.sortBy || 'createdAt'
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1

    // Build filter
    const filter = {
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id },
        { 'sharedWith.user': req.user._id }
      ]
    }

    if (status) {
      filter.status = status
    }

    // Get meetings
    const meetings = await Meeting.find(filter)
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)

    // Get total count
    const total = await Meeting.countDocuments(filter)

    res.json({
      success: true,
      data: {
        meetings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

export const getMeetingById = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .populate('sharedWith.user', 'name email avatar')

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host._id.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user._id.toString() === req.user._id.toString()) ||
                      meeting.sharedWith.some(s => s.user._id.toString() === req.user._id.toString()) ||
                      meeting.isPublic

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.json({
      success: true,
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const createMeeting = async (req, res, next) => {
  try {
    const meetingData = {
      ...req.body,
      host: req.user._id,
      room: {
        id: generateRoomId()
      }
    }

    const meeting = await Meeting.create(meetingData)
    
    // Add host as participant
    meeting.participants.push({
      user: req.user._id,
      role: 'host',
      joinedAt: new Date()
    })
    await meeting.save()

    // Populate the meeting
    await meeting.populate('host', 'name email avatar')

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const updateMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check if user is host
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can update the meeting'
      })
    }

    // Update meeting
    Object.assign(meeting, req.body)
    await meeting.save()

    await meeting.populate('host', 'name email avatar')
    await meeting.populate('participants.user', 'name email avatar')

    res.json({
      success: true,
      message: 'Meeting updated successfully',
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check if user is host
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can delete the meeting'
      })
    }

    // Delete associated transcription
    await Transcription.deleteMany({ meeting: meeting._id })

    // Delete meeting
    await Meeting.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

export const startMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check if user is host
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can start the meeting'
      })
    }

    if (meeting.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is already live'
      })
    }

    // Update meeting status
    meeting.status = 'live'
    meeting.startedAt = new Date()
    await meeting.save()

    // Create transcription document
    const transcription = await Transcription.create({
      meeting: meeting._id,
      language: req.user.settings?.language || 'en-US'
    })

    res.json({
      success: true,
      message: 'Meeting started successfully',
      data: { 
        meeting,
        transcriptionId: transcription._id
      }
    })
  } catch (error) {
    next(error)
  }
}

export const endMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check if user is host
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can end the meeting'
      })
    }

    if (meeting.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is not live'
      })
    }

    // Update meeting status
    meeting.status = 'completed'
    meeting.endedAt = new Date()
    
    // Calculate duration
    if (meeting.startedAt) {
      meeting.duration = Math.floor((meeting.endedAt - meeting.startedAt) / 1000)
    }
    
    await meeting.save()

    // Update user stats
    await updateUserStats(req.user._id, 'meeting', 1)
    await updateUserStats(req.user._id, 'recordingTime', meeting.duration)

    res.json({
      success: true,
      message: 'Meeting ended successfully',
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const joinMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot join a completed or cancelled meeting'
      })
    }

    // Check if meeting is locked
    if (meeting.room?.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Meeting room is locked'
      })
    }

    // Check max participants
    const activeParticipants = meeting.participants.filter(p => !p.leftAt).length
    if (activeParticipants >= (meeting.settings?.maxParticipants || 50)) {
      return res.status(400).json({
        success: false,
        message: 'Meeting has reached maximum participants'
      })
    }

    // Add participant if not already in meeting
    const existingParticipant = meeting.participants.find(p => 
      p.user.toString() === req.user._id.toString()
    )

    if (!existingParticipant) {
      meeting.participants.push({
        user: req.user._id,
        role: 'participant',
        joinedAt: new Date()
      })
      await meeting.save()
    }

    await meeting.populate('host', 'name email avatar')
    await meeting.populate('participants.user', 'name email avatar')

    res.json({
      success: true,
      message: 'Joined meeting successfully',
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const leaveMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Mark participant as left
    const participant = meeting.participants.find(p => 
      p.user.toString() === req.user._id.toString()
    )

    if (participant) {
      participant.leftAt = new Date()
      await meeting.save()
    }

    res.json({
      success: true,
      message: 'Left meeting successfully'
    })
  } catch (error) {
    next(error)
  }
}

export const getMeetingByRoomId = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ 'room.id': req.params.roomId })
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name email avatar')

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting room not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host._id.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user._id.toString() === req.user._id.toString()) ||
                      meeting.sharedWith.some(s => s.user._id.toString() === req.user._id.toString()) ||
                      meeting.isPublic

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.json({
      success: true,
      data: { meeting }
    })
  } catch (error) {
    next(error)
  }
}

export const getMeetingAnalytics = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host._id.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user._id.toString() === req.user._id.toString()) ||
                      meeting.sharedWith.some(s => s.user._id.toString() === req.user._id.toString()) ||
                      meeting.isPublic

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Get transcription for additional analytics
    const transcription = await Transcription.findOne({ meeting: meeting._id })

    const analytics = {
      meeting: {
        duration: meeting.duration,
        participantCount: meeting.participants.length,
        status: meeting.status
      },
      transcription: transcription ? {
        totalWords: transcription.totalWords || 0,
        totalSpeakers: transcription.speakerCount || 0,
        averageConfidence: transcription.avgConfidence || 0
      } : null,
      engagement: {
        views: meeting.analytics?.views || 0,
        downloads: meeting.analytics?.downloads || 0,
        shares: meeting.analytics?.shares || 0,
        chatMessages: meeting.analytics?.chatMessages || 0
      }
    }

    res.json({
      success: true,
      data: { analytics }
    })
  } catch (error) {
    next(error)
  }
}
