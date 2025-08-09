import User from '../models/User.js'

export const updateUserStats = async (userId, type, value = 1) => {
  try {
    const user = await User.findById(userId)
    if (!user) return

    switch (type) {
      case 'meeting':
        user.totalMeetings = (user.totalMeetings || 0) + value
        break
      case 'recordingTime':
        user.totalRecordingTime = (user.totalRecordingTime || 0) + value
        break
      case 'insights':
        user.totalInsights = (user.totalInsights || 0) + value
        break
    }

    await user.save()
  } catch (error) {
    console.error('Failed to update user stats:', error)
  }
}

export const generateAvatar = (email) => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
}

export const getUserPermissions = (user) => {
  const permissions = {
    canCreateMeeting: true,
    canUploadFiles: true,
    canExportData: true,
    canDeleteAccount: true
  }

  // Add role-based permissions
  if (user.role === 'admin') {
    permissions.canManageUsers = true
    permissions.canViewAllMeetings = true
    permissions.canDeleteAnyMeeting = true
  }

  // Add subscription-based permissions
  if (user.subscription?.plan === 'pro' || user.subscription?.plan === 'enterprise') {
    permissions.canCreateUnlimitedMeetings = true
    permissions.canRecordLongMeetings = true
    permissions.canUseAdvancedAI = true
  }

  return permissions
}

export const isUserActive = (user) => {
  if (!user.lastLogin) return false
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return new Date(user.lastLogin) > thirtyDaysAgo
}

export const getUserActivityStats = async (userId, timeRange = '30d') => {
  const user = await User.findById(userId)
  if (!user) return null

  // Calculate date range
  const now = new Date()
  let startDate = new Date()
  
  switch (timeRange) {
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
    case '90d':
      startDate.setDate(now.getDate() - 90)
      break
    default:
      startDate.setDate(now.getDate() - 30)
  }

  return {
    totalMeetings: user.totalMeetings || 0,
    totalRecordingTime: user.totalRecordingTime || 0,
    totalInsights: user.totalInsights || 0,
    isActive: isUserActive(user),
    joinDate: user.createdAt,
    lastLogin: user.lastLogin
  }
}
