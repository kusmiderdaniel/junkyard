# Environment Variables Setup

## Required Environment Files

### 1. Development Environment (`.env`)
Create a `.env` file in the `pwa-app/` directory with your Firebase development configuration:

```bash
# Firebase Configuration - Development
REACT_APP_FIREBASE_API_KEY=AIzaSyBu_ROCWssqlbRGkR5hBcElX8qyywwwdSk
REACT_APP_FIREBASE_AUTH_DOMAIN=junkyard-31ade.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=junkyard-31ade
REACT_APP_FIREBASE_STORAGE_BUCKET=junkyard-31ade.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=151876331997
REACT_APP_FIREBASE_APP_ID=1:151876331997:web:0c55e72e74cbe72d8f2e34
REACT_APP_FIREBASE_MEASUREMENT_ID=G-CVC4FY3WWT

# Environment
REACT_APP_ENV=development
```

### 2. Production Environment (`.env.production`)
For production, create a `.env.production` file with your production Firebase project configuration:

```bash
# Firebase Configuration - Production
REACT_APP_FIREBASE_API_KEY=your_production_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_production_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_production_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_production_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
REACT_APP_FIREBASE_APP_ID=your_production_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_production_measurement_id

# Environment
REACT_APP_ENV=production
```

### 3. Firebase Hosting Environment Variables
For Firebase Hosting, set environment variables in your hosting configuration:

```bash
firebase functions:config:set \
  app.firebase_api_key="your_production_api_key" \
  app.firebase_auth_domain="your_production_project.firebaseapp.com" \
  app.firebase_project_id="your_production_project_id" \
  app.firebase_storage_bucket="your_production_project.firebasestorage.app" \
  app.firebase_messaging_sender_id="your_production_sender_id" \
  app.firebase_app_id="your_production_app_id" \
  app.firebase_measurement_id="your_production_measurement_id"
```

## Important Notes

1. **Never commit .env files to version control** - they're already in .gitignore
2. **Use separate Firebase projects for development and production**
3. **The REACT_APP_ prefix is required** for Create React App to expose variables to the browser
4. **Restart your development server** after creating/modifying .env files

## Security Best Practices

1. Use different Firebase projects for dev/staging/production
2. Configure Firebase security rules appropriately for each environment
3. Regularly rotate API keys
4. Monitor Firebase usage and set up alerts for unusual activity

## Deployment

When deploying to Firebase Hosting, the build process will automatically use the `.env.production` file for production builds.

For other hosting platforms (Vercel, Netlify, etc.), set these environment variables in your hosting platform's dashboard. 