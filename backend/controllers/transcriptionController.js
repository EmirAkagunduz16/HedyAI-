import Transcription from '../models/Transcription.js'
import Meeting from '../models/Meeting.js'
import { generateSegmentId } from '../utils/transcription.js'
import { formatTime, formatSRTTime } from '../utils/time.js'

export const getTranscription = async (req, res, next) => {
  try {
    const { meetingId } = req.params

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    let transcription = await Transcription.findOne({ meeting: meetingId })
      .populate('chatMessages.user', 'name email avatar')

    // If no transcription exists, return an empty one instead of 404
    if (!transcription) {
      transcription = {
        meeting: meetingId,
        segments: [],
        chatMessages: [],
        fullText: '',
        language: 'en-US',
        totalWords: 0,
        speakerCount: 0,
        avgConfidence: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    res.json({
      success: true,
      data: { transcription }
    })
  } catch (error) {
    next(error)
  }
}

export const getChatMessages = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    const transcription = await Transcription.findOne({ meeting: meetingId })
      .populate('chatMessages.user', 'name email avatar')

    if (!transcription) {
      return res.json({
        success: true,
        data: { 
          messages: [],
          pagination: { page, limit, total: 0, pages: 0 }
        }
      })
    }

    // Paginate chat messages
    const total = transcription.chatMessages.length
    const start = (page - 1) * limit
    const end = start + limit
    const messages = transcription.chatMessages.slice(start, end)

    res.json({
      success: true,
      data: {
        messages,
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

export const addSegment = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    const { text, startTime, endTime, speaker, confidence } = req.body

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Get or create transcription
    let transcription = await Transcription.findOne({ meeting: meetingId })
    if (!transcription) {
      transcription = await Transcription.create({
        meeting: meetingId,
        language: req.user.settings?.language || 'en-US'
      })
    }

    // Create segment
    const segment = {
      id: generateSegmentId(),
      text,
      startTime,
      endTime,
      speaker: speaker || { 
        id: req.user._id.toString(), 
        name: req.user.name,
        userId: req.user._id
      },
      confidence: confidence || 0.9
    }

    // Add segment
    transcription.segments.push(segment)
    
    // Update fullText and statistics
    transcription.fullText = transcription.segments.map(s => s.text).join(' ')
    transcription.totalWords = transcription.fullText.split(' ').length
    transcription.speakerCount = new Set(transcription.segments.map(s => s.speaker.id)).size
    transcription.avgConfidence = transcription.segments.reduce((sum, s) => sum + s.confidence, 0) / transcription.segments.length
    
    await transcription.save()

    res.status(201).json({
      success: true,
      message: 'Segment added successfully',
      data: { segment }
    })
  } catch (error) {
    next(error)
  }
}

export const searchSegments = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    const { q, speaker, startTime, endTime } = req.query

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    const transcription = await Transcription.findOne({ meeting: meetingId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'Transcription not found'
      })
    }

    // Search segments
    let results = transcription.segments.filter(segment => 
      new RegExp(q, 'i').test(segment.text)
    )

    // Apply filters
    if (speaker) {
      results = results.filter(segment => segment.speaker.id === speaker)
    }

    if (startTime && endTime) {
      results = results.filter(segment => 
        segment.startTime >= parseFloat(startTime) && 
        segment.endTime <= parseFloat(endTime)
      )
    }

    res.json({
      success: true,
      data: { 
        results,
        total: results.length,
        query: q
      }
    })
  } catch (error) {
    next(error)
  }
}

export const updateSegment = async (req, res, next) => {
  try {
    const { segmentId } = req.params
    const updates = req.body

    const transcription = await Transcription.findOne({ 'segments.id': segmentId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      })
    }

    // Check if user has access to the meeting
    const meeting = await Meeting.findById(transcription.meeting)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Find and update segment
    const segment = transcription.segments.find(s => s.id === segmentId)
    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      })
    }

    // Update segment properties
    Object.assign(segment, updates)
    
    // Update fullText and statistics
    transcription.fullText = transcription.segments.map(s => s.text).join(' ')
    transcription.totalWords = transcription.fullText.split(' ').length
    transcription.avgConfidence = transcription.segments.reduce((sum, s) => sum + s.confidence, 0) / transcription.segments.length
    
    await transcription.save()

    res.json({
      success: true,
      message: 'Segment updated successfully',
      data: { segment }
    })
  } catch (error) {
    next(error)
  }
}

