#!/bin/bash
# Start the IoT Dashboard Backend Server on port 5000

export PORT=5000
export NODE_ENV=development
export FRONTEND_URL=http://localhost:5174

echo "🚀 Starting IoT Dashboard Backend Server on port 5000..."
node app.js
