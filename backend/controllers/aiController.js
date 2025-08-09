import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Meeting from '../models/Meeting.js'
import Transcription from '../models/Transcription.js'
import { generateSegmentId, rebuildFullText } from '../utils/transcription.js'
import { updateUserStats } from '../utils/user.js'

// Initialize AI services
let genAI = null
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    console.log('✅ Gemini AI client initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize Gemini AI client:', error.message)
  }
} else {
  console.warn('⚠️ GEMINI_API_KEY not found or not configured. AI features will be limited.')
}

// Initialize Groq client only if API key is available
let groq = null
console.log('Checking for GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Found' : 'Not found')
if (process.env.GROQ_API_KEY) {
  try {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    })
    console.log('✅ Groq client initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize Groq client:', error.message)
  }
} else {
  console.warn('⚠️ GROQ_API_KEY not found. Speech transcription will be disabled.')
}

/**
 * AI Audio Transcription Flow:
 * 1. Frontend sends audio chunks (3-second intervals) as base64
 * 2. Backend saves as temporary audio files (.webm format)
 * 3. Groq Whisper API transcribes the audio to text
 * 4. Gemini AI enhances the transcription for better readability
 * 5. Creates transcription segments and sends to frontend
 * 6. Users can chat about transcriptions using Gemini AI
 */

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const transcribeAudio = async (req, res, next) => {
  try {
    const { meetingId, audioData, speaker } = req.body

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

    // Check if GROQ API is available
    if (!groq) {
      return res.json({
        success: true,
        message: 'Speech transcription is not available. Please use Web Speech API in your browser.',
        data: { 
          segment: null,
          useWebSpeechAPI: true 
        }
      })
    }

    // Transcribe audio using Groq Whisper API
    const transcribedText = await transcribeAudioData(audioData)
    
    // Only create segment if we have actual text
    if (!transcribedText || transcribedText.trim().length === 0) {
      return res.json({
        success: true,
        message: 'Audio processed but no speech detected',
        data: { segment: null }
      })
    }
    
    // Enhance transcription with Gemini for better formatting and context
    const enhancedText = await enhanceTranscriptionWithGemini(transcribedText)
    
    // Create segment
    const segment = {
      id: generateSegmentId(),
      speaker: speaker || { 
        id: req.user._id.toString(), 
        name: req.user.name,
        userId: req.user._id
      },
      text: enhancedText,
      startTime: Date.now() / 1000,
      endTime: (Date.now() + 5000) / 1000,
      confidence: 0.95
    }

    // Add segment to transcription
    transcription.segments.push(segment)
    
    // Update fullText
    transcription.fullText = transcription.segments.map(s => s.text).join(' ')
    
    // Update statistics
    transcription.totalWords = transcription.fullText.split(' ').length
    transcription.speakerCount = new Set(transcription.segments.map(s => s.speaker.id)).size
    transcription.avgConfidence = transcription.segments.reduce((sum, s) => sum + s.confidence, 0) / transcription.segments.length
    
    await transcription.save()

    res.json({
      success: true,
      message: 'Audio transcribed successfully',
      data: { segment }
    })
  } catch (error) {
    next(error)
  }
}

export const askQuestion = async (req, res, next) => {
  try {
    const { meetingId, question } = req.body

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

    // Get transcription
    const transcription = await Transcription.findOne({ meeting: meetingId })
    if (!transcription) {
      return res.status(404).json({
        success: false,
        message: 'No transcription available for this meeting'
      })
    }

    const startTime = Date.now()

    // Add user message to chat
    const userMessage = {
      id: generateSegmentId(),
      user: req.user._id,
      message: question,
      type: 'user',
      timestamp: new Date()
    }
    
    transcription.chatMessages.push(userMessage)
    
    // Get AI response using Gemini
    const aiResponse = await generateAIResponse(question, transcription)
    
    // Add AI message to chat
    const aiMessage = {
      id: generateSegmentId(),
      user: req.user._id,
      message: aiResponse.text,
      type: 'ai',
      aiResponse: {
        response: aiResponse.text,
        confidence: aiResponse.confidence,
        processingTime: Date.now() - startTime,
        relatedSegments: aiResponse.relatedSegments
      },
      timestamp: new Date()
    }
    
    transcription.chatMessages.push(aiMessage)
    await transcription.save()

    res.json({
      success: true,
      message: 'AI response generated successfully',
      data: {
        userMessage,
        aiMessage
      }
    })
  } catch (error) {
    next(error)
  }
}

