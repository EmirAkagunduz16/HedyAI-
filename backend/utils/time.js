export const formatTime = (seconds) => {
  const date = new Date(seconds * 1000)
  return date.toISOString().substr(14, 5) // MM:SS format
}

export const formatSRTTime = (seconds) => {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  const milliseconds = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0')
  
  return `${hours}:${minutes}:${secs},${milliseconds}`
}

export const formatVTTTime = (seconds) => {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  const milliseconds = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0')
  
  return `${hours}:${minutes}:${secs}.${milliseconds}`
}

export const formatDuration = (durationInSeconds) => {
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

export const parseTimeString = (timeString) => {
  // Parse time strings like "1h 30m 45s" or "30:45" or "1:30:45"
  
  // Try parsing duration format (1h 30m 45s)
  const durationMatch = timeString.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/)
  if (durationMatch) {
    const hours = parseInt(durationMatch[1] || 0)
    const minutes = parseInt(durationMatch[2] || 0)
    const seconds = parseInt(durationMatch[3] || 0)
    return hours * 3600 + minutes * 60 + seconds
  }

  // Try parsing time format (HH:MM:SS or MM:SS)
  const timeMatch = timeString.match(/^(?:(\d+):)?(\d+):(\d+)$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] || 0)
    const minutes = parseInt(timeMatch[2] || 0)
    const seconds = parseInt(timeMatch[3] || 0)
    return hours * 3600 + minutes * 60 + seconds
  }

  return 0
}

export const addTime = (time1, time2) => {
  return time1 + time2
}

export const subtractTime = (time1, time2) => {
  return Math.max(0, time1 - time2)
}

export const getTimestamp = () => {
  return Math.floor(Date.now() / 1000)
}

export const formatTimestamp = (timestamp, format = 'datetime') => {
  const date = new Date(timestamp * 1000)
  
  switch (format) {
    case 'date':
      return date.toISOString().split('T')[0]
    case 'time':
      return date.toTimeString().split(' ')[0]
    case 'datetime':
      return date.toISOString().replace('T', ' ').split('.')[0]
    case 'relative':
      return getRelativeTime(timestamp)
    default:
      return date.toISOString()
  }
}

export const getRelativeTime = (timestamp) => {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) {
    return `${diff} seconds ago`
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diff / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}
