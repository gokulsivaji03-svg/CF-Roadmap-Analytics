#!/bin/bash
# CF Coach - Setup Script
# Run this to install dependencies and prepare the app

echo "=== CF Coach Setup ==="
echo ""

# Install dependencies
echo "[1/3] Installing npm dependencies..."
npm install --legacy-peer-deps

# Generate Prisma client
echo ""
echo "[2/3] Generating Prisma client..."
npx prisma generate

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "[3/3] Creating .env file..."
  cp .env.example .env
  echo "Edit .env with your settings before running the app."
else
  echo ""
  echo "[3/3] .env already exists"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the app:"
echo "  npm run dev"
echo ""
echo "Open http://localhost:3000 in your browser."
echo ""
echo "Before running, edit .env and set:"
echo "  - DATABASE_URL (PostgreSQL connection string)"
echo "  - GITHUB_ID and GITHUB_SECRET (for GitHub auth)"
echo "  - OPENAI_API_KEY (optional, for AI coach)"
