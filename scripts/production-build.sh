#!/bin/bash
set -e

echo "🏗️  Building application for production..."

# Step 1: Build frontend and backend
echo "📦 Building frontend and backend..."
npm run build

echo "✅ Build complete!"
