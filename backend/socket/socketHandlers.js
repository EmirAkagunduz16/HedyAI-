import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Meeting from '../models/Meeting.js'
import Transcription from '../models/Transcription.js'
import { 
  canUserAccessMeeting, 
  addParticipantToMeeting, 
  removeParticipantFromMeeting 
} from '../utils/meeting.js'
import { 
  addSegmentToTranscription, 
  addChatMessageToTranscription 
} from '../utils/transcription.js'

// Store active connections
const activeConnections = new Map()
const meetingRooms = new Map()

export const setupSocketHandlers = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      
      if (!user) {
        return next(new Error('User not found'))
      }

      socket.userId = user._id.toString()
      socket.user = user
      next()
    } catch (error) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected (${socket.userId})`)
    
    // Store active connection
    activeConnections.set(socket.userId, socket)

    // Handle joining a meeting room
    socket.on('join-meeting', async (data) => {
      try {
        const { meetingId } = data
        
        // Validate meeting access
        const meeting = await Meeting.findById(meetingId)
        if (!meeting) {
          socket.emit('error', { message: 'Meeting not found' })
          return
        }

        if (!canUserAccessMeeting(meeting, socket.userId)) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Join socket room
        socket.join(`meeting-${meetingId}`)
        socket.currentMeetingId = meetingId
        console.log(`User ${socket.user.name} set currentMeetingId to: ${meetingId}`)

        // Add to meeting room tracking
        if (!meetingRooms.has(meetingId)) {
          meetingRooms.set(meetingId, new Set())
        }
        meetingRooms.get(meetingId).add(socket.userId)

        // Add participant to meeting
        await addParticipantToMeeting(meeting, socket.userId)

        // Notify other participants
        socket.to(`meeting-${meetingId}`).emit('participant-joined', {
          user: {
            id: socket.userId,
            name: socket.user.name,
            avatar: socket.user.avatar
          },
          timestamp: new Date()
        })

        // Send current participants list
        const participants = Array.from(meetingRooms.get(meetingId)).map(userId => {
          const userSocket = activeConnections.get(userId)
          return userSocket ? {
            id: userId,
            name: userSocket.user.name,
            avatar: userSocket.user.avatar
          } : null
        }).filter(Boolean)

        socket.emit('meeting-joined', {
          meetingId,
          participants,
          meeting: {
            id: meeting._id,
            title: meeting.title,
            status: meeting.status,
            host: meeting.host
          }
        })

        console.log(`User ${socket.user.name} joined meeting ${meetingId}`)
      } catch (error) {
        console.error('Error joining meeting:', error)
        socket.emit('error', { message: 'Failed to join meeting' })
      }
    })

    // Handle leaving a meeting room
    socket.on('leave-meeting', async (data) => {
      try {
        const { meetingId } = data
        
        if (socket.currentMeetingId === meetingId) {
          await handleLeaveMeeting(socket, meetingId)
        }
      } catch (error) {
        console.error('Error leaving meeting:', error)
        socket.emit('error', { message: 'Failed to leave meeting' })
      }
    })

    // Handle real-time transcription
    socket.on('transcription-segment', async (data) => {
      try {
        const { meetingId, segment } = data
        
        if (socket.currentMeetingId !== meetingId) {
          socket.emit('error', { message: 'Not in this meeting' })
          return
        }

        // Validate meeting access
        const meeting = await Meeting.findById(meetingId)
        if (!meeting || !canUserAccessMeeting(meeting, socket.userId)) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Get or create transcription
        let transcription = await Transcription.findOne({ meeting: meetingId })
        if (!transcription) {
          transcription = await Transcription.create({
            meeting: meetingId,
            language: socket.user.settings?.language || 'en-US'
          })
        }

        // Add segment with user info
        const newSegment = addSegmentToTranscription(transcription, {
          ...segment,
          speaker: {
            id: socket.userId,
            name: socket.user.name,
            userId: socket.userId
          }
        })

        // Ensure fullText is updated for AI summary generation
        transcription.fullText = transcription.segments.map(s => s.text).join(' ')
        
        // Update word count and other stats
        transcription.totalWords = transcription.fullText.split(' ').filter(word => word.trim()).length
        transcription.speakerCount = new Set(transcription.segments.map(s => s.speaker.id)).size
        transcription.avgConfidence = transcription.segments.reduce((sum, s) => sum + (s.confidence || 0.9), 0) / transcription.segments.length

        await transcription.save()
        console.log(`Transcription updated. FullText length: ${transcription.fullText.length}, Total words: ${transcription.totalWords}`)

        // Broadcast to all participants in the meeting
        io.to(`meeting-${meetingId}`).emit('new-transcription-segment', {
          segment: newSegment,
          timestamp: new Date()
        })

        console.log(`New transcription segment from ${socket.user.name} in meeting ${meetingId}`)
      } catch (error) {
        console.error('Error processing transcription segment:', error)
        socket.emit('error', { message: 'Failed to process transcription' })
      }
    })

    // Handle chat messages
    socket.on('chat-message', async (data) => {
      try {
        console.log(`Chat message received from ${socket.user.name}:`, data)
        const { meetingId, message } = data
        
        if (!meetingId || !message) {
          console.error('Invalid chat message data:', data)
          socket.emit('error', { message: 'Invalid message data' })
          return
        }

        if (socket.currentMeetingId !== meetingId) {
          console.warn(`User ${socket.userId} not in meeting ${meetingId}, current: ${socket.currentMeetingId}`)
          socket.emit('error', { message: 'Not in this meeting' })
          return
        }

        // Validate meeting access
        const meeting = await Meeting.findById(meetingId)
        if (!meeting) {
          console.error(`Meeting ${meetingId} not found`)
          socket.emit('error', { message: 'Meeting not found' })
          return
        }

        if (!canUserAccessMeeting(meeting, socket.userId)) {
          console.warn(`User ${socket.userId} access denied to meeting ${meetingId}`)
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Get transcription
        let transcription = await Transcription.findOne({ meeting: meetingId })
        if (!transcription) {
          transcription = await Transcription.create({
            meeting: meetingId,
            language: socket.user.settings?.language || 'en-US'
          })
        }

        // Add chat message
        const chatMessage = addChatMessageToTranscription(transcription, socket.userId, message, 'user')
        await transcription.save()

        // Update meeting analytics
        if (!meeting.analytics) {
          meeting.analytics = { chatMessages: 0 }
        }
        if (typeof meeting.analytics.chatMessages !== 'number') {
          meeting.analytics.chatMessages = 0
        }
        meeting.analytics.chatMessages += 1
        await meeting.save()

        // Broadcast to all participants
        io.to(`meeting-${meetingId}`).emit('new-chat-message', {
          message: {
            id: chatMessage._id || chatMessage.id,
            message: chatMessage.message,
            type: chatMessage.type,
            timestamp: chatMessage.timestamp,
            user: {
              id: socket.userId,
              name: socket.user.name,
              avatar: socket.user.avatar
            }
          },
          timestamp: new Date()
        })

        console.log(`New chat message from ${socket.user.name} in meeting ${meetingId}`)
        
        // Send acknowledgment back to sender
        socket.emit('message-sent', { 
          messageId: chatMessage._id,
          timestamp: new Date() 
        })
      } catch (error) {
        console.error('Error processing chat message:', error)
        socket.emit('error', { message: 'Failed to send message', details: error.message })
      }
    })

    // Handle recording status updates
    socket.on('recording-status', async (data) => {
      try {
        const { meetingId, isRecording, isPaused } = data
        
        if (socket.currentMeetingId !== meetingId) {
          socket.emit('error', { message: 'Not in this meeting' })
          return
        }

        // Validate meeting and host permissions
        const meeting = await Meeting.findById(meetingId)
        if (!meeting) {
          socket.emit('error', { message: 'Meeting not found' })
          return
        }

        if (meeting.host.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only host can control recording' })
          return
        }

        // Update recording status
        meeting.recording.isRecorded = isRecording
        await meeting.save()

        // Broadcast recording status to all participants
        io.to(`meeting-${meetingId}`).emit('recording-status-changed', {
          isRecording,
          isPaused,
          timestamp: new Date()
        })

        console.log(`Recording status changed by ${socket.user.name} in meeting ${meetingId}: ${isRecording ? 'started' : 'stopped'}`)
      } catch (error) {
        console.error('Error updating recording status:', error)
        socket.emit('error', { message: 'Failed to update recording status' })
      }
    })

    // Handle audio level updates (for visualization)
    socket.on('audio-level', (data) => {
      const { meetingId, level } = data
      
      if (socket.currentMeetingId === meetingId) {
        // Broadcast audio level to other participants (excluding sender)
        socket.to(`meeting-${meetingId}`).emit('participant-audio-level', {
          userId: socket.userId,
          level,
          timestamp: Date.now()
        })
      }
    })

    // Handle participant status updates (mute/unmute, video on/off)
    socket.on('participant-status', (data) => {
      const { meetingId, status } = data
      
      if (socket.currentMeetingId === meetingId) {
        // Broadcast status to other participants
        socket.to(`meeting-${meetingId}`).emit('participant-status-changed', {
          userId: socket.userId,
          status,
          timestamp: new Date()
        })
      }
    })

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.name} disconnected (${socket.userId})`)
      
      // Remove from active connections
      activeConnections.delete(socket.userId)

      // Handle leaving current meeting
      if (socket.currentMeetingId) {
        await handleLeaveMeeting(socket, socket.currentMeetingId)
      }
    })

    // Send initial connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      user: {
        id: socket.userId,
        name: socket.user.name,
        avatar: socket.user.avatar
      },
      timestamp: new Date()
    })
  })
}

