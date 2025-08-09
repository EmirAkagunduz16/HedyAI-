import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.currentMeetingId = null
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace('/api', '') || 'http://localhost:5000'
    
    this.socket = io(backendUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    })

    this.setupDefaultListeners()
    return this.socket
  }

  setupDefaultListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Connected to server')
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      // Only show toast for non-connection related errors
      if (error.type !== 'TransportError' && error.type !== 'polling-error') {
        toast.error(error.message || 'Connection error')
      }
    })

    this.socket.on('connected', (data) => {
      console.log('Socket authentication successful:', data)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
      this.currentMeetingId = null
    }
  }

  isConnected() {
    return this.socket?.connected || false
  }

  // Meeting room methods
  joinMeeting(meetingId) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }
    
    // Prevent joining the same meeting multiple times
    if (this.currentMeetingId === meetingId) {
      console.log('Already joined meeting:', meetingId)
      return
    }
    
    this.currentMeetingId = meetingId
    this.socket.emit('join-meeting', { meetingId })
  }

  leaveMeeting(meetingId) {
    if (!this.socket) return
    
    this.socket.emit('leave-meeting', { meetingId })
    this.currentMeetingId = null
  }

  // Transcription methods
  sendTranscriptionSegment(meetingId, segment) {
    if (!this.socket) return
    
    this.socket.emit('transcription-segment', {
      meetingId,
      segment
    })
  }

  // Chat methods
  sendChatMessage(meetingId, message) {
    if (!this.socket) return
    
    this.socket.emit('chat-message', {
      meetingId,
      message
    })
  }

  // Recording methods
  updateRecordingStatus(meetingId, isRecording, isPaused = false) {
    if (!this.socket) return
    
    this.socket.emit('recording-status', {
      meetingId,
      isRecording,
      isPaused
    })
  }

  // Audio level for visualization
  sendAudioLevel(meetingId, level) {
    if (!this.socket) return
    
    this.socket.emit('audio-level', {
      meetingId,
      level
    })
  }

  // Participant status (mute/unmute, etc.)
  updateParticipantStatus(meetingId, status) {
    if (!this.socket) return
    
    this.socket.emit('participant-status', {
      meetingId,
      status
    })
  }

  // Event listener management
  on(event, callback) {
    if (!this.socket) return
    
    this.socket.on(event, callback)
    
    // Store listeners for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
  }

  off(event, callback) {
    if (!this.socket) return
    
    this.socket.off(event, callback)
    
    // Remove from listeners tracking
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  removeAllListeners(event) {
    if (!this.socket) return
    
    if (event) {
      this.socket.removeAllListeners(event)
      this.listeners.delete(event)
    } else {
      this.socket.removeAllListeners()
      this.listeners.clear()
    }
  }

  // Emit custom events
  emit(event, data) {
    if (!this.socket) return
    
    this.socket.emit(event, data)
  }
}

// Create singleton instance
const socketService = new SocketService()

// Meeting event handlers factory
export const createMeetingHandlers = (callbacks = {}) => {
  const handlers = {
    // Meeting events
    'meeting-joined': (data) => {
      console.log('Joined meeting:', data)
      callbacks.onMeetingJoined?.(data)
    },
    
    'participant-joined': (data) => {
      console.log('Participant joined:', data)
      toast.success(`${data.user.name} joined the meeting`)
      callbacks.onParticipantJoined?.(data)
    },
    
    'participant-left': (data) => {
      console.log('Participant left:', data)
      // react-hot-toast does not have toast.info; use neutral toast
      toast(`${data.user.name} left the meeting`)
      callbacks.onParticipantLeft?.(data)
    },

    // Transcription events
    'new-transcription-segment': (data) => {
      console.log('New transcription segment:', data)
      callbacks.onNewTranscriptionSegment?.(data)
    },

    // Chat events
    'new-chat-message': (data) => {
      console.log('New chat message:', data)
      callbacks.onNewChatMessage?.(data)
    },

    // Recording events
    'recording-status-changed': (data) => {
      console.log('Recording status changed:', data)
      const status = data.isRecording ? 'started' : 'stopped'
      toast(`Recording ${status}`)
      callbacks.onRecordingStatusChanged?.(data)
    },

    // Audio level events
    'participant-audio-level': (data) => {
      callbacks.onParticipantAudioLevel?.(data)
    },

    // Participant status events
    'participant-status-changed': (data) => {
      console.log('Participant status changed:', data)
      callbacks.onParticipantStatusChanged?.(data)
    }
  }

  return handlers
}

// Hook for React components
export const useSocket = () => {
  return {
    socket: socketService.socket,
    connect: socketService.connect.bind(socketService),
    disconnect: socketService.disconnect.bind(socketService),
    isConnected: socketService.isConnected.bind(socketService),
    joinMeeting: socketService.joinMeeting.bind(socketService),
    leaveMeeting: socketService.leaveMeeting.bind(socketService),
    sendTranscriptionSegment: socketService.sendTranscriptionSegment.bind(socketService),
    sendChatMessage: socketService.sendChatMessage.bind(socketService),
    updateRecordingStatus: socketService.updateRecordingStatus.bind(socketService),
    sendAudioLevel: socketService.sendAudioLevel.bind(socketService),
    updateParticipantStatus: socketService.updateParticipantStatus.bind(socketService),
    on: socketService.on.bind(socketService),
    off: socketService.off.bind(socketService),
    removeAllListeners: socketService.removeAllListeners.bind(socketService),
    emit: socketService.emit.bind(socketService)
  }
}

export default socketService