export const generateSummary = async (req, res, next) => {
  try {
    const { meetingId } = req.params
    console.log(`Generating summary for meeting ${meetingId} by user ${req.user._id}`)

    // Check if meeting exists and user has access
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      console.error(`Meeting ${meetingId} not found`)
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      })
    }

    // Check access permissions - more comprehensive check
    const hasAccess = meeting.host.toString() === req.user._id.toString() ||
                      meeting.participants.some(p => p.user.toString() === req.user._id.toString()) ||
                      (meeting.sharedWith && meeting.sharedWith.some(s => s.user.toString() === req.user._id.toString()))

    if (!hasAccess) {
      console.error(`User ${req.user._id} access denied to meeting ${meetingId}`)
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Get transcription
    const transcription = await Transcription.findOne({ meeting: meetingId })
    console.log(`Transcription found:`, transcription ? 'Yes' : 'No')
    if (transcription) {
      console.log(`Transcription fullText length:`, transcription.fullText?.length || 0)
      console.log(`Transcription segments count:`, transcription.segments?.length || 0)
    }
    
    if (!transcription) {
      console.error(`No transcription found for meeting ${meetingId}`)
      return res.status(404).json({
        success: false,
        message: 'No transcription available for this meeting'
      })
    }
    
    if (!transcription.fullText || transcription.fullText.trim().length === 0) {
      console.log(`FullText is empty, attempting to rebuild from ${transcription.segments.length} segments`)
      
      // Try to rebuild fullText from existing segments
      if (transcription.segments && transcription.segments.length > 0) {
        rebuildFullText(transcription)
        await transcription.save()
        console.log(`Rebuilt fullText: ${transcription.fullText.length} characters`)
      }
      
      // Check again after rebuild
      if (!transcription.fullText || transcription.fullText.trim().length === 0) {
        console.error(`Still no transcription content after rebuild for meeting ${meetingId}`)
        return res.status(404).json({
          success: false,
          message: 'No transcription content available for summary generation'
        })
      }
    }

    // Generate AI insights using Gemini
    const insights = await generateMeetingInsights(transcription.fullText)
    
    // Update meeting with AI insights
    meeting.aiInsights = insights
    await meeting.save()

    // Update user stats
    await updateUserStats(req.user._id, 'insights', insights.keyPoints.length)

    res.json({
      success: true,
      message: 'Meeting summary generated successfully',
      data: { insights }
    })
  } catch (error) {
    next(error)
  }
}

export const getInsights = async (req, res, next) => {
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

    res.json({
      success: true,
      data: { 
        insights: meeting.aiInsights || null,
        hasTranscription: !!meeting.transcriptionCompleted
      }
    })
  } catch (error) {
    next(error)
  }
}

