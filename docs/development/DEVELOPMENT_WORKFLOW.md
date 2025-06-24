# Development Workflow Guide

## Overview

This project uses a three-environment setup for safe, efficient development and deployment:

- **Development**: `junkyard-dev-9497a` - For daily development and testing
- **Staging**: `junkyard-staging` - For pre-production testing and QA
- **Production**: `junkyard-31ade` - For live user-facing application

## Environment Configuration

### Firebase Projects

- **Development**: `junkyard-dev-9497a` (alias: `development`)
- **Staging**: `junkyard-staging` (alias: `staging`)
- **Production**: `junkyard-31ade` (alias: `production`)

### Environment Files

Each environment has its own configuration file:

- `.env` - Default development configuration (local development)
- `.env.development` - Development environment
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## Recommended Development Workflow

### Step-by-Step Process

#### 1. Feature Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Start local development with development environment
npm run start:dev
# or
npm run workflow:dev
```

#### 2. Local Testing with Firebase Emulators

```bash
# Start Firebase emulators (uses development project)
npm run emulator
```

#### 3. Deploy to Development Environment

```bash
# Test your changes in development environment
npm run deploy:dev
```

- **URL**: https://junkyard-dev-9497a.web.app
- **Purpose**: Test your feature with real Firebase services
- **Data**: Test data that can be reset frequently

#### 4. Merge to Develop Branch

```bash
# When feature is ready
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name

# Create PR to develop branch
# After PR approval, merge to develop
```

#### 5. Automatic Development Deployment

- Merging to `develop` triggers automatic deployment to Development environment
- Test the integrated features in the development environment

#### 6. Prepare for Staging

```bash
# When develop branch is stable and ready for QA
git checkout main
git pull origin main
git merge develop
git push origin main
```

#### 7. Deploy to Staging

```bash
# Deploy to staging for QA testing
npm run deploy:staging
```

- **URL**: https://junkyard-staging.web.app
- **Purpose**: Final testing before production
- **Audience**: QA team, stakeholders
- **Data**: Production-like but anonymized

#### 8. Production Deployment (Manual Only)

```bash
# Only after staging approval
npm run deploy:prod:manual
```

- **URL**: https://junkyard-31ade.web.app
- **Purpose**: Live user-facing application
- **Data**: Real user data

## Quick Commands Reference

### Development

```bash
npm run start:dev          # Start local development
npm run build:dev          # Build for development
npm run deploy:dev         # Deploy to development environment
npm run emulator           # Start Firebase emulators
```

### Staging

```bash
npm run start:staging      # Start with staging config (rare)
npm run build:staging      # Build for staging
npm run deploy:staging     # Deploy to staging environment
```

### Production

```bash
npm run start:prod         # Start with production config (rare)
npm run build:prod         # Build for production
npm run deploy:prod        # Deploy to production (use with caution)
npm run deploy:prod:manual # Safe production deployment with confirmation
```

### Workflow Helpers

```bash
npm run workflow:dev       # Start development workflow
npm run workflow:staging   # Prepare staging deployment
npm run workflow:prod      # Prepare production deployment
```

## Environment URLs

- **Development**: https://junkyard-dev-9497a.web.app
- **Staging**: https://junkyard-staging.web.app
- **Production**: https://junkyard-31ade.web.app

## Git Branch Strategy

### Branch Structure

- `main` - Production-ready code (deploys to staging automatically)
- `develop` - Integration branch (deploys to development automatically)
- `feature/*` - Feature branches (create PRs to develop)
- `hotfix/*` - Emergency fixes (can go directly to main)

### Branch Protection Rules

Recommended branch protection for `main`:

- Require pull request reviews
- Require status checks to pass
- Restrict pushes to main branch

## Security and Best Practices

### Environment Variables

- Never commit `.env*` files to version control (they're in `.gitignore`)
- Each environment has its own Firebase project and API keys
- Development environment is safe for testing and can be reset

### Data Management

- **Development**: Use test data, can be reset frequently
- **Staging**: Use production-like but anonymized data
- **Production**: Real user data - handle with extreme care

### Deployment Safety

- Always test in development first
- Get QA approval in staging before production
- Production deployments should be manual and deliberate
- Use `npm run deploy:prod:manual` for safety confirmation

## Troubleshooting

### Environment Issues

```bash
# Check current Firebase project
firebase projects:list

# Switch to specific environment
firebase use development
firebase use staging
firebase use production

# Verify environment variables are loaded
npm run start:dev # Check console for loaded config
```

### Build Issues

```bash
# Clean build
rm -rf build node_modules package-lock.json
npm install
npm run build:dev
```

### Deployment Issues

```bash
# Check Firebase authentication
firebase login

# Verify project permissions
firebase projects:list

# Check deployment status
firebase hosting:sites:list
```

## Common Scenarios

### Feature Development

1. `git checkout develop && git pull`
2. `git checkout -b feature/new-feature`
3. `npm run start:dev` (develop locally)
4. `npm run deploy:dev` (test in development environment)
5. Create PR to `develop`

### Bug Fix

1. `git checkout develop && git pull`
2. `git checkout -b fix/bug-description`
3. Fix the bug
4. Test with `npm run start:dev`
5. `npm run deploy:dev`
6. Create PR to `develop`

### Release Preparation

1. Ensure `develop` is stable
2. `git checkout main && git pull`
3. `git merge develop`
4. `npm run deploy:staging`
5. QA testing in staging
6. After approval: `npm run deploy:prod:manual`

### Emergency Hotfix

1. `git checkout main && git pull`
2. `git checkout -b hotfix/emergency-fix`
3. Fix the issue
4. `npm run deploy:staging` (test in staging)
5. After validation: `npm run deploy:prod:manual`
6. Create PR to `main` and also merge back to `develop`

## Getting Help

If you encounter issues:

1. Check this workflow guide
2. Verify environment configurations
3. Check Firebase console for each environment
4. Review Git branch structure
5. Consult team lead for production deployments
