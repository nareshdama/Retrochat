#!/bin/bash

# Vercel Deployment Quick Commands
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 RetroChat - Vercel Deployment Script"
echo "======================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Function to build locally
build_local() {
    echo "🔨 Building locally..."
    npm install
    npm run build
    echo "✅ Local build successful!"
}

# Function to deploy to preview
deploy_preview() {
    echo "🌐 Deploying to preview..."
    vercel
}

# Function to deploy to production
deploy_production() {
    echo "🚀 Deploying to production..."
    vercel --prod
}

# Menu
echo "Select deployment option:"
echo "1) Build locally only"
echo "2) Deploy to preview (staging)"
echo "3) Deploy to production"
echo "4) Build and deploy to production"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        build_local
        ;;
    2)
        deploy_preview
        ;;
    3)
        deploy_production
        ;;
    4)
        build_local
        deploy_production
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"