// Helper function to handle leaving a meeting
async function handleLeaveMeeting(socket, meetingId) {
  try {
    // Leave socket room
    socket.leave(`meeting-${meetingId}`)

    // Remove from meeting room tracking
    if (meetingRooms.has(meetingId)) {
      meetingRooms.get(meetingId).delete(socket.userId)
      
      // Clean up empty meeting rooms
      if (meetingRooms.get(meetingId).size === 0) {
        meetingRooms.delete(meetingId)
      }
    }

    // Update meeting participant status
    const meeting = await Meeting.findById(meetingId)
    if (meeting) {
      await removeParticipantFromMeeting(meeting, socket.userId)
    }

    // Notify other participants
    socket.to(`meeting-${meetingId}`).emit('participant-left', {
      user: {
        id: socket.userId,
        name: socket.user.name,
        avatar: socket.user.avatar
      },
      timestamp: new Date()
    })

    socket.currentMeetingId = null
    console.log(`User ${socket.user.name} left meeting ${meetingId}`)
  } catch (error) {
    console.error('Error handling leave meeting:', error)
  }
}

// Helper function to get meeting participants
export function getMeetingParticipants(meetingId) {
  if (!meetingRooms.has(meetingId)) {
    return []
  }

  return Array.from(meetingRooms.get(meetingId)).map(userId => {
    const socket = activeConnections.get(userId)
    return socket ? {
      id: userId,
      name: socket.user.name,
      avatar: socket.user.avatar,
      isOnline: true
    } : null
  }).filter(Boolean)
}

// Helper function to broadcast to meeting
export function broadcastToMeeting(meetingId, event, data) {
  if (meetingRooms.has(meetingId)) {
    const participants = Array.from(meetingRooms.get(meetingId))
    participants.forEach(userId => {
      const socket = activeConnections.get(userId)
      if (socket) {
        socket.emit(event, data)
      }
    })
  }
}
