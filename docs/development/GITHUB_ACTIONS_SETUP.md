# GitHub Actions Multi-Environment Setup Guide

## 🚀 Overview

Your new GitHub Actions workflow provides:

- ✅ **Automatic deployments** on branch pushes
- ✅ **Manual deployments** via GitHub UI
- ✅ **Environment protection** for production
- ✅ **CI/CD pipeline** with testing

## 📋 Required GitHub Secrets

You need to set up these secrets in your GitHub repository:

### 🔧 **Repository Secrets** (Settings → Secrets and variables → Actions)

#### Development Environment:

```
FIREBASE_SERVICE_ACCOUNT_DEV
```

#### Staging Environment:

```
FIREBASE_SERVICE_ACCOUNT_STAGING
```

#### Production Environment:

```
FIREBASE_SERVICE_ACCOUNT_PROD
```

## 🔑 **How to Get Firebase Service Account Keys**

### 1. **Development Service Account**:

```bash
# Go to Firebase Console
https://console.firebase.google.com/project/junkyard-dev-9497a/settings/serviceaccounts/adminsdk

# Click "Generate new private key"
# Download the JSON file
# Copy the entire JSON content to GitHub secret: FIREBASE_SERVICE_ACCOUNT_DEV
```

### 2. **Staging Service Account**:

```bash
# Go to Firebase Console
https://console.firebase.google.com/project/junkyard-staging/settings/serviceaccounts/adminsdk

# Click "Generate new private key"
# Download the JSON file
# Copy the entire JSON content to GitHub secret: FIREBASE_SERVICE_ACCOUNT_STAGING
```

### 3. **Production Service Account**:

```bash
# Go to Firebase Console
https://console.firebase.google.com/project/junkyard-31ade/settings/serviceaccounts/adminsdk

# Click "Generate new private key"
# Download the JSON file
# Copy the entire JSON content to GitHub secret: FIREBASE_SERVICE_ACCOUNT_PROD
```

## 🌳 **Workflow Triggers**

### **Automatic Deployments**:

| Trigger               | Environment | URL                                |
| --------------------- | ----------- | ---------------------------------- |
| **Push to `develop`** | Development | https://junkyard-dev-9497a.web.app |
| **Push to `main`**    | Staging     | https://junkyard-staging.web.app   |

### **Manual Deployments**:

- Go to **Actions** tab in GitHub
- Click **"Multi-Environment CI/CD Pipeline"**
- Click **"Run workflow"**
- Select environment: `development`, `staging`, or `production`

### **Production Deployment**:

- ⚠️ **Manual only** via GitHub Actions UI
- Requires selecting `production` in workflow dispatch
- Should only be done after staging approval

## 🔄 **Complete Development Workflow**

### **Feature Development**:

```bash
# 1. Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# 2. Work on feature
# ... make changes ...
git add .
git commit -m "feat: add new feature"
git push origin feature/my-new-feature

# 3. Create PR: feature/my-new-feature → develop
# 4. After review/approval, merge PR
# 5. ✅ Automatic deployment to development environment
```

### **Release to Staging**:

```bash
# 1. When develop is stable
# 2. Create PR: develop → main
# 3. After review/approval, merge PR
# 4. ✅ Automatic deployment to staging environment
# 5. QA team tests in staging
```

### **Production Release**:

```bash
# 1. After staging approval
# 2. Go to GitHub Actions
# 3. Run "Multi-Environment CI/CD Pipeline" workflow
# 4. Select "production" environment
# 5. ✅ Manual deployment to production
```

## 🛡️ **GitHub Environment Protection**

Recommended setup in GitHub (Settings → Environments):

### **Development Environment**:

- ✅ No restrictions
- ✅ Auto-deploy on develop push

### **Staging Environment**:

- ✅ No restrictions
- ✅ Auto-deploy on main push

### **Production Environment**:

- ✅ Required reviewers (1+ people)
- ✅ Deployment branches: main only
- ✅ Manual approval required

## 🧪 **Testing the Setup**

### **1. Test Development Deployment**:

```bash
# Make a small change to develop branch
git checkout develop
echo "<!-- Test -->" >> src/App.tsx
git add .
git commit -m "test: trigger development deployment"
git push origin develop

# ✅ Should auto-deploy to: https://junkyard-dev-9497a.web.app
```

### **2. Test Staging Deployment**:

```bash
# Merge develop to main
git checkout main
git pull origin main
git merge develop
git push origin main

# ✅ Should auto-deploy to: https://junkyard-staging.web.app
```

### **3. Test Manual Production Deployment**:

```bash
# Go to GitHub Actions → Run workflow → Select "production"
# ✅ Should deploy to: https://junkyard-31ade.web.app
```

## 📊 **Workflow Status Monitoring**

Monitor deployments at:

- **GitHub Actions**: `https://github.com/[your-username]/[your-repo]/actions`
- **Firebase Console**: Each project's hosting section

## 🔧 **Troubleshooting**

### **Common Issues**:

#### **1. Service Account Permission Error**:

```bash
Error: Firebase deployment failed
Solution: Check service account has "Firebase Hosting Admin" role
```

#### **2. Build Failure**:

```bash
Error: npm run build:dev failed
Solution: Check package.json scripts are correct
```

#### **3. Environment File Missing**:

```bash
Error: Missing environment variables
Solution: Check workflow creates .env files correctly
```

## 🎯 **Benefits of This Setup**

- ✅ **Automated Testing**: Every push runs tests
- ✅ **Environment Isolation**: Each env has its own data
- ✅ **Safe Deployments**: Production requires manual approval
- ✅ **Rollback Capability**: Easy to revert deployments
- ✅ **Parallel Development**: Multiple features can be tested
- ✅ **Quality Control**: Code review required via PRs

## 🚦 **Next Steps**

1. **Set up GitHub secrets** (Firebase service accounts)
2. **Configure environment protection** in GitHub settings
3. **Test the workflow** with a small change
4. **Set up branch protection rules** for main/develop
5. **Train your team** on the new workflow

Your multi-environment CI/CD pipeline is ready! 🎉