export const deleteSegment = async (req, res, next) => {
  try {
    const { segmentId } = req.params

    const transcription = await Transcription.findOne({ 'segments.id': segmentId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      })
    }

    // Check if user has access to the meeting
    const meeting = await Meeting.findById(transcription.meeting)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Remove segment
    transcription.segments = transcription.segments.filter(s => s.id !== segmentId)
    
    // Update fullText and statistics
    transcription.fullText = transcription.segments.map(s => s.text).join(' ')
    transcription.totalWords = transcription.fullText.split(' ').length
    transcription.speakerCount = new Set(transcription.segments.map(s => s.speaker.id)).size
    transcription.avgConfidence = transcription.segments.length > 0 
      ? transcription.segments.reduce((sum, s) => sum + s.confidence, 0) / transcription.segments.length 
      : 0
    
    await transcription.save()

    res.json({
      success: true,
      message: 'Segment deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

export const exportTranscription = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    const format = req.query.format || 'txt'

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    const transcription = await Transcription.findOne({ meeting: meetingId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'Transcription not found'
      })
    }

    let exportData
    let contentType
    let filename

    switch (format) {
      case 'json':
        exportData = JSON.stringify(transcription, null, 2)
        contentType = 'application/json'
        filename = `meeting-${meetingId}-transcription.json`
        break
      
      case 'srt':
        exportData = convertToSRT(transcription.segments)
        contentType = 'text/plain'
        filename = `meeting-${meetingId}-transcription.srt`
        break
      
      default: // txt
        exportData = transcription.segments
          .map(segment => `[${formatTime(segment.startTime)}] ${segment.speaker.name}: ${segment.text}`)
          .join('\n\n')
        contentType = 'text/plain'
        filename = `meeting-${meetingId}-transcription.txt`
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(exportData)
  } catch (error) {
    next(error)
  }
}

export const rebuildFullText = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    const { fullText } = req.body

    console.log(`Rebuilding fullText for meeting ${meetingId}`)
    console.log(`Received fullText length: ${fullText?.length || 0}`)

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString())

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Get or create transcription
    let transcription = await Transcription.findOne({ meeting: meetingId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'Transcription not found'
      })
    }

    // Update fullText and recalculate statistics
    transcription.fullText = fullText || ''
    transcription.totalWords = fullText ? fullText.split(' ').filter(word => word.trim()).length : 0
    
    if (transcription.segments && transcription.segments.length > 0) {
      transcription.speakerCount = new Set(transcription.segments.map(s => s.speaker?.id).filter(Boolean)).size
      transcription.avgConfidence = transcription.segments.reduce((sum, s) => sum + (s.confidence || 0.9), 0) / transcription.segments.length
    } else {
      transcription.speakerCount = 0
      transcription.avgConfidence = 0
    }

    await transcription.save()

    console.log(`FullText rebuilt successfully:`, {
      meetingId,
      fullTextLength: transcription.fullText.length,
      totalWords: transcription.totalWords,
      speakerCount: transcription.speakerCount,
      segmentCount: transcription.segments.length
    })

    res.json({
      success: true,
      message: 'FullText rebuilt successfully',
      data: {
        fullTextLength: transcription.fullText.length,
        totalWords: transcription.totalWords,
        speakerCount: transcription.speakerCount,
        segmentCount: transcription.segments.length
      }
    })
  } catch (error) {
    console.error('Error rebuilding fullText:', error)
    next(error)
  }
}

// Helper function to convert segments to SRT format
function convertToSRT(segments) {
  return segments.map((segment, index) => {
    const startTime = formatSRTTime(segment.startTime)
    const endTime = formatSRTTime(segment.endTime)
    
    return `${index + 1}\n${startTime} --> ${endTime}\n${segment.speaker.name}: ${segment.text}\n`
  }).join('\n')
}
