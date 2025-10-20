#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Step 1: Run database migrations
echo "📊 Running database migrations..."
npm run db:push

# Step 2: Start the production server
echo "✅ Migrations complete. Starting server..."
NODE_ENV=production node dist/index.js
