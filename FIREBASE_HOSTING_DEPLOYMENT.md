# Deploy to Firebase Hosting

Firebase Hosting is perfect for this app because:
- ✓ Same Firebase project as your backend
- ✓ Zero configuration needed
- ✓ Auto-scales globally
- ✓ Free SSL/HTTPS
- ✓ Super fast (CDN)
- ✓ Simple deployment

---

## 🚀 Deploy in 3 Steps

### Step 1: Build Your App for Production

```bash
npm run build
```

This creates a `/build` folder with your optimized app (takes 1 minute).

### Step 2: Initialize Firebase (One-Time Setup)

```bash
firebase init hosting
```

When asked:
```
? What do you want to use as your public directory? → build
? Configure as a single-page app? → yes
? Set up automatic builds? → no
? Overwrite build/index.html? → no
```

This creates `firebase.json` and `.firebaserc` files.

### Step 3: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

**Done!** Your app is live at: `https://yourproject.web.app`

---

## 📋 One-Time Firebase Setup (Before Deploying)

### 1. Make Sure Firebase Functions are Deployed

```bash
firebase deploy --only functions
```

(You only need to do this once, or when you update `cloud-functions.js`)

### 2. Create `firebase.json` in Project Root

If you don't have it yet, create this file:

```json
{
  "hosting": {
    "public": "build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "node18"
  }
}
```

---

## 🔄 Deployment Workflow

### First Time
```bash
npm run build                    # Build React
firebase deploy --only hosting  # Deploy to Firebase Hosting
firebase deploy --only functions # Deploy backend (one-time usually)
```

### Subsequent Times (Just Update Frontend)
```bash
npm run build                    # Build updated app
firebase deploy --only hosting  # Deploy new version
```

### Update Backend (Cloud Functions)
```bash
firebase deploy --only functions # Redeploy functions
```

---

## ✅ After Deployment

Your app is now live at:
```
https://your-project-id.web.app
```

Test it:
1. Go to that URL in your browser
2. Click "Sign in with Google"
3. Test the full flow

---

## 🌐 Custom Domain (Optional)

Want your own domain (jobcraft.com)?

```bash
firebase hosting:channel:deploy preview
```

Then in Firebase Console:
1. Go to **Hosting** → **Connected domains**
2. Click **Add custom domain**
3. Point your domain DNS to Firebase

Takes 5 minutes, costs ~$10/year for domain.

---

## 📊 Check Deployment Status

```bash
# See your hosting URL
firebase hosting:sites:list

# View live app
firebase open hosting:site

# Check recent deployments
firebase hosting:channel:list
```

---

## 🔍 View Logs

```bash
# Frontend logs
firebase hosting:log

# Backend logs
firebase functions:log
```

---

## 🚨 Troubleshooting Firebase Hosting

### "404 - Page Not Found"
**Fix:** Make sure `firebase.json` has the `rewrites` section (see above)

### "Build folder not found"
**Fix:** 
```bash
npm run build  # Creates /build folder
firebase deploy --only hosting
```

### "Cannot read property of undefined"
**Fix:** Check .env.local has all REACT_APP_ variables

### "Blank page after deployment"
**Fix:** 
1. Check browser console for errors
2. Make sure Cloud Functions are deployed: `firebase deploy --only functions`
3. Check Firebase Firestore rules allow read

---

## 📱 App Now Live!

Your production app is running at:
```
https://your-project-id.web.app
```

It's:
- ✓ HTTPS enabled (free SSL)
- ✓ Global CDN (fast everywhere)
- ✓ Auto-scaling
- ✓ Zero maintenance
- ✓ Free tier supports 10GB/month traffic

---

## 💡 Pro Tips

### Faster Iterations
```bash
# During development, keep both running:
npm start                 # In one terminal (local testing)
firebase emulators:start  # In another terminal (test backend locally)
```

### Rollback Previous Version
```bash
firebase hosting:channel:list  # See previous deployments
firebase hosting:clone -s old-channel my-site  # Restore older version
```

### Environment Variables for Production
```bash
# Update .env.local for production values
REACT_APP_FIREBASE_API_KEY=... (same as dev usually)
# Then rebuild: npm run build
```

---

## ✨ You're Done!

Your app is now:
- Deployed on Firebase Hosting
- Connected to Firebase backend
- Live on the internet
- Ready for users

**Share your URL:** `https://your-project-id.web.app`

---

## 🎯 Next Steps

1. **Test everything works** (login, search, upgrade)
2. **Share with friends** (free marketing!)
3. **Monitor logs** (`firebase functions:log`)
4. **Update when needed:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

---

## 📞 Firebase Hosting Docs

- https://firebase.google.com/docs/hosting
- https://firebase.google.com/docs/hosting/quickstart

---

**Your app is live! 🎉**

Go to `https://your-project-id.web.app` and start getting users!
