export const generateRoomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const calculateMeetingDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0
  return Math.floor((endTime - startTime) / 1000)
}

export const formatMeetingDuration = (durationInSeconds) => {
  const hours = Math.floor(durationInSeconds / 3600)
  const minutes = Math.floor((durationInSeconds % 3600) / 60)
  const seconds = durationInSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

export const getMeetingStatus = (meeting) => {
  const now = new Date()
  
  if (meeting.status === 'completed' || meeting.status === 'cancelled') {
    return meeting.status
  }
  
  if (meeting.status === 'live') {
    return 'live'
  }
  
  if (meeting.scheduledAt && new Date(meeting.scheduledAt) > now) {
    return 'scheduled'
  }
  
  return 'pending'
}

export const canUserJoinMeeting = (meeting, userId) => {
  // Host can always join
  if (meeting.host.toString() === userId.toString()) {
    return { canJoin: true, reason: 'host' }
  }
  
  // Check if meeting is public
  if (meeting.isPublic) {
    return { canJoin: true, reason: 'public' }
  }
  
  // Check if user is invited participant
  const isParticipant = meeting.participants.some(p => 
    p.user.toString() === userId.toString()
  )
  if (isParticipant) {
    return { canJoin: true, reason: 'participant' }
  }
  
  // Check if meeting is shared with user
  const isShared = meeting.sharedWith.some(s => 
    s.user.toString() === userId.toString()
  )
  if (isShared) {
    return { canJoin: true, reason: 'shared' }
  }
  
  return { canJoin: false, reason: 'no_access' }
}

/**
 * Check if a user can access a meeting (for socket handlers)
 */
export const canUserAccessMeeting = (meeting, userId) => {
  const result = canUserJoinMeeting(meeting, userId)
  return result.canJoin
}

/**
 * Add a participant to a meeting
 */
export const addParticipantToMeeting = async (meeting, userId) => {
  // Check if user is already a participant
  const existingParticipant = meeting.participants.find(
    participant => participant.user.toString() === userId.toString()
  )

  if (existingParticipant) {
    // If participant already exists but has left, update their status
    if (existingParticipant.leftAt) {
      existingParticipant.leftAt = undefined
      existingParticipant.joinedAt = new Date()
    }
  } else {
    // Add new participant
    meeting.participants.push({
      user: userId,
      joinedAt: new Date(),
      role: meeting.host.toString() === userId.toString() ? 'host' : 'participant'
    })
  }

  return meeting.save()
}

/**
 * Remove a participant from a meeting
 */
export const removeParticipantFromMeeting = async (meeting, userId) => {
  const participant = meeting.participants.find(
    participant => participant.user.toString() === userId.toString()
  )

  if (participant) {
    participant.leftAt = new Date()
  }

  return meeting.save()
}
