#!/bin/bash

# Hedy AI Setup Script
echo "🚀 Setting up Hedy AI Meeting Coach Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    echo "   - On macOS: brew services start mongodb-community"
    echo "   - On Ubuntu: sudo systemctl start mongodb"
    echo "   - With Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
fi

# Create environment files if they don't exist
echo "📝 Setting up environment files..."

# Frontend .env
if [ ! -f ".env" ]; then
    cp .env-sample .env
    echo "✅ Created frontend .env file"
    echo "⚠️  Please edit .env and add your Gemini API key"
fi

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp backend/env.example backend/.env
    echo "✅ Created backend .env file"
    echo "⚠️  Please edit backend/.env and add your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Edit .env files with your actual API keys and configuration"
echo "2. Start MongoDB if not already running"
echo "3. Run 'npm run start:dev' to start both frontend and backend"
echo ""
echo "🌐 The application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "📚 For detailed instructions, see README.md"
