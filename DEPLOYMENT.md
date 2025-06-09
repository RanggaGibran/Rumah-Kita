# Rumah Kita - Heroku Deployment Guide

## Overview
Rumah Kita is a collaborative family platform with notes, wishlist, and video calling features built with React, Firebase, and WebRTC.

## Prerequisites
- Node.js 16+ installed
- Heroku CLI installed
- Firebase project set up
- Git repository initialized

## Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd rumah-kita
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase configuration values
   ```bash
   cp .env.example .env.local
   ```

3. **Configure Firebase:**
   - Set up Firebase Authentication
   - Set up Firestore Database
   - Set up Realtime Database
   - Deploy database rules:
   ```bash
   firebase deploy --only database
   ```

4. **Start development server:**
   ```bash
   npm start
   ```

## Heroku Deployment

### Method 1: Using Heroku CLI

1. **Login to Heroku:**
   ```bash
   heroku login
   ```

2. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set REACT_APP_FIREBASE_API_KEY=your_api_key
   heroku config:set REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   heroku config:set REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   heroku config:set REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   heroku config:set REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   heroku config:set REACT_APP_FIREBASE_APP_ID=your_app_id
   heroku config:set REACT_APP_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
   heroku config:set NODE_ENV=production
   ```

4. **Deploy:**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

### Method 2: Using Deploy Button

1. **Push to GitHub:**
   - Push your code to a GitHub repository
   - Include the `app.json` file in your repo

2. **Deploy to Heroku:**
   - Click the "Deploy to Heroku" button (add this to your GitHub README)
   - Fill in the required environment variables during setup

### Method 3: GitHub Integration

1. **Connect GitHub to Heroku:**
   - Go to Heroku Dashboard
   - Create new app
   - Connect to GitHub repository
   - Enable automatic deploys

2. **Set environment variables:**
   - Go to Settings > Config Vars
   - Add all the Firebase environment variables

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API Key | `AIzaSyC...` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `myproject.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase Project ID | `myproject-12345` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `myproject-12345.appspot.com` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID | `123456789` |
| `REACT_APP_FIREBASE_APP_ID` | Firebase App ID | `1:123456789:web:abcdef` |
| `REACT_APP_FIREBASE_DATABASE_URL` | Realtime Database URL | `https://myproject-default-rtdb.firebaseio.com/` |
| `NODE_ENV` | Node Environment | `production` |

## Firebase Setup Requirements

### 1. Authentication
Enable the following sign-in methods in Firebase Console:
- Email/Password
- Google (optional)

### 2. Firestore Database
- Create Firestore database in production mode
- Set up security rules
- Create required indexes (check browser console for index URLs)

### 3. Realtime Database
- Create Realtime Database
- Deploy the provided `database.rules.json`:
```bash
firebase deploy --only database
```

### 4. Storage (if using file uploads)
- Enable Firebase Storage
- Set up storage security rules

## Troubleshooting

### Build Errors
- Make sure all environment variables are set correctly
- Check that Firebase configuration is valid
- Ensure all dependencies are installed

### Runtime Errors
- Check Heroku logs: `heroku logs --tail`
- Verify Firebase rules allow your operations
- Check that Firestore indexes are created

### Firestore Indexes
If you see index requirement errors:
1. Check browser console for index creation URLs
2. Click the provided links to create indexes automatically
3. Or create them manually in Firebase Console

## Additional Configuration

### Custom Domain
```bash
heroku domains:add yourdomain.com
```

### SSL Certificate
```bash
heroku certs:auto:enable
```

### Scaling
```bash
heroku ps:scale web=1
```

## Support
For issues with deployment, check:
1. Heroku logs
2. Firebase console errors
3. Browser developer console
4. Network tab for API call failures
