# Hedy AI - Complete Meeting Coach Application

A full-stack web application for AI-powered meeting transcription and insights, built with the MERN stack (MongoDB, Express.js, React, Node.js), Socket.IO for real-time features, and integrated with Google's Gemini AI.

## Features

- **Real-time Transcription**: Live audio-to-text conversion during meetings
- **AI-Powered Insights**: Intelligent summaries and actionable insights
- **Smart Q&A**: Ask questions about meeting content and get instant answers
- **Beautiful UI**: Modern, responsive design with smooth animations
- **Authentication**: Secure user authentication with JWT simulation
- **Dashboard**: Comprehensive meeting overview and analytics
- **Profile Management**: User settings and preferences

## Tech Stack

### Frontend
- **React 18** with Vite for fast development
- **TailwindCSS** with custom design system
- **React Router DOM** for navigation
- **Framer Motion** for smooth animations
- **Socket.IO Client** for real-time features
- **Axios** for API communication
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Google Generative AI** (Gemini) for transcription and insights
- **Multer** for file uploads
- **Express Rate Limit** for API protection

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Google Gemini API key
- npm or yarn package manager

### Installation

#### 1. Frontend Setup

```bash
# Navigate to project root
cd "/home/emir/Desktop/New Folder"

# Install frontend dependencies
npm install

# Set up frontend environment variables
cp .env-sample .env
```

Edit `.env` file with your actual values:
```env
VITE_GEMINI_API_KEY=your_actual_gemini_api_key
VITE_BACKEND_URL=http://localhost:5000/api
VITE_MAX_RECORDING_DURATION=3600
VITE_AUDIO_CHUNK_SIZE=1024
VITE_APP_NAME=Hedy AI Meeting Coach
VITE_APP_VERSION=1.0.0
```

#### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Set up backend environment variables
cp env.example .env
```

Edit `backend/.env` file with your actual values:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/hedy-ai

# JWT
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_very_long_and_random
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# AI
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 3. Start the Application

Start MongoDB (if running locally):
```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongodb

# Or run with Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

Start the backend:
```bash
cd backend
npm run dev
```

Start the frontend (in a new terminal):
```bash
cd "/home/emir/Desktop/New Folder"
npm run dev
```

Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── LoadingSpinner.jsx
│   ├── Navbar.jsx
│   └── ProtectedRoute.jsx
├── context/             # React Context providers
│   └── AuthContext.jsx
├── pages/               # Main application pages
│   ├── Dashboard.jsx
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── MeetingRoom.jsx
│   ├── Profile.jsx
│   └── RegisterPage.jsx
├── App.jsx              # Main app component
├── index.css            # Global styles
└── main.jsx             # Application entry point
```

## Key Features

### 1. Authentication System
- Mock authentication with localStorage
- Protected routes
- User context management
- Beautiful login/register forms

### 2. Meeting Interface
- Live audio recording with Web Audio API
- Real-time transcription simulation
- Audio level visualization
- Recording controls (start, pause, stop)

### 3. AI Chat Interface
- Ask questions about meeting content
- Simulated AI responses
- Real-time chat experience

### 4. Dashboard
- Meeting statistics and analytics
- Recent meetings overview
- Quick action buttons
- Activity feed

## Environment Variables

The application uses the following environment variables:

```env
# AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key

# Backend Configuration  
VITE_BACKEND_URL=http://localhost:5000/api

# MongoDB (for backend reference)
MONGODB_URI=mongodb://localhost:27017/hedy-ai

# JWT Configuration (for backend reference)
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

# Server Configuration (for backend reference)
PORT=5000
NODE_ENV=development

# Audio Configuration
VITE_MAX_RECORDING_DURATION=3600
VITE_AUDIO_CHUNK_SIZE=1024

# App Configuration
VITE_APP_NAME=Hedy AI Meeting Coach
VITE_APP_VERSION=1.0.0
```

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Demo Credentials

For testing the authentication:
- **Email**: Any valid email format (e.g., demo@hedyai.com)
- **Password**: Any password (minimum 6 characters)

## Browser Permissions

The application requires the following browser permissions:
- **Microphone access**: For audio recording during meetings
- **Notification access**: For meeting alerts (optional)

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Configure environment variables** for production

3. **Deploy** the `dist` folder to your hosting service

## Backend Integration

This frontend is designed to work with a MERN stack backend. Key integration points:

- **Authentication**: JWT-based authentication endpoints
- **Meeting API**: CRUD operations for meetings
- **Transcription API**: Real-time transcription processing
- **AI API**: Integration with Gemini AI for insights

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

Built with ❤️ for modern meeting experiences
# HedyAI-
# HedyAI-
