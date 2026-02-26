# Firebase Setup Instructions

## Overview
VoxScribe now uses Firebase for cloud synchronization, allowing recordings to be shared across devices.

## Firebase Configuration
The app is configured to use the following Firebase project:
- **Project ID**: voxcribe-916
- **Authentication**: Google Sign-In
- **Database**: Firestore
- **Storage**: User recordings in `users/{uid}/recordings` collection

## Security Rules
**IMPORTANT**: Update your Firestore security rules in the Firebase Console to secure user data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own recordings
    match /users/{userId}/recordings/{recordingId} {
      allow read, write, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Why this is needed:**
- Your current rules allow anyone to access all recordings
- These new rules ensure users can only access their own data
- Each recording is stored under `/users/{userId}/recordings/{recordingId}`
- Authentication is required for any database access

## Features Enabled
1. **Authentication**: Google Sign-In
2. **Firestore Database**: Store recordings
3. **Real-time Sync**: Automatic synchronization across devices
4. **Offline Support**: Service worker caching

## How It Works
1. User signs in with Google
2. Recordings are saved to Firestore under their user ID
3. Changes sync automatically across all signed-in devices
4. Offline support with service worker caching

## Testing Synchronization
1. Open the app on two different devices/browsers
2. Sign in with the same Google account on both
3. Record on one device
4. The recording should appear on the other device automatically

## Data Structure
Each recording is stored as:
```javascript
{
  id: "rec_timestamp",
  userId: "user_uid",
  createdAt: timestamp,
  duration: seconds,
  transcript: "text",
  audioBase64: "base64_audio_data",
  mimeType: "audio/webm",
  syncedAt: timestamp
}
```
