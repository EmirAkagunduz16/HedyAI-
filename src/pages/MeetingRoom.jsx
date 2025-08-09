import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Mic, 
  MicOff, 
  Square, 
  Pause, 
  Play,
  Settings,
  Users,
  MessageSquare,
  Send,
  Download,
  Share2,
  Volume2,
  VolumeX,
  Clock,
  Maximize2,
  Minimize2
} from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { meetingsAPI, transcriptionsAPI, aiAPI } from '../services/api'
import { useSocket, createMeetingHandlers } from '../services/socket'
import AudioRecordingService, { AudioUtils } from '../services/audioRecording'
import WebSpeechService from '../services/webSpeech'
import toast from 'react-hot-toast'

const MeetingRoom = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const socket = useSocket()
  
  // Component states
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  
  // Transcription states
  const [transcription, setTranscription] = useState([])
  const [transcriptionData, setTranscriptionData] = useState(null)
  const [transcriptionLoading, setTranscriptionLoading] = useState(false)
  
  // Chat states
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isAITyping, setIsAITyping] = useState(false)
  
  // Participants states
  const [participants, setParticipants] = useState([])
  
  // UI states
  const [activeTab, setActiveTab] = useState('transcription')
  const [isMuted, setIsMuted] = useState(false)
  
  // Refs
  const audioRecordingRef = useRef(null)
  const webSpeechRef = useRef(null)
  const transcriptionRef = useRef(null)
  const durationIntervalRef = useRef(null)
  // Run-once and concurrency guards (helps under React StrictMode)
  const initializedRef = useRef(false)
  const loadingMeetingRef = useRef(false)
  const creatingMeetingRef = useRef(false)

  // Initialize meeting and socket connections
  useEffect(() => {
    // Prevent double-run in React StrictMode
    if (initializedRef.current) return
    initializedRef.current = true

    if (id) {
      loadMeeting()
    } else {
      // Create new meeting
      createNewMeeting()
    }

    return () => {
      // Cleanup on unmount
      if (audioRecordingRef.current) {
        audioRecordingRef.current.destroy()
      }
      if (socket.isConnected() && meeting?._id) {
        socket.leaveMeeting(meeting._id)
      }
    }
  }, [id])

  // Set up socket event handlers
  useEffect(() => {
    if (meeting?._id && socket.isConnected()) {
      const handlers = createMeetingHandlers({
        onMeetingJoined: (data) => {
          setParticipants(data.participants)
          // Only load transcription once when first joining
          if (!transcriptionData) {
            loadTranscription()
          }
        },
        onParticipantJoined: (data) => {
          setParticipants(prev => [...prev, data.user])
        },
        onParticipantLeft: (data) => {
          setParticipants(prev => prev.filter(p => p.id !== data.user.id))
        },
        onNewTranscriptionSegment: (data) => {
          setTranscription(prev => [...prev, data.segment])
        },
        onNewChatMessage: (data) => {
          setChatMessages(prev => [...prev, data.message])
        },
        onRecordingStatusChanged: (data) => {
          // Update recording status from host
          if (data.isRecording !== isRecording) {
            setIsRecording(data.isRecording)
            setIsPaused(data.isPaused)
          }
        }
      })

      // Register event handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler)
      })

      // Join meeting room only once
      socket.joinMeeting(meeting._id)

      return () => {
        // Clean up event handlers
        Object.keys(handlers).forEach(event => {
          socket.removeAllListeners(event)
        })
      }
    }
  }, [meeting?._id]) // Only depend on meeting ID, not the entire socket object

  // Update duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [isRecording, isPaused])

  // Auto-scroll transcription
  useEffect(() => {
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight
    }
  }, [transcription])

  const loadMeeting = async () => {
    if (loadingMeetingRef.current) return
    try {
      loadingMeetingRef.current = true
      setLoading(true)
      const response = await meetingsAPI.getMeeting(id)
      
      if (response.success) {
        setMeeting(response.data.meeting)
        
        // Connect to socket if not already connected
        if (!socket.isConnected()) {
          const token = localStorage.getItem('token')
          if (token) {
            socket.connect(token)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load meeting:', error)
      toast.error('Failed to load meeting')
      navigate('/dashboard')
    } finally {
      loadingMeetingRef.current = false
      setLoading(false)
    }
  }

  const createNewMeeting = async () => {
    if (creatingMeetingRef.current) return
    try {
      creatingMeetingRef.current = true
      setLoading(true)
      const response = await meetingsAPI.createMeeting({
        title: `${user.name}'s Meeting`,
        description: 'Real-time meeting with transcription'
      })
      
      if (response.success) {
        setMeeting(response.data.meeting)
        navigate(`/meeting/${response.data.meeting._id}`, { replace: true })
      }
    } catch (error) {
      console.error('Failed to create meeting:', error)
      toast.error('Failed to create meeting')
      navigate('/dashboard')
    } finally {
      creatingMeetingRef.current = false
      setLoading(false)
    }
  }

  const loadTranscription = async () => {
    // Prevent multiple simultaneous calls
    if (transcriptionLoading || !meeting?._id) {
      return
    }

    try {
      setTranscriptionLoading(true)
      const response = await transcriptionsAPI.getTranscription(meeting._id)
      if (response.success) {
        setTranscriptionData(response.data.transcription)
        setTranscription(response.data.transcription.segments || [])
        setChatMessages(response.data.transcription.chatMessages || [])
      }
    } catch (error) {
      // For 404 errors (no transcription yet), just set empty state
      if (error.response?.status === 404) {
        setTranscriptionData(null)
        setTranscription([])
        setChatMessages([])
      } else {
        console.error('Failed to load transcription:', error)
      }
    } finally {
      setTranscriptionLoading(false)
    }
  }

  const initializeAudioRecording = async () => {
    try {
      if (!audioRecordingRef.current) {
        audioRecordingRef.current = new AudioRecordingService()
      }

      await audioRecordingRef.current.initialize()

      // Set up audio data handler
      audioRecordingRef.current.onDataAvailable = async (audioData) => {
        try {
          // Process audio chunk with AI
          console.log('Processing audio chunk...')
          const result = await audioRecordingRef.current.processAudioChunk(
            audioData, 
            meeting._id, 
            { id: user.id, name: user.name }
          )
          
          // Handle the response
          if (result && result.data && result.data.segment) {
            const segment = result.data.segment
            console.log('Transcription received:', segment.text)
            
            // Send to socket for real-time updates
            socket.sendTranscriptionSegment(meeting._id, segment)
          } else {
            console.log('No speech detected in audio chunk')
          }
        } catch (error) {
          console.error('Failed to process audio chunk:', error)
          // Don't show error to user as this is expected to happen sometimes
        }
      }

      // Set up audio level handler
      audioRecordingRef.current.onAudioLevel = (level) => {
        setAudioLevel(level)
        socket.sendAudioLevel(meeting._id, level)
      }

      return true
    } catch (error) {
      console.error('Failed to initialize audio recording:', error)
      throw error
    }
  }

  const startRecording = async () => {
    try {
      // Check if user is host
      if (meeting.host._id !== user.id) {
        toast.error('Only the host can start recording')
        return
      }

      await initializeAudioRecording()
      await audioRecordingRef.current.startRecording()

      // Start Web Speech API for instant on-screen text (best-effort)
      if (!webSpeechRef.current) webSpeechRef.current = new WebSpeechService()
      if (webSpeechRef.current.isSupported) {
        webSpeechRef.current.onResult = ({ text, isFinal }) => {
          if (!text) return
          // Render immediate transcript locally, tag it clearly
          const segment = {
            id: `local_${Date.now()}`,
            text,
            startTime: Date.now() / 1000,
            endTime: Date.now() / 1000,
            speaker: { id: user.id, name: user.name },
            confidence: 0.85
          }
          setTranscription((prev) => [...prev, segment])
        }
        webSpeechRef.current.start('en-US')
      }
      
      // Start meeting if not already started
      if (meeting.status !== 'live') {
        await meetingsAPI.startMeeting(meeting._id)
      }

      setIsRecording(true)
      setIsPaused(false)
      setDuration(0)
      
      // Notify other participants via socket
      socket.updateRecordingStatus(meeting._id, true, false)
      
      toast.success('Recording started!')
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Failed to start recording. Please check microphone permissions.')
    }
  }

  const pauseRecording = () => {
    if (audioRecordingRef.current && isRecording) {
      audioRecordingRef.current.pauseRecording()
      setIsPaused(true)
      socket.updateRecordingStatus(meeting._id, true, true)
      toast.success('Recording paused')
    }
  }

  const resumeRecording = () => {
    if (audioRecordingRef.current && isRecording) {
      audioRecordingRef.current.resumeRecording()
      setIsPaused(false)
      socket.updateRecordingStatus(meeting._id, true, false)
      toast.success('Recording resumed')
    }
  }

  const stopRecording = async () => {
    try {
      if (audioRecordingRef.current) {
        audioRecordingRef.current.stopRecording()
      }
      if (webSpeechRef.current) {
        webSpeechRef.current.stop()
      }
      
      setIsRecording(false)
      setIsPaused(false)
      setAudioLevel(0)
      
      // End meeting
      if (meeting.status === 'live') {
        await meetingsAPI.endMeeting(meeting._id)
      }
      
      // Notify other participants via socket
      socket.updateRecordingStatus(meeting._id, false, false)
      
      toast.success('Recording stopped and saved!')
    } catch (error) {
      console.error('Error stopping recording:', error)
      toast.error('Failed to stop recording')
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      // Send message via socket for real-time updates
      socket.sendChatMessage(meeting._id, newMessage.trim())
      
      // Also ask AI if it's a question
      if (newMessage.includes('?')) {
        setIsAITyping(true)
        try {
          const response = await aiAPI.askQuestion(meeting._id, newMessage.trim())
          if (response.success) {
            // AI response will come through socket
          }
        } catch (error) {
          console.error('AI question failed:', error)
        } finally {
          setIsAITyping(false)
        }
      }
      
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    }
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meeting...</p>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Meeting not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {meeting.title}
            </h1>
            <p className="text-gray-600">
              {meeting.description || 'Live recording and transcription'} • 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                meeting.status === 'live' ? 'bg-red-100 text-red-800' :
                meeting.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button className="btn btn-secondary">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </button>
            <button className="btn btn-secondary">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Recording Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recording Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <div className="text-center">
                {/* Audio Visualization */}
                <div className="mb-6">
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-gray-200"></div>
                    <div 
                      className={`absolute inset-0 rounded-full transition-all duration-300 ${
                        isRecording ? 'bg-red-500' : 'bg-gray-400'
                      }`}
                      style={{
                        transform: `scale(${1 + audioLevel * 0.3})`,
                        opacity: isRecording ? 0.8 + audioLevel * 0.2 : 0.5
                      }}
                    ></div>
                    <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
                      {isRecording ? (
                        isPaused ? (
                          <Play className="h-8 w-8 text-gray-600" />
                        ) : (
                          <Mic className="h-8 w-8 text-red-500" />
                        )
                      ) : (
                        <MicOff className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration Display */}
                <div className="mb-6">
                  <div className="flex items-center justify-center text-3xl font-mono font-bold text-gray-900">
                    <Clock className="h-6 w-6 mr-2" />
                    {formatDuration(duration)}
                  </div>
                  {isRecording && (
                    <div className="flex items-center justify-center mt-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                      <span className="text-sm text-red-600 font-medium">
                        {isPaused ? 'Paused' : 'Recording'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center space-x-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="btn btn-primary px-8 py-3 text-lg"
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      Start Recording
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={isPaused ? resumeRecording : pauseRecording}
                        className="btn btn-secondary p-3"
                      >
                        {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={stopRecording}
                        className="btn bg-red-600 hover:bg-red-700 text-white p-3"
                      >
                        <Square className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`btn p-3 ${isMuted ? 'bg-red-100 text-red-600' : 'btn-secondary'}`}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Transcription Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6 pt-4">
                  <button
                    onClick={() => setActiveTab('transcription')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'transcription'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Live Transcription
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'summary'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    AI Summary
                  </button>
                </nav>
              </div>

              {/* Content */}
              <div className="p-6">
                {activeTab === 'transcription' ? (
                  <div 
                    ref={transcriptionRef}
                    className="h-96 overflow-y-auto space-y-4"
                  >
                    {transcription.length === 0 ? (
                      <div className="text-center text-gray-500 py-16">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{isRecording ? 'Listening for speech...' : 'Start recording to see live transcription'}</p>
                      </div>
                    ) : (
                      transcription.map((entry, index) => (
                        <motion.div
                          key={`${entry.id || 'segment'}-${index}-${entry.startTime || Date.now()}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border-l-4 border-primary-500 pl-4 py-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {entry.speaker?.name || 'Unknown Speaker'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.startTime * 1000).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-700">{entry.text}</p>
                          <div className="mt-1">
                            <span className="text-xs text-gray-400">
                              Confidence: {Math.round((entry.confidence || 0.9) * 100)}%
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>AI summary will be generated after recording</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="card h-full flex flex-col"
            >
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  AI Assistant
                </h3>
                <p className="text-sm text-gray-600">Ask questions about the meeting</p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-96">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>Ask questions about the transcription</p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={`${message.id || message._id || 'msg'}-${index}-${message.timestamp || Date.now()}`}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.type === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        {message.type === 'ai' && (
                          <p className="text-xs opacity-75 mb-1">
                            AI Assistant
                          </p>
                        )}
                        <p>{message.message || message.text}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                
                {isAITyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 px-3 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask about the meeting..."
                    className="flex-1 input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="btn btn-primary p-2"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetingRoom

