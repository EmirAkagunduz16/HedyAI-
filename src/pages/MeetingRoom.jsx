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
  // Maintain a single growing line per current speaker (in-place update)
  const [currentSpeakerId, setCurrentSpeakerId] = useState(null)
  
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
          setTranscription(prev => {
            const newSegment = data.segment
            
            // If no previous segments, add the first one
            if (prev.length === 0) {
              setCurrentSpeakerId(newSegment.speaker?.id || null)
              return [newSegment]
            }
            
            const lastSegment = prev[prev.length - 1]
            const sameSpeaker = lastSegment.speaker?.id === newSegment.speaker?.id
            
            // If same speaker and the new text appears to be an extension/correction
            if (sameSpeaker) {
              // Check if new text is already contained in the last segment (avoid duplicates)
              const lastText = lastSegment.text.toLowerCase().trim()
              const newText = newSegment.text.toLowerCase().trim()
              
              // If new text is completely contained in last text, ignore it
              if (lastText.includes(newText)) {
                return prev
              }
              
              // If last text is contained in new text, replace it (correction/completion)
              if (newText.includes(lastText)) {
                const updated = {
                  ...lastSegment,
                  text: newSegment.text.trim(),
                  endTime: newSegment.endTime,
                  confidence: newSegment.confidence || lastSegment.confidence
                }
                return [...prev.slice(0, -1), updated]
              }
              
              // Otherwise, append new content (avoiding word duplication)
              const words1 = lastText.split(/\s+/)
              const words2 = newText.split(/\s+/)
              
              // Find overlap between end of first and start of second
              let overlapLength = 0
              for (let i = 1; i <= Math.min(words1.length, words2.length); i++) {
                const ending = words1.slice(-i).join(' ')
                const beginning = words2.slice(0, i).join(' ')
                if (ending === beginning) {
                  overlapLength = i
                }
              }
              
              // Combine texts without duplication
              const remainingWords = words2.slice(overlapLength)
              const combinedText = remainingWords.length > 0 
                ? `${lastSegment.text} ${remainingWords.join(' ')}`.trim()
                : lastSegment.text
              
              const updated = {
                ...lastSegment,
                text: combinedText,
                endTime: newSegment.endTime,
                confidence: Math.max(lastSegment.confidence || 0, newSegment.confidence || 0)
              }
              return [...prev.slice(0, -1), updated]
            }
            
            // Different speaker: add new segment
            setCurrentSpeakerId(newSegment.speaker?.id || null)
            return [...prev, newSegment]
          })
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
        },
        onMessageSent: (data) => {
          console.log('Message sent successfully:', data)
          // Message was sent successfully - no need for user feedback since it's expected
        },
        onSocketError: (error) => {
          console.error('Socket error in meeting:', error)
          if (error.message && error.message !== 'Failed to send message') {
            toast.error(error.message)
          }
        }
      })

      // Register event handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler)
      })

      // Join meeting room only once, with retry logic
      try {
        console.log('Attempting to join meeting:', meeting._id)
        socket.joinMeeting(meeting._id)
        
        // Wait a moment and verify connection
        setTimeout(() => {
          if (!socket.isConnected()) {
            console.warn('Socket disconnected, attempting reconnection...')
            const token = localStorage.getItem('token')
            if (token) {
              socket.connect(token)
              setTimeout(() => socket.joinMeeting(meeting._id), 1000)
            }
          }
        }, 2000)
      } catch (error) {
        console.error('Error joining meeting:', error)
        toast.error('Failed to join meeting room')
      }

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
            // Send to socket for real-time updates
            socket.sendTranscriptionSegment(meeting._id, segment)
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
        let lastInterimText = ''
        let speechRestartTimer = null
        
        // Auto-restart Web Speech API if it stops
        const startSpeechRecognition = () => {
          try {
            webSpeechRef.current.start('en-US')
            console.log('Web Speech API started')
          } catch (error) {
            console.warn('Failed to start Web Speech API:', error)
          }
        }
        
        webSpeechRef.current.onResult = ({ text, isFinal }) => {
          if (!text) return
          
          // Only update if this is a final result or significantly different from last interim
          if (isFinal || text !== lastInterimText) {
            setTranscription((prev) => {
              // Check if we should create a new segment or update existing
              if (prev.length === 0 || 
                  prev[prev.length - 1].speaker?.id !== user.id ||
                  !prev[prev.length - 1].text.includes('[live]')) {
                // Create new segment for Web Speech interim results
                return [
                  ...prev.filter(seg => !seg.text.includes('[live]')), // Remove any existing live segments
                  {
                    id: `webspeech_${Date.now()}`,
                    text: isFinal ? text.trim() : `${text.trim()} [live]`,
                    startTime: Date.now() / 1000,
                    endTime: Date.now() / 1000,
                    speaker: { id: user.id, name: user.name },
                    confidence: isFinal ? 0.9 : 0.7,
                    isInterim: !isFinal
                  }
                ]
              } else {
                // Update the last segment if it's from the same speaker
                const lastSegment = prev[prev.length - 1]
                if (lastSegment.speaker?.id === user.id) {
                  const updated = {
                    ...lastSegment,
                    text: isFinal ? text.trim() : `${text.trim()} [live]`,
                    endTime: Date.now() / 1000,
                    confidence: isFinal ? 0.9 : 0.7,
                    isInterim: !isFinal
                  }
                  return [...prev.slice(0, -1), updated]
                }
                return prev
              }
            })
            
            if (!isFinal) {
              lastInterimText = text
            } else {
              lastInterimText = ''
            }
          }
        }
        
        webSpeechRef.current.onEnd = () => {
          console.log('Web Speech API ended, restarting in 1 second...')
          if (isRecording && !isPaused) {
            speechRestartTimer = setTimeout(startSpeechRecognition, 1000)
          }
        }
        
        webSpeechRef.current.onError = (error) => {
          console.warn('Web Speech API error:', error)
          if (isRecording && !isPaused && error.error !== 'no-speech') {
            speechRestartTimer = setTimeout(startSpeechRecognition, 2000)
          }
        }
        
        startSpeechRecognition()
        
        // Store the restart timer to clean up later
        webSpeechRef.current.restartTimer = speechRestartTimer
      }
      
      // Start meeting if not already started
      if (meeting.status !== 'live') {
        const startResult = await meetingsAPI.startMeeting(meeting._id)
        if (startResult.success) {
          // Update local meeting state to reflect it's now live
          setMeeting(prev => ({ ...prev, status: 'live', startedAt: new Date() }))
        }
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
        // Clear any restart timers
        if (webSpeechRef.current.restartTimer) {
          clearTimeout(webSpeechRef.current.restartTimer)
          webSpeechRef.current.restartTimer = null
        }
      }
      
      setIsRecording(false)
      setIsPaused(false)
      setAudioLevel(0)
      
      // End meeting only if host - check current meeting status first
      if (meeting.host?._id === user.id) {
        try {
          // Get current meeting status to ensure it's live before ending
          const currentMeeting = await meetingsAPI.getMeeting(meeting._id)
          if (currentMeeting.success && currentMeeting.data.meeting.status === 'live') {
            await meetingsAPI.endMeeting(meeting._id)
            // Update local meeting state
            setMeeting(prev => ({ ...prev, status: 'completed' }))
            
            // Generate AI summary automatically after a short delay to allow final transcription processing
            setTimeout(async () => {
              try {
                // Check if there's transcription content before attempting summary
                if (!transcriptionData || !transcription || transcription.length === 0) {
                  console.log('No transcription content available for automatic summary generation')
                  toast.info('Meeting ended. No transcription content available for AI summary.')
                  return
                }

                console.log('Generating AI summary for meeting:', meeting._id)
                console.log('Current transcription segments:', transcription.length)
                
                const summaryResponse = await aiAPI.generateSummary(meeting._id)
                if (summaryResponse.success) {
                  toast.success('AI summary generated!')
                  // Update meeting with summary data
                  setMeeting(prev => ({ 
                    ...prev, 
                    aiInsights: summaryResponse.data.insights 
                  }))
                } else {
                  console.warn('AI summary generation failed:', summaryResponse)
                  toast.error('Failed to generate AI summary')
                }
              } catch (error) {
                console.error('Failed to generate AI summary:', error)
                if (error.response?.status === 404) {
                  const message = error.response?.data?.message || 'No content found'
                  if (message.includes('transcription content')) {
                    toast.info('Meeting ended. No transcription content available for AI summary.')
                  } else {
                    toast.error('No transcription found for summary generation')
                  }
                } else if (error.response?.status === 403) {
                  toast.error('Access denied for summary generation')
                } else {
                  toast.error('Failed to generate AI summary. Please try again.')
                }
              }
            }, 5000) // Wait 5 seconds for final transcription to complete
          }
        } catch (err) {
          console.warn('End meeting skipped:', err?.response?.data?.message || err.message)
          // Don't show error to user as this is not critical
        }
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
      // Check if socket is connected and we're in a meeting
      if (!socket.isConnected()) {
        toast.error('Not connected to server. Please refresh the page.')
        return
      }

      if (!meeting?._id) {
        toast.error('Meeting not found')
        return
      }

      // Send message via socket for real-time updates
      console.log('Sending message via socket:', newMessage.trim())
      socket.sendChatMessage(meeting._id, newMessage.trim())
      
      // Also ask AI if it's a question
      if (newMessage.includes('?')) {
        setIsAITyping(true)
        try {
          const response = await aiAPI.askQuestion(meeting._id, newMessage.trim())
          if (response.success) {
            // AI response will come through socket or we can manually add it
            if (response.data.aiMessage) {
              setChatMessages(prev => [...prev, response.data.aiMessage])
            }
          }
        } catch (error) {
          console.error('AI question failed:', error)
          toast.error('AI response failed')
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
                  <div className="h-96 overflow-y-auto">
                    {meeting?.aiInsights?.summary ? (
                      <div className="space-y-6">
                        {/* Summary */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">Meeting Summary</h4>
                          <p className="text-gray-700 leading-relaxed">{meeting.aiInsights.summary}</p>
                        </div>

                        {/* Key Points */}
                        {meeting.aiInsights.keyPoints && meeting.aiInsights.keyPoints.length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">Key Points</h4>
                            <ul className="space-y-2">
                              {meeting.aiInsights.keyPoints.map((point, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Action Items */}
                        {meeting.aiInsights.actionItems && meeting.aiInsights.actionItems.length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">Action Items</h4>
                            <div className="space-y-3">
                              {meeting.aiInsights.actionItems.map((item, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900">{item.task}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      item.priority === 'high' ? 'bg-red-100 text-red-800' :
                                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {item.priority}
                                    </span>
                                  </div>
                                  {item.assignee && (
                                    <p className="text-sm text-gray-600 mt-1">Assigned to: {item.assignee}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {meeting.aiInsights.topics && meeting.aiInsights.topics.length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">Topics Discussed</h4>
                            <div className="flex flex-wrap gap-2">
                              {meeting.aiInsights.topics.map((topic, index) => (
                                <span key={index} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>
                            {meeting?.status === 'completed' ? 
                              'AI summary will be generated automatically, or click below to generate now.' : 
                              'AI summary will be generated after recording'
                            }
                          </p>
                          {meeting?.status === 'completed' && (
                            <div className="mt-4">
                              <div className="space-y-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      // Check if there's transcription content first
                                      if (!transcriptionData || !transcription || transcription.length === 0) {
                                        toast.error('No transcription available. Please record the meeting first to generate a summary.')
                                        return
                                      }

                                      console.log('Manual AI summary - Meeting ID:', meeting._id)
                                      console.log('Manual AI summary - Transcription segments:', transcription.length)
                                      
                                      const summaryResponse = await aiAPI.generateSummary(meeting._id)
                                      console.log('Manual AI summary response:', summaryResponse)
                                      if (summaryResponse.success) {
                                        toast.success('AI summary generated!')
                                        setMeeting(prev => ({ 
                                          ...prev, 
                                          aiInsights: summaryResponse.data.insights 
                                        }))
                                      } else {
                                        console.error('AI summary failed with response:', summaryResponse)
                                        toast.error('Failed to generate AI summary: ' + (summaryResponse.message || 'Unknown error'))
                                      }
                                    } catch (error) {
                                      console.error('Manual AI summary failed:', error)
                                      console.error('Error response data:', error.response?.data)
                                      console.error('Error status:', error.response?.status)
                                      
                                      // Provide specific error messages based on the response
                                      if (error.response?.status === 404) {
                                        const message = error.response?.data?.message || 'No content found'
                                        if (message.includes('transcription content')) {
                                          toast.error('No transcription content available. Please record the meeting first to generate a summary.')
                                        } else {
                                          toast.error(message)
                                        }
                                      } else if (error.response?.status === 403) {
                                        toast.error('Access denied. You may not have permission to generate summaries for this meeting.')
                                      } else {
                                        toast.error('Failed to generate AI summary: ' + (error.response?.data?.message || error.message))
                                      }
                                    }
                                  }}
                                  disabled={!transcriptionData || !transcription || transcription.length === 0}
                                  className={`btn ${(!transcriptionData || !transcription || transcription.length === 0) ? 'btn-gray cursor-not-allowed' : 'btn-primary'}`}
                                  title={(!transcriptionData || !transcription || transcription.length === 0) ? 'No transcription content available. Record the meeting first.' : 'Generate AI summary from transcription'}
                                >
                                  Generate AI Summary
                                </button>
                                
                                {(!transcriptionData || !transcription || transcription.length === 0) && (
                                  <p className="text-sm text-gray-500 italic">
                                    💡 No transcription content available. Start recording to enable AI summary generation.
                                  </p>
                                )}
                                
                                <button
                                  onClick={async () => {
                                    try {
                                      console.log('Debug - Current transcription data:', transcriptionData)
                                      console.log('Debug - Current transcription segments:', transcription)
                                      console.log('Debug - Meeting ID:', meeting._id)
                                      
                                      // Show detailed segment info
                                      transcription.forEach((segment, index) => {
                                        console.log(`Segment ${index}:`, {
                                          text: segment.text,
                                          speaker: segment.speaker,
                                          length: segment.text?.length || 0
                                        })
                                      })
                                      
                                      // Try to reload transcription
                                      await loadTranscription()
                                      toast.success('Transcription reloaded')
                                    } catch (error) {
                                      console.error('Failed to reload transcription:', error)
                                      toast.error('Failed to reload transcription')
                                    }
                                  }}
                                  className="btn btn-secondary text-sm"
                                >
                                  Debug: Reload Transcription
                                </button>
                                
                                <button
                                  onClick={async () => {
                                    try {
                                      console.log('Rebuilding fullText from frontend segments...')
                                      
                                      // Build fullText from current segments
                                      const fullText = transcription
                                        .map(segment => segment.text || '')
                                        .filter(text => text.trim().length > 0)
                                        .join(' ')
                                        .trim()
                                      
                                      console.log('Built fullText:', {
                                        length: fullText.length,
                                        preview: fullText.substring(0, 100) + '...',
                                        wordCount: fullText.split(' ').filter(w => w.trim()).length
                                      })
                                      
                                      if (fullText.length === 0) {
                                        toast.error('No text content found in segments')
                                        return
                                      }
                                      
                                      // Send to backend to update
                                      const response = await fetch(`http://localhost:5000/api/transcriptions/meeting/${meeting._id}/rebuild`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: JSON.stringify({ fullText })
                                      })
                                      
                                      if (response.ok) {
                                        const result = await response.json()
                                        console.log('FullText rebuild response:', result)
                                        toast.success(`FullText rebuilt: ${fullText.split(' ').length} words`)
                                      } else {
                                        const error = await response.json()
                                        console.error('Rebuild failed:', error)
                                        toast.error('Failed to rebuild fullText: ' + error.message)
                                      }
                                    } catch (error) {
                                      console.error('Failed to rebuild fullText:', error)
                                      toast.error('Failed to rebuild fullText')
                                    }
                                  }}
                                  className="btn btn-warning text-sm"
                                >
                                  Fix: Rebuild FullText
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

