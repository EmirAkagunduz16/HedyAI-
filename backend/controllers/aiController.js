import { GoogleGenerativeAI } from '@google/generative-ai'
import Meeting from '../models/Meeting.js'
import Transcription from '../models/Transcription.js'
import { generateSegmentId } from '../utils/transcription.js'
import { updateUserStats } from '../utils/user.js'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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

    // Simulate transcription and enhance with Gemini
    const simulatedText = await simulateTranscription(audioData)
    const enhancedText = await enhanceTranscriptionWithGemini(simulatedText)
    
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
    if (!transcription || !transcription.fullText) {
      return res.status(404).json({
        success: false,
        message: 'No transcription available for this meeting'
      })
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
async function simulateTranscription(audioData) {
  const sampleTexts = [
    "Welcome everyone to our weekly standup meeting. Let's start by going through what we accomplished last week.",
    "Thanks for that update. I completed the user authentication module and started working on the dashboard components.",
    "Great work on that. I finished the API integration for the transcription service and it's working really well.",
    "Let's discuss the upcoming sprint planning and what we need to prioritize for next week.",
    "I think we should focus on the frontend components and make sure the user experience is smooth.",
    "Agreed. We also need to ensure our backend API is robust and can handle the expected load."
  ]
  
  return sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
}

async function enhanceTranscriptionWithGemini(text) {
  try {
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
    return {
      text: "I'm sorry, I encountered an error while processing your question. Please try again.",
      confidence: 0.0,
      relatedSegments: []
    }
  }
}

async function generateMeetingInsights(transcriptionText) {
  try {
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
