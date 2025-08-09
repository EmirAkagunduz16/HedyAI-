import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Plus,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Play,
  Pause,
  MoreVertical,
  Download,
  Share2,
  MessageSquare
} from 'lucide-react'
import Navbar from '../components/Navbar'
import { usersAPI, meetingsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('week')
  const [dashboardData, setDashboardData] = useState(null)
  const [recentMeetings, setRecentMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load dashboard stats and recent meetings in parallel
      const [statsResponse, meetingsResponse] = await Promise.all([
        usersAPI.getDashboardStats(),
        meetingsAPI.getMeetings({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
      ])

      if (statsResponse.success) {
        setDashboardData(statsResponse.data.stats)
      }

      if (meetingsResponse.success) {
        setRecentMeetings(meetingsResponse.data.meetings)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const stats = dashboardData ? [
    {
      title: 'Total Meetings',
      value: dashboardData.totalMeetings?.toString() || '0',
      change: dashboardData.meetingsThisMonth > 0 ? `+${dashboardData.meetingsThisMonth}` : '0',
      period: 'this month',
      icon: Calendar,
      color: 'bg-blue-500'
    },
    {
      title: 'Hours Recorded',
      value: dashboardData.totalRecordingTime?.toString() || '0',
      change: dashboardData.meetingsThisWeek > 0 ? `+${dashboardData.meetingsThisWeek}` : '0',
      period: 'this week',
      icon: Clock,
      color: 'bg-green-500'
    },
    {
      title: 'Recent Meetings',
      value: dashboardData.meetingsThisWeek?.toString() || '0',
      change: dashboardData.meetingsThisWeek > dashboardData.meetingsThisMonth - dashboardData.meetingsThisWeek ? '+' : '=',
      period: 'this week',
      icon: Users,
      color: 'bg-purple-500'
    },
    {
      title: 'AI Insights',
      value: dashboardData.totalInsights?.toString() || '0',
      change: '+',
      period: 'generated',
      icon: TrendingUp,
      color: 'bg-orange-500'
    }
  ] : []

  const quickActions = [
    {
      title: 'Start New Meeting',
      description: 'Begin recording and transcribing',
      icon: Plus,
      href: '/meeting',
      color: 'bg-primary-600 hover:bg-primary-700'
    },
    {
      title: 'Upload Recording',
      description: 'Transcribe existing audio file',
      icon: Download,
      href: '#',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Schedule Meeting',
      description: 'Plan future recording session',
      icon: Calendar,
      href: '#',
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome back! Here's what's happening with your meetings.
            </p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={action.title}
                to={action.href}
                className={`card p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group ${action.color} text-white`}
              >
                <div className="flex items-center">
                  <action.icon className="h-8 w-8 mr-4" />
                  <div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={stat.title} className="card p-6">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-green-600 font-medium">{stat.change}</span>
                  <span className="text-gray-600 ml-2">{stat.period}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Meetings</h2>
            <Link 
              to="/meetings" 
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              View all
            </Link>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Meeting
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participants
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentMeetings.map((meeting) => (
                    <tr key={meeting._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img 
                            className="h-10 w-10 rounded-lg" 
                            src={meeting.thumbnail} 
                            alt=""
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {meeting.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {meeting.status === 'completed' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(meeting.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {meeting.duration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {meeting.participants?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button className="text-primary-600 hover:text-primary-900">
                            <Play className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="card p-6">
            <div className="space-y-4">
              {[
                {
                  action: 'Meeting transcribed',
                  title: 'Weekly Team Standup',
                  time: '2 hours ago',
                  icon: MessageSquare
                },
                {
                  action: 'AI insights generated',
                  title: 'Product Planning Session',
                  time: '5 hours ago',
                  icon: TrendingUp
                },
                {
                  action: 'Recording uploaded',
                  title: 'Client Presentation',
                  time: '1 day ago',
                  icon: Download
                }
              ].map((activity, index) => (
                <div key={index} className="flex items-center">
                  <div className="flex-shrink-0">
                    <activity.icon className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.action}</span>
                      {' for '}
                      <span className="font-medium text-primary-600">{activity.title}</span>
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
