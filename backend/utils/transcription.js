export const generateSegmentId = () => {
  return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const generateMessageId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Add a transcription segment to a transcription
 */
export const addSegmentToTranscription = (transcription, segmentData) => {
  const segment = {
    id: generateSegmentId(),
    ...segmentData,
    startTime: segmentData.startTime || 0,
    endTime: segmentData.endTime || 0,
    confidence: segmentData.confidence || 0.9,
    language: segmentData.language || transcription.language || 'en-US'
  }

  transcription.segments.push(segment)

  // Update statistics
  const stats = calculateTranscriptionStats(transcription.segments)
  transcription.totalWords = stats.totalWords
  transcription.speakerCount = stats.totalSpeakers
  transcription.avgConfidence = stats.averageConfidence

  // Update full text
  transcription.fullText = transcription.segments.map(s => s.text).join(' ')

  return segment
}

/**
 * Add a chat message to a transcription
 */
export const addChatMessageToTranscription = (transcription, userId, message, type = 'user') => {
  const chatMessage = {
    id: generateMessageId(),
    user: userId,
    message,
    type,
    timestamp: new Date(),
    isEdited: false
  }

  transcription.chatMessages.push(chatMessage)
  return chatMessage
}

export const calculateTranscriptionStats = (segments) => {
  if (!segments || segments.length === 0) {
    return {
      totalWords: 0,
      totalSpeakers: 0,
      averageConfidence: 0,
      speakingTime: []
    }
  }

  // Calculate total words
  const totalWords = segments.reduce((total, segment) => {
    return total + segment.text.split(' ').length
  }, 0)

  // Calculate unique speakers
  const speakers = new Set(segments.map(segment => segment.speaker.id))
  const totalSpeakers = speakers.size

  // Calculate average confidence
  const totalConfidence = segments.reduce((total, segment) => total + segment.confidence, 0)
  const averageConfidence = totalConfidence / segments.length

  // Calculate speaking time per speaker
  const speakingTime = {}
  segments.forEach(segment => {
    const duration = segment.endTime - segment.startTime
    const speakerId = segment.speaker.id
    const speakerName = segment.speaker.name

    if (!speakingTime[speakerId]) {
      speakingTime[speakerId] = {
        speakerId,
        speakerName,
        duration: 0
      }
    }
    speakingTime[speakerId].duration += duration
  })

  return {
    totalWords,
    totalSpeakers,
    averageConfidence,
    speakingTime: Object.values(speakingTime)
  }
}

export const searchInTranscription = (segments, query, options = {}) => {
  if (!query || !segments) return []

  const {
    caseSensitive = false,
    wholeWords = false,
    speakerId = null,
    timeRange = null
  } = options

  let regex
  if (wholeWords) {
    regex = new RegExp(`\\b${query}\\b`, caseSensitive ? 'g' : 'gi')
  } else {
    regex = new RegExp(query, caseSensitive ? 'g' : 'gi')
  }

  let results = segments.filter(segment => {
    // Text match
    if (!regex.test(segment.text)) return false

    // Speaker filter
    if (speakerId && segment.speaker.id !== speakerId) return false

    // Time range filter
    if (timeRange) {
      const { startTime, endTime } = timeRange
      if (segment.startTime < startTime || segment.endTime > endTime) return false
    }

    return true
  })

  // Add match highlights
  results = results.map(segment => ({
    ...segment,
    highlightedText: segment.text.replace(regex, '<mark>$&</mark>')
  }))

  return results
}

export const exportTranscriptionToFormat = (transcription, format = 'txt') => {
  const { segments } = transcription

  switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(transcription, null, 2)

    case 'srt':
      return segments.map((segment, index) => {
        const startTime = formatSRTTime(segment.startTime)
        const endTime = formatSRTTime(segment.endTime)
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.speaker.name}: ${segment.text}\n`
      }).join('\n')

    case 'vtt':
      let vtt = 'WEBVTT\n\n'
      vtt += segments.map(segment => {
        const startTime = formatVTTTime(segment.startTime)
        const endTime = formatVTTTime(segment.endTime)
        return `${startTime} --> ${endTime}\n${segment.speaker.name}: ${segment.text}\n`
      }).join('\n')
      return vtt

    case 'csv':
      let csv = 'Speaker,Text,Start Time,End Time,Confidence\n'
      csv += segments.map(segment => {
        return `"${segment.speaker.name}","${segment.text}","${segment.startTime}","${segment.endTime}","${segment.confidence}"`
      }).join('\n')
      return csv

    default: // txt
      return segments
        .map(segment => `[${formatTime(segment.startTime)}] ${segment.speaker.name}: ${segment.text}`)
        .join('\n\n')
  }
}

// Helper functions for time formatting
const formatTime = (seconds) => {
  const date = new Date(seconds * 1000)
  return date.toISOString().substr(14, 5) // MM:SS format
}

const formatSRTTime = (seconds) => {
  const date = new Date(seconds * 1000)
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  const milliseconds = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0')
  
  return `${hours}:${minutes}:${secs},${milliseconds}`
}

const formatVTTTime = (seconds) => {
  const date = new Date(seconds * 1000)
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  const milliseconds = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0')
  
  return `${hours}:${minutes}:${secs}.${milliseconds}`
}
