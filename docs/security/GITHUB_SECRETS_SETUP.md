# 🔑 GitHub Secrets Setup Guide

## **URGENT: Required to Fix API Key Exposure**

After discovering API keys hardcoded in the GitHub Actions workflow, you **MUST** set up GitHub Secrets to securely store your Firebase credentials.

---

## **📋 Step-by-Step Setup**

### **1. Go to GitHub Repository Settings**

1. Navigate to your GitHub repository
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**

### **2. Add Repository Secrets**

Click **"New repository secret"** for each of the following:

#### **🟦 Development Environment Secrets**

```
Secret Name: DEV_FIREBASE_API_KEY
Secret Value: [Your NEW development API key]

Secret Name: DEV_FIREBASE_AUTH_DOMAIN
Secret Value: junkyard-dev-9497a.firebaseapp.com

Secret Name: DEV_FIREBASE_PROJECT_ID
Secret Value: junkyard-dev-9497a

Secret Name: DEV_FIREBASE_STORAGE_BUCKET
Secret Value: junkyard-dev-9497a.firebasestorage.app

Secret Name: DEV_FIREBASE_MESSAGING_SENDER_ID
Secret Value: [Your messaging sender ID]

Secret Name: DEV_FIREBASE_APP_ID
Secret Value: [Your app ID]

Secret Name: DEV_FIREBASE_MEASUREMENT_ID
Secret Value: [Your measurement ID]
```

#### **🟨 Staging Environment Secrets**

```
Secret Name: STAGING_FIREBASE_API_KEY
Secret Value: [Your NEW staging API key]

Secret Name: STAGING_FIREBASE_AUTH_DOMAIN
Secret Value: junkyard-staging.firebaseapp.com

Secret Name: STAGING_FIREBASE_PROJECT_ID
Secret Value: junkyard-staging

Secret Name: STAGING_FIREBASE_STORAGE_BUCKET
Secret Value: junkyard-staging.firebasestorage.app

Secret Name: STAGING_FIREBASE_MESSAGING_SENDER_ID
Secret Value: [Your messaging sender ID]

Secret Name: STAGING_FIREBASE_APP_ID
Secret Value: [Your app ID]

Secret Name: STAGING_FIREBASE_MEASUREMENT_ID
Secret Value: [Your measurement ID]
```

#### **🟥 Production Environment Secrets**

```
Secret Name: PROD_FIREBASE_API_KEY
Secret Value: [Your NEW production API key]

Secret Name: PROD_FIREBASE_AUTH_DOMAIN
Secret Value: junkyard-31ade.firebaseapp.com

Secret Name: PROD_FIREBASE_PROJECT_ID
Secret Value: junkyard-31ade

Secret Name: PROD_FIREBASE_STORAGE_BUCKET
Secret Value: junkyard-31ade.firebasestorage.app

Secret Name: PROD_FIREBASE_MESSAGING_SENDER_ID
Secret Value: [Your messaging sender ID]

Secret Name: PROD_FIREBASE_APP_ID
Secret Value: [Your app ID]

Secret Name: PROD_FIREBASE_MEASUREMENT_ID
Secret Value: [Your measurement ID]
```

---

## **🔥 How to Get NEW Firebase API Keys**

### **⚠️ CRITICAL: Generate New API Keys First!**

**The exposed keys MUST be regenerated before adding them to secrets:**

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **For EACH project** (dev, staging, production):

   - Select the project
   - Click **⚙️ Settings** → **Project Settings**
   - Go to **General** tab
   - Scroll down to **"Your apps"** section
   - Click **⚙️** next to your web app
   - **Regenerate API Key** (this invalidates the old exposed key)
   - Copy the NEW API key value

3. **Repeat for all 3 environments**:
   - `junkyard-dev-9497a` (Development)
   - `junkyard-staging` (Staging)
   - `junkyard-31ade` (Production)

---

## **✅ Verification**

After setting up all secrets:

1. **Check Secret Count**: You should have **21 total secrets** (7 per environment × 3 environments)

2. **Test Workflow**:

   - Push a commit to the `develop` branch
   - Check GitHub Actions tab
   - Verify the deployment works with secrets

3. **Secret Names Should Match**:

   ```
   DEV_FIREBASE_API_KEY ✓
   DEV_FIREBASE_AUTH_DOMAIN ✓
   DEV_FIREBASE_PROJECT_ID ✓
   DEV_FIREBASE_STORAGE_BUCKET ✓
   DEV_FIREBASE_MESSAGING_SENDER_ID ✓
   DEV_FIREBASE_APP_ID ✓
   DEV_FIREBASE_MEASUREMENT_ID ✓

   STAGING_FIREBASE_* (7 secrets) ✓
   PROD_FIREBASE_* (7 secrets) ✓
   ```

---

## **🚨 IMPORTANT NOTES**

1. **🔄 Update Existing Secrets**: If you already have some Firebase secrets with different names (like `PROD_FIREBASE_API_KEY`), make sure the names match exactly what's in the workflow file.

2. **🔐 Keep Secrets Secret**: Never share these values or commit them to code again.

3. **📝 Document Changes**: Update your team about the new secret naming convention.

4. **🧪 Test All Environments**: After setup, test deployments to dev, staging, and production to ensure everything works.

---

## **🆘 Troubleshooting**

### **Error: "Secret not found"**

- Check secret name spelling (case sensitive)
- Ensure secret exists in repository settings
- Verify you're in the correct repository

### **Error: "Invalid Firebase configuration"**

- Double-check the API key value
- Ensure you regenerated the key in Firebase Console
- Verify the project ID matches

### **Build Fails After Setup**

- Check GitHub Actions logs for specific error
- Verify all 21 secrets are properly set
- Ensure secret values don't have extra spaces or quotes

---

**Once completed, commit the updated workflow file and your CI/CD pipeline will be secure!**