// Helper functions
async function transcribeAudioData(audioData) {
  if (!audioData) {
    console.log('No audio data provided')
    return ''
  }

  if (!groq) {
    console.log('Groq client not initialized (API key missing)')
    return ''
  }

  try {
    // Create temporary directory for audio files if it doesn't exist
    const tempDir = path.join(__dirname, '../temp/audio')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Generate unique filename
    const filename = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`
    const audioPath = path.join(tempDir, filename)

    // Convert base64 (data from MediaRecorder) to buffer; normalize header-less base64
    const cleanBase64 = audioData.includes(',') ? audioData.split(',')[1] : audioData
    const audioBuffer = Buffer.from(cleanBase64, 'base64')
    fs.writeFileSync(audioPath, audioBuffer)

    // Transcribe using Groq Whisper API
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      language: "en", // You can make this dynamic based on user settings
      temperature: 0.1
    })

    // Clean up temporary file
    fs.unlinkSync(audioPath)

    console.log('Groq transcription result:', transcription.text)
    return transcription.text || ''

  } catch (error) {
    console.error('Error transcribing audio with Groq:', error)
    return ''
  }
}

async function enhanceTranscriptionWithGemini(text) {
  try {
    if (!genAI) {
      // If Gemini is not available, return the original text with basic cleanup
      return text.trim()
        .replace(/\s+/g, ' ')  // Remove extra spaces
        .replace(/([.!?])\s*([a-z])/g, (match, p1, p2) => p1 + ' ' + p2.toUpperCase()) // Capitalize after punctuation
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    const prompt = `
    Please review and enhance this transcribed text for clarity and accuracy:
    "${text}"
    
    Improve grammar, punctuation, and readability while maintaining the original meaning.
    Return only the enhanced text without any additional comments.
    `
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text() || text
  } catch (error) {
    console.error('Gemini enhancement error:', error)
    return text
  }
}

async function generateAIResponse(question, transcription) {
  try {
    if (!genAI) {
      // If Gemini is not available, provide a simple keyword-based response
      const context = transcription.fullText || transcription.segments.map(s => s.text).join(' ')
      const questionWords = question.toLowerCase().split(' ').filter(word => word.length > 3)
      
      // Find related segments
      const relatedSegments = transcription.segments
        .filter(segment => 
          questionWords.some(word => 
            segment.text.toLowerCase().includes(word)
          )
        )
      
      if (relatedSegments.length > 0) {
        const relevantText = relatedSegments.map(s => s.text).join(' ')
        return {
          text: `Based on the transcription: "${relevantText.substring(0, 500)}${relevantText.length > 500 ? '...' : ''}"`,
          confidence: 0.6,
          relatedSegments: relatedSegments.map(s => s.id).slice(0, 3)
        }
      } else {
        return {
          text: "I couldn't find specific information about that in the meeting transcription.",
          confidence: 0.3,
          relatedSegments: []
        }
      }
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    const context = transcription.fullText || transcription.segments.map(s => s.text).join(' ')
    
    const prompt = `
    Based on the following meeting transcription, please answer the user's question:
    
    Meeting Transcription:
    "${context}"
    
    User Question: "${question}"
    
    Please provide a helpful and accurate answer based only on the information available in the transcription.
    If the answer is not available in the transcription, please say so politely.
    `
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Find related segments
    const questionWords = question.toLowerCase().split(' ')
    const relatedSegments = transcription.segments
      .filter(segment => 
        questionWords.some(word => 
          segment.text.toLowerCase().includes(word) && word.length > 3
        )
      )
      .map(segment => segment.id)
      .slice(0, 3)
    
    return {
      text: text || "I'm sorry, I couldn't generate a response to your question.",
      confidence: 0.9,
      relatedSegments
    }
  } catch (error) {
    console.error('AI response generation error:', error)
    
    // Provide fallback response with basic search
    const context = transcription.fullText || transcription.segments.map(s => s.text).join(' ')
    const questionWords = question.toLowerCase().split(' ').filter(word => word.length > 3)
    
    const relatedSegments = transcription.segments
      .filter(segment => 
        questionWords.some(word => 
          segment.text.toLowerCase().includes(word)
        )
      )
    
    if (relatedSegments.length > 0) {
      const relevantText = relatedSegments.map(s => s.text).join(' ')
      return {
        text: `I found this in the transcription: "${relevantText.substring(0, 500)}${relevantText.length > 500 ? '...' : ''}"`,
        confidence: 0.5,
        relatedSegments: relatedSegments.map(s => s.id).slice(0, 3)
      }
    }
    
    return {
      text: "I'm having trouble accessing the AI service. Please try again later.",
      confidence: 0.0,
      relatedSegments: []
    }
  }
}

async function generateMeetingInsights(transcriptionText) {
  try {
    if (!genAI) {
      // If Gemini is not available, provide basic insights based on text analysis
      const words = transcriptionText.split(' ')
      const sentences = transcriptionText.split(/[.!?]+/).filter(s => s.trim().length > 0)
      
      // Extract key points (first few sentences)
      const keyPoints = sentences.slice(0, 3).map(s => s.trim())
      
      // Look for action items (sentences with action words)
      const actionWords = ['will', 'should', 'need to', 'must', 'have to', 'going to', 'plan to']
      const actionItems = sentences
        .filter(s => actionWords.some(word => s.toLowerCase().includes(word)))
        .slice(0, 3)
        .map(s => ({
          task: s.trim(),
          assignee: 'Team',
          priority: 'medium'
        }))
      
      // Extract topics (common nouns/phrases - simplified)
      const topics = []
      if (transcriptionText.toLowerCase().includes('business')) topics.push('Business Updates')
      if (transcriptionText.toLowerCase().includes('project')) topics.push('Project Discussion')
      if (transcriptionText.toLowerCase().includes('board')) topics.push('Board Matters')
      if (transcriptionText.toLowerCase().includes('colleagues')) topics.push('Team Collaboration')
      if (topics.length === 0) topics.push('General Discussion')
      
      return {
        summary: sentences.slice(0, 2).join(' ').trim() || "Meeting discussion captured.",
        keyPoints: keyPoints.length > 0 ? keyPoints : ["Meeting notes recorded"],
        actionItems,
        topics,
        decisions: [],
        questions: [],
        sentiment: {
          overall: 'neutral',
          score: 0.5
        }
      }
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    const prompt = `
    Analyze the following meeting transcription and provide structured insights:
    
    "${transcriptionText}"
    
    Please provide a JSON response with the following structure:
    {
      "summary": "A brief summary of the meeting (2-3 sentences)",
      "keyPoints": ["List of key points discussed (array of strings)"],
      "actionItems": [
        {
          "task": "Description of action item",
          "assignee": "Person responsible (if mentioned)",
          "priority": "high/medium/low"
        }
      ],
      "topics": ["Main topics discussed (array of strings)"],
      "decisions": ["Key decisions made (array of strings)"],
      "questions": ["Unresolved questions or issues (array of strings)"],
      "sentiment": {
        "overall": "positive/neutral/negative",
        "score": 0.5
      }
    }
    
    Ensure the response is valid JSON only.
    `
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()
      const insights = JSON.parse(cleanText)
      
      return {
        summary: insights.summary || "Meeting summary not available.",
        keyPoints: Array.isArray(insights.keyPoints) ? insights.keyPoints : [],
        actionItems: Array.isArray(insights.actionItems) ? insights.actionItems : [],
        topics: Array.isArray(insights.topics) ? insights.topics : [],
        decisions: Array.isArray(insights.decisions) ? insights.decisions : [],
        questions: Array.isArray(insights.questions) ? insights.questions : [],
        sentiment: {
          overall: insights.sentiment?.overall || 'neutral',
          score: insights.sentiment?.score || 0.5
        }
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      throw new Error('Failed to parse AI insights')
    }
  } catch (error) {
    console.error('Meeting insights generation error:', error)
    
    return {
      summary: "Unable to generate meeting summary at this time.",
      keyPoints: [],
      actionItems: [],
      topics: [],
      decisions: [],
      questions: [],
      sentiment: {
        overall: 'neutral',
        score: 0.5
      }
    }
  }
}
