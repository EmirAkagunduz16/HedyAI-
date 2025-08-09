import { aiAPI } from './api'

class AudioRecordingService {
  constructor() {
    this.mediaRecorder = null
    this.audioContext = null
    this.analyser = null
    this.microphone = null
    this.dataArray = null
    this.isRecording = false
    this.isPaused = false
    this.chunks = []
    this.onDataAvailable = null
    this.onAudioLevel = null
    this.recordingStartTime = null
    this.pausedDuration = 0
    this.pauseStartTime = null
  }

  async initialize() {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      // Set up MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
        audioBitsPerSecond: this.getAudioBitrate()
      })

      // Set up audio context for level monitoring
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.microphone = this.audioContext.createMediaStreamSource(stream)
      
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.8
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      
      this.microphone.connect(this.analyser)

      // Set up MediaRecorder event handlers
      this.setupMediaRecorderHandlers()

      return true
    } catch (error) {
      console.error('Failed to initialize audio recording:', error)
      throw new Error('Microphone access denied or not available')
    }
  }

  setupMediaRecorderHandlers() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
        
        // Only process chunks larger than 1KB (to avoid processing silence)
        if (event.data.size > 1024) {
          // Convert to base64 for API transmission
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1]
            this.onDataAvailable?.(base64data)
          }
          reader.readAsDataURL(event.data)
        }
      }
    }

    this.mediaRecorder.onstop = () => {
      console.log('Recording stopped')
    }

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error)
    }
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // fallback
  }

  getAudioBitrate() {
    const quality = localStorage.getItem('recordingQuality') || 'high'
    const bitrates = {
      low: 64000,
      medium: 128000,
      high: 256000
    }
    return bitrates[quality] || bitrates.high
  }

  async startRecording() {
    if (!this.mediaRecorder) {
      throw new Error('Audio recording not initialized')
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.chunks = []
    this.isRecording = true
    this.isPaused = false
    this.recordingStartTime = Date.now()
    this.pausedDuration = 0

    // Start recording with 3-second chunks for better transcription accuracy
    this.mediaRecorder.start(3000)
    
    // Start audio level monitoring
    this.startAudioLevelMonitoring()

    console.log('Recording started')
    return true
  }

  pauseRecording() {
    if (!this.isRecording || this.isPaused) return

    this.mediaRecorder.pause()
    this.isPaused = true
    this.pauseStartTime = Date.now()
    this.stopAudioLevelMonitoring()

    console.log('Recording paused')
  }

  resumeRecording() {
    if (!this.isRecording || !this.isPaused) return

    this.mediaRecorder.resume()
    this.isPaused = false
    
    if (this.pauseStartTime) {
      this.pausedDuration += Date.now() - this.pauseStartTime
      this.pauseStartTime = null
    }
    
    this.startAudioLevelMonitoring()

    console.log('Recording resumed')
  }

  stopRecording() {
    if (!this.isRecording) return

    this.mediaRecorder.stop()
    this.isRecording = false
    this.isPaused = false
    this.stopAudioLevelMonitoring()

    // Stop all tracks
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop())

    console.log('Recording stopped')
    return this.getRecordingBlob()
  }

  getRecordingBlob() {
    if (this.chunks.length === 0) return null

    const blob = new Blob(this.chunks, { 
      type: this.getSupportedMimeType() 
    })
    
    return blob
  }

  startAudioLevelMonitoring() {
    if (!this.analyser || !this.dataArray) return

    const monitor = () => {
      if (!this.isRecording || this.isPaused) return

      this.analyser.getByteFrequencyData(this.dataArray)
      
      // Calculate average audio level
      const sum = this.dataArray.reduce((acc, value) => acc + value, 0)
      const average = sum / this.dataArray.length
      const normalizedLevel = average / 255

      this.onAudioLevel?.(normalizedLevel)

      requestAnimationFrame(monitor)
    }

    monitor()
  }

  stopAudioLevelMonitoring() {
    this.onAudioLevel?.(0)
  }

  getRecordingDuration() {
    if (!this.recordingStartTime) return 0
    
    const now = Date.now()
    const totalTime = now - this.recordingStartTime
    const activeDuration = totalTime - this.pausedDuration
    
    if (this.isPaused && this.pauseStartTime) {
      return activeDuration - (now - this.pauseStartTime)
    }
    
    return activeDuration
  }

  async processAudioChunk(audioData, meetingId, speaker) {
    try {
      // Send audio data to backend for transcription
      const result = await aiAPI.transcribeAudio(meetingId, audioData, speaker)
      return result.data.segment
    } catch (error) {
      console.error('Failed to process audio chunk:', error)
      throw error
    }
  }

  destroy() {
    this.stopRecording()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.mediaRecorder = null
    this.analyser = null
    this.microphone = null
    this.dataArray = null
    this.chunks = []
    this.onDataAvailable = null
    this.onAudioLevel = null
  }

  // Static method to check browser support
  static isSupported() {
    return !!(navigator.mediaDevices && 
              navigator.mediaDevices.getUserMedia && 
              window.MediaRecorder)
  }

  // Static method to request permissions
  static async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      console.error('Microphone permission denied:', error)
      return false
    }
  }

  // Get available audio input devices
  static async getAudioInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audioinput')
    } catch (error) {
      console.error('Failed to get audio devices:', error)
      return []
    }
  }
}

// Audio analysis utilities
export const AudioUtils = {
  // Convert blob to base64
  blobToBase64: (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  },

  // Format duration in seconds to MM:SS
  formatDuration: (duration) => {
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  },

  // Estimate file size based on duration and bitrate
  estimateFileSize: (durationMs, bitrate = 128000) => {
    const durationSeconds = durationMs / 1000
    const sizeBytes = (bitrate * durationSeconds) / 8
    return Math.round(sizeBytes)
  },

  // Format file size in human readable format
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default AudioRecordingService
