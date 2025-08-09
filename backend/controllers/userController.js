import User from '../models/User.js'
import Meeting from '../models/Meeting.js'
import { comparePassword } from '../utils/password.js'

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    next(error)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'phone', 'location', 'company', 'jobTitle', 'bio']
    const updates = {}
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key]
      }
    })

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    })
  } catch (error) {
    next(error)
  }
}

export const updateSettings = async (req, res, next) => {
  try {
    const settingsUpdates = {}
    const allowedSettings = [
      'emailNotifications', 
      'pushNotifications', 
      'weeklyReports', 
      'autoTranscribe', 
      'recordingQuality', 
      'language'
    ]

    Object.keys(req.body).forEach(key => {
      if (allowedSettings.includes(key)) {
        settingsUpdates[`settings.${key}`] = req.body[key]
      }
    })

    const user = await User.findByIdAndUpdate(
      req.user._id,
      settingsUpdates,
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: user.settings }
    })
  } catch (error) {
    next(error)
  }
}

export const getDashboardStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Get meeting statistics
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalMeetings,
      meetingsThisMonth,
      meetingsThisWeek,
      recentMeetings
    ] = await Promise.all([
      Meeting.countDocuments({
        $or: [
          { host: user._id },
          { 'participants.user': user._id }
        ]
      }),
      Meeting.countDocuments({
        $or: [
          { host: user._id },
          { 'participants.user': user._id }
        ],
        createdAt: { $gte: lastMonth }
      }),
      Meeting.countDocuments({
        $or: [
          { host: user._id },
          { 'participants.user': user._id }
        ],
        createdAt: { $gte: lastWeek }
      }),
      Meeting.find({
        $or: [
          { host: user._id },
          { 'participants.user': user._id }
        ]
      })
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(5)
    ])

    // Calculate total recording time
    const meetingsWithDuration = await Meeting.find({
      $or: [
        { host: user._id },
        { 'participants.user': user._id }
      ],
      duration: { $gt: 0 }
    })

    const totalRecordingTime = meetingsWithDuration.reduce((total, meeting) => {
      return total + meeting.duration
    }, 0)

    // Update user stats
    user.totalMeetings = totalMeetings
    user.totalRecordingTime = totalRecordingTime
    await user.save()

    const stats = {
      totalMeetings,
      meetingsThisMonth,
      meetingsThisWeek,
      totalRecordingTime: Math.round(totalRecordingTime / 3600 * 10) / 10, // Convert to hours
      totalInsights: user.totalInsights || 0,
      recentMeetings
    }

    res.json({
      success: true,
      data: { stats }
    })
  } catch (error) {
    next(error)
  }
}

export const uploadAvatar = async (req, res, next) => {
  try {
    const { avatarUrl } = req.body

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: 'Avatar URL is required'
      })
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatar: user.avatar }
    })
  } catch (error) {
    next(error)
  }
}

export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body

    const user = await User.findById(req.user._id).select('+password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      })
    }

    // Delete all user's meetings (where they are the host)
    await Meeting.deleteMany({ host: user._id })

    // Remove user from other meetings as participant
    await Meeting.updateMany(
      { 'participants.user': user._id },
      { $pull: { participants: { user: user._id } } }
    )

    // Delete user account
    await User.findByIdAndDelete(user._id)

    res.json({
      success: true,
      message: 'Account deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

export const exportUserData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Get all user's meetings
    const meetings = await Meeting.find({
      $or: [
        { host: user._id },
        { 'participants.user': user._id }
      ]
    })
    .populate('host', 'name email')
    .populate('participants.user', 'name email')

    const exportData = {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        company: user.company,
        jobTitle: user.jobTitle,
        bio: user.bio,
        settings: user.settings,
        createdAt: user.createdAt
      },
      meetings: meetings.map(meeting => ({
        id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        status: meeting.status,
        duration: meeting.duration,
        createdAt: meeting.createdAt,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        isHost: meeting.host._id.toString() === user._id.toString()
      })),
      exportedAt: new Date()
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${user._id}.json"`)
    res.json(exportData)
  } catch (error) {
    next(error)
  }
}

export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: { users: [] }
      })
    }

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('name email avatar company jobTitle')
    .limit(20)

    res.json({
      success: true,
      data: { users }
    })
  } catch (error) {
    next(error)
  }
}
