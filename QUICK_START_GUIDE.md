# Quick Start Guide - Multi-Environment Workflow

## 🚀 You're All Set!

Your project now has a complete three-environment workflow:

### Environment Setup Complete ✅

| Environment     | Project ID           | Alias         | URL                                | Purpose                     |
| --------------- | -------------------- | ------------- | ---------------------------------- | --------------------------- |
| **Development** | `junkyard-dev-9497a` | `development` | https://junkyard-dev-9497a.web.app | Daily development & testing |
| **Staging**     | `junkyard-staging`   | `staging`     | https://junkyard-staging.web.app   | Pre-production QA           |
| **Production**  | `junkyard-31ade`     | `production`  | https://junkyard-31ade.web.app     | Live application            |

### Configuration Files Created ✅

- `.env` - Local development (points to development project)
- `.env.development` - Development environment config
- `.env.staging` - Staging environment config
- `.env.production` - Production environment config

## 🎯 How to Use This Workflow

### Daily Development

```bash
# Start working on a new feature
git checkout develop
git checkout -b feature/my-awesome-feature

# Run locally (uses development Firebase project)
npm run start:dev

# When ready, deploy to development environment for testing
npm run deploy:dev
# Visit: https://junkyard-dev-9497a.web.app
```

### Testing with Firebase Emulators

```bash
# Start emulators for local testing (no Firebase charges)
npm run emulator
# Emulator UI: http://localhost:4000
```

### Deploy to Staging for QA

```bash
# When feature is complete and merged to main
npm run deploy:staging
# Visit: https://junkyard-staging.web.app
```

### Deploy to Production (Careful!)

```bash
# Only after staging approval
npm run deploy:prod:manual
# Includes safety confirmation prompt
```

## 🔧 New Commands Available

### Development Commands

- `npm run start:dev` - Start local development
- `npm run build:dev` - Build with development config
- `npm run deploy:dev` - Deploy to development environment

### Staging Commands

- `npm run build:staging` - Build with staging config
- `npm run deploy:staging` - Deploy to staging environment

### Production Commands

- `npm run build:prod` - Build with production config
- `npm run deploy:prod:manual` - Safe production deployment

### Utilities

- `npm run emulator` - Start Firebase emulators
- `npm run workflow:dev` - Start development workflow
- `npm run workflow:staging` - Prepare staging deployment

## 🛡️ Security Features

- **Separate Firebase projects** for each environment
- **Environment-specific API keys** and configurations
- **Production deployment safety** with confirmation prompt
- **Environment files** automatically excluded from git

## 📋 Recommended Workflow

1. **Feature Development**: Work on `develop` branch → Deploy to development
2. **Integration Testing**: Merge to `develop` → Test in development environment
3. **QA Testing**: Merge `develop` to `main` → Deploy to staging
4. **Production Release**: After staging approval → Deploy to production

## 🔍 Current Status

Your current setup:

- ✅ All Firebase projects configured
- ✅ Environment files created
- ✅ Scripts updated for multi-environment
- ✅ Development workflow documented
- ✅ Safety mechanisms in place

## 🚦 Next Steps

1. **Try the development workflow**:

   ```bash
   npm run start:dev
   ```

2. **Test environment switching**:

   ```bash
   firebase use development
   firebase use staging
   firebase use production
   ```

3. **Deploy to development** to test:

   ```bash
   npm run deploy:dev
   ```

4. **Read the full workflow guide**: `DEVELOPMENT_WORKFLOW.md`

## 🆘 Need Help?

- **Environment issues**: Check `DEVELOPMENT_WORKFLOW.md` troubleshooting section
- **Build problems**: Run `npm install` and try again
- **Firebase issues**: Check `firebase login` and project permissions
- **Git workflow**: Follow the branch strategy in the workflow guide

## 🎉 What's New?

This setup gives you:

- **Safer deployments** - test before production
- **Parallel development** - multiple features can be tested
- **Environment isolation** - each environment has its own data
- **Automatic configuration** - no manual environment switching
- **Production safety** - confirmation prompts prevent accidents

Happy coding! 🚀
