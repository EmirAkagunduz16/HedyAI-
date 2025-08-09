import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import socketService from '../services/socket'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        // Verify token with backend
        const response = await authAPI.getCurrentUser()
        if (response.success) {
          setUser(response.data.user)
          
          // Connect to socket with valid token
          socketService.connect(token)
        } else {
          // Invalid token, clear local storage
          localStorage.removeItem('token')
          localStorage.removeItem('userData')
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('userData')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      setLoading(true)
      
      // Call backend login API
      const response = await authAPI.login({ email, password })
      
      if (response.success) {
        const { user: userData, token } = response.data
        
        // Store token and user data
        localStorage.setItem('token', token)
        localStorage.setItem('userData', JSON.stringify(userData))
        setUser(userData)
        
        // Connect to socket
        socketService.connect(token)
        
        toast.success('Welcome back!')
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const register = async (name, email, password) => {
    try {
      setLoading(true)
      
      // Call backend register API
      const response = await authAPI.register({ name, email, password })
      
      if (response.success) {
        const { user: userData, token } = response.data
        
        // Store token and user data
        localStorage.setItem('token', token)
        localStorage.setItem('userData', JSON.stringify(userData))
        setUser(userData)
        
        // Connect to socket
        socketService.connect(token)
        
        toast.success('Account created successfully!')
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    // Clear local storage
    localStorage.removeItem('token')
    localStorage.removeItem('userData')
    
    // Disconnect socket
    socketService.disconnect()
    
    // Clear user state
    setUser(null)
    
    toast.success('Logged out successfully')
    navigate('/')
  }

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData }
    setUser(newUserData)
    localStorage.setItem('userData', JSON.stringify(newUserData))
  }

  const refreshUser = async () => {
    try {
      const response = await authAPI.getCurrentUser()
      if (response.success) {
        setUser(response.data.user)
        localStorage.setItem('userData', JSON.stringify(response.data.user))
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
