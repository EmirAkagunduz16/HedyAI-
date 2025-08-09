import mongoose from 'mongoose'

const transcriptionSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  segments: [{
    id: {
      type: String,
      required: true
    },
    speaker: {
      id: String,
      name: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    text: {
      type: String,
      required: true
    },
    startTime: {
      type: Number,
      required: true
    },
    endTime: {
      type: Number,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.9
    },
    language: {
      type: String,
      default: 'en-US'
    }
  }],
  fullText: String,
  language: {
    type: String,
    default: 'en-US'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  // Simple statistics without complex logic
  totalWords: {
    type: Number,
    default: 0
  },
  speakerCount: {
    type: Number,
    default: 0
  },
  avgConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  chatMessages: [{
    id: {
      type: String,
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    type: {
      type: String,
      enum: ['user', 'ai'],
      required: true
    },
    aiResponse: {
      response: String,
      confidence: Number,
      processingTime: Number,
      relatedSegments: [String] // segment IDs
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  }]
}, {
  timestamps: true
})

// Indexes for better performance
transcriptionSchema.index({ meeting: 1 })
transcriptionSchema.index({ 'segments.speaker.id': 1 })
transcriptionSchema.index({ 'segments.startTime': 1 })
transcriptionSchema.index({ 'chatMessages.user': 1 })
transcriptionSchema.index({ 'chatMessages.timestamp': -1 })

export default mongoose.model('Transcription', transcriptionSchema)
