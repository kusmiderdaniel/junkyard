# 🔑 Firebase API Key Rotation Guide

## ⚠️ **URGENT: Complete This Process for ALL Projects**

This guide walks you through rotating compromised Firebase API keys for all environments.

---

## 📋 **Projects Requiring Key Rotation**

| Environment | Project ID           | Firebase Console Link                                                                           |
| ----------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| Production  | `junkyard-31ade`     | [Open Console](https://console.firebase.google.com/project/junkyard-31ade/settings/general)     |
| Development | `junkyard-dev-9497a` | [Open Console](https://console.firebase.google.com/project/junkyard-dev-9497a/settings/general) |
| Staging     | `junkyard-staging`   | [Open Console](https://console.firebase.google.com/project/junkyard-staging/settings/general)   |

---

## 🔐 **Step 1: Rotate API Keys in Google Cloud Console**

### For EACH project:

1. **Open Google Cloud Console**

   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your Firebase project from the dropdown (e.g., `junkyard-dev-9497a`)

2. **Navigate to API Credentials**

   - In the left menu, go to **APIs & Services** → **Credentials**
   - You'll see a list of API keys

3. **Find Your Browser API Key**

   - Look for "Browser key (auto created by Firebase)"
   - This is the API key shown in your Firebase config

4. **Create a New API Key**

   - Click **"+ CREATE CREDENTIALS"** → **"API key"**
   - A new API key will be generated
   - **COPY THE NEW KEY IMMEDIATELY**
   - Click **"RESTRICT KEY"** to add security restrictions

5. **Add Key Restrictions** (Important!)

   - Under **"Application restrictions"**, select **"HTTP referrers"**
   - Add these referrers:
     ```
     https://junkyard-dev-9497a.web.app/*
     https://junkyard-dev-9497a.firebaseapp.com/*
     http://localhost:3000/*
     http://localhost:3001/*
     ```
   - Click **"SAVE"**

6. **Delete the Old Compromised Key**
   - Back in the Credentials list
   - Find the old API key
   - Click the trash icon 🗑️ to delete it
   - Confirm deletion

---

## 📝 **Step 2: Update GitHub Secrets**

### Navigate to GitHub Repository Settings:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**

### Update These Secrets:

#### 🔴 Production Secrets

```
PROD_FIREBASE_API_KEY = [Your NEW production API key]
```

#### 🟡 Development Secrets

```
DEV_FIREBASE_API_KEY = [Your NEW development API key]
```

#### 🟢 Staging Secrets

```
STAGING_FIREBASE_API_KEY = [Your NEW staging API key]
```

---

## 💻 **Step 3: Update Local Environment Files**

Update your local `.env` files with the new keys:

### `.env.production.local`

```env
REACT_APP_FIREBASE_API_KEY=[NEW_PRODUCTION_KEY]
# ... rest of config stays the same
```

### `.env.development.local`

```env
REACT_APP_FIREBASE_API_KEY=[NEW_DEVELOPMENT_KEY]
# ... rest of config stays the same
```

### `.env.staging.local`

```env
REACT_APP_FIREBASE_API_KEY=[NEW_STAGING_KEY]
# ... rest of config stays the same
```

---

## 🧪 **Step 4: Test Everything**

### Local Testing

```bash
# Test development
npm start

# Test staging
npm run start:staging

# Test production build
npm run build:prod
npm run serve
```

### CI/CD Testing

1. Push a commit to `develop` branch
2. Check GitHub Actions for successful deployment
3. Verify the deployed app works

---

## 🛡️ **Step 5: Additional Security Measures**

### 1. **Enable App Check** (Recommended)

- In Firebase Console → App Check
- Enable for your web app
- Provides additional API security

### 2. **Restrict API Key Usage**

- In Google Cloud Console
- APIs & Services → Credentials
- Edit each API key
- Add restrictions:
  - **HTTP referrers** (websites)
  - Add your domains:
    ```
    https://junkyard-31ade.web.app/*
    https://junkyard-31ade.firebaseapp.com/*
    http://localhost:3000/*
    ```

### 3. **Review Security Rules**

- Check Firestore rules
- Review Storage rules
- Ensure proper authentication checks

### 4. **Monitor Usage**

- Firebase Console → Usage and billing
- Check for unusual activity
- Set up billing alerts

---

## 📊 **Step 6: Audit Access Logs**

### Check for Unauthorized Access:

1. **Authentication Logs**

   - Firebase Console → Authentication → Users
   - Look for unknown users or suspicious activity

2. **Firestore Usage**

   - Firebase Console → Firestore Database → Usage
   - Check read/write patterns

3. **Cloud Functions Logs**
   - Firebase Console → Functions → Logs
   - Review function invocations

---

## ✅ **Verification Checklist**

- [ ] Rotated API key for **Production** (`junkyard-31ade`)
- [ ] Rotated API key for **Development** (`junkyard-dev-9497a`)
- [ ] Rotated API key for **Staging** (`junkyard-staging`)
- [ ] Updated all GitHub Secrets
- [ ] Updated local `.env` files
- [ ] Tested local development
- [ ] Tested CI/CD pipeline
- [ ] Enabled App Check (optional but recommended)
- [ ] Added API key restrictions
- [ ] Reviewed access logs
- [ ] Set up monitoring alerts

---

## 🆘 **If You Find Unauthorized Access**

1. **Immediately disable** the affected project
2. **Export your data** (Firestore, Auth users)
3. **Create a new Firebase project** if severely compromised
4. **Review all security rules**
5. **Contact Firebase Support** if needed

---

## 📅 **Post-Rotation Best Practices**

1. **Regular Key Rotation**: Consider rotating keys every 90 days
2. **Access Reviews**: Monthly review of user access
3. **Security Monitoring**: Set up alerts for unusual activity
4. **Documentation**: Keep this guide updated
5. **Team Training**: Ensure team knows security practices

---

**Remember**: After rotating keys, the old exposed keys will stop working. Make sure all deployments are updated before old keys expire (usually within 24 hours).
