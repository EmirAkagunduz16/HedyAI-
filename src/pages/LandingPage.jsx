import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Mic, 
  MessageSquare, 
  Brain, 
  Users, 
  Shield, 
  Zap,
  ChevronRight,
  Play,
  Star,
  Check
} from 'lucide-react'

const LandingPage = () => {
  const features = [
    {
      icon: Mic,
      title: 'Live Transcription',
      description: 'Real-time audio to text conversion with industry-leading accuracy'
    },
    {
      icon: Brain,
      title: 'AI Insights',
      description: 'Get intelligent summaries and actionable insights from your meetings'
    },
    {
      icon: MessageSquare,
      title: 'Smart Q&A',
      description: 'Ask questions about your conversations and get instant answers'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share transcriptions and insights with your team seamlessly'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'End-to-end encryption ensures your conversations stay confidential'
    },
    {
      icon: Zap,
      title: 'Fast & Reliable',
      description: 'Lightning-fast processing with 99.9% uptime guarantee'
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Product Manager',
      company: 'TechCorp',
      content: 'Hedy AI has transformed how we conduct meetings. The transcription accuracy is incredible!',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Team Lead',
      company: 'StartupXYZ',
      content: 'The AI insights help us identify key action items and follow-ups instantly.',
      rating: 5
    },
    {
      name: 'Emily Davis',
      role: 'Executive Assistant',
      company: 'Global Inc',
      content: 'Perfect for keeping track of important discussions and decisions.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gradient">Hedy AI</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link 
                to="/register" 
                className="btn btn-primary"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-16 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left"
            >
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block">Transform Your</span>
                <span className="block text-gradient">Meetings with AI</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                Real-time transcription, intelligent insights, and smart Q&A. 
                Hedy AI turns every conversation into actionable knowledge.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link 
                    to="/register" 
                    className="btn btn-primary px-8 py-3 text-lg flex items-center justify-center"
                  >
                    Start Free Trial
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                  <button className="btn btn-secondary px-8 py-3 text-lg flex items-center justify-center">
                    <Play className="mr-2 h-5 w-5" />
                    Watch Demo
                  </button>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center"
            >
              <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                <div className="relative block w-full bg-white rounded-lg overflow-hidden">
                  <div className="gradient-bg p-8 rounded-lg">
                    <div className="space-y-4">
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Mic className="h-5 w-5 text-white" />
                          <span className="text-white font-medium">Live Recording</span>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                        </div>
                        <div className="text-white/80 text-sm">
                          "Let's discuss the quarterly results..."
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Brain className="h-5 w-5 text-white" />
                          <span className="text-white font-medium">AI Insights</span>
                        </div>
                        <div className="text-white/80 text-sm">
                          • Revenue growth: 15% QoQ<br />
                          • Action: Follow up on Q4 targets
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Everything you need for smarter meetings
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600">
              Powerful features designed to enhance your meeting experience
            </p>
          </div>
          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="card p-6 hover:shadow-lg transition-shadow duration-300"
                >
                  <div>
                    <feature.icon className="h-8 w-8 text-primary-600" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-base text-gray-500">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Trusted by teams worldwide
            </h2>
          </div>
          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="card p-6"
                >
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4">"{testimonial.content}"</p>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-gradient-to-r from-primary-400 to-accent-400 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {testimonial.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {testimonial.role} at {testimonial.company}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-bg">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to transform your meetings?</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-white/90">
            Join thousands of teams already using Hedy AI to make their meetings more productive.
          </p>
          <Link
            to="/register"
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 sm:w-auto"
          >
            Start your free trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gradient">Hedy AI</h3>
            <p className="mt-2 text-gray-400">
              Making meetings smarter, one conversation at a time.
            </p>
            <div className="mt-8 text-gray-500 text-sm">
              © 2024 Hedy AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
