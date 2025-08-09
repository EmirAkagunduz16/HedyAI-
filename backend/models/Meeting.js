import mongoose from 'mongoose'

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    role: {
      type: String,
      enum: ['host', 'participant', 'observer'],
      default: 'participant'
    }
  }],
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scheduledAt: Date,
  startedAt: Date,
  endedAt: Date,
  duration: {
    type: Number, // in seconds
    default: 0
  },
  recording: {
    isRecorded: {
      type: Boolean,
      default: false
    },
    audioUrl: String,
    videoUrl: String,
    size: Number, // in bytes
    quality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'high'
    }
  },
  // Simplified transcription status
  transcriptionCompleted: {
    type: Boolean,
    default: false
  },
  transcriptionLanguage: {
    type: String,
    default: 'en-US'
  },
  aiInsights: {
    summary: String,
    keyPoints: [String],
    actionItems: [{
      task: String,
      assignee: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      dueDate: Date
    }],
    sentiment: {
      overall: {
        type: String,
        enum: ['positive', 'neutral', 'negative']
      },
      score: {
        type: Number,
        min: -1,
        max: 1
      }
    },
    topics: [String],
    decisions: [String],
    questions: [String]
  },
  settings: {
    autoRecord: {
      type: Boolean,
      default: false
    },
    autoTranscribe: {
      type: Boolean,
      default: true
    },
    allowParticipantRecording: {
      type: Boolean,
      default: false
    },
    requirePassword: {
      type: Boolean,
      default: false
    },
    password: String,
    maxParticipants: {
      type: Number,
      default: 50
    }
  },
  room: {
    id: {
      type: String,
      unique: true,
      required: true
    },
    password: String,
    isLocked: {
      type: Boolean,
      default: false
    }
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: {
      canView: {
        type: Boolean,
        default: true
      },
      canEdit: {
        type: Boolean,
        default: false
      },
      canShare: {
        type: Boolean,
        default: false
      }
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    chatMessages: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
})

// Indexes for better performance
meetingSchema.index({ host: 1, createdAt: -1 })
meetingSchema.index({ 'room.id': 1 })
meetingSchema.index({ status: 1 })
meetingSchema.index({ scheduledAt: 1 })
meetingSchema.index({ 'participants.user': 1 })

export default mongoose.model('Meeting', meetingSchema)
