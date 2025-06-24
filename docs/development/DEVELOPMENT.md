# Development Workflow

## 🏗️ Architecture Overview

This is a Progressive Web App (PWA) built with:

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Storage, Hosting)
- **Build Tool**: Create React App
- **CI/CD**: GitHub Actions

## 🌍 Environment Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Environment Configuration

1. **Development Environment**

   ```bash
   # Create .env.development.local
   cp .env.example .env.development.local
   # Update with your development Firebase config
   ```

2. **Staging Environment**

   ```bash
   # Create .env.staging.local
   cp .env.example .env.staging.local
   # Update with your staging Firebase config
   ```

3. **Production Environment**
   ```bash
   # Create .env.production.local
   cp .env.example .env.production.local
   # Update with your production Firebase config
   ```

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for different environments
npm run build:dev      # Development build
npm run build:staging  # Staging build
npm run build:prod     # Production build

# Code quality
npm run lint           # Check for linting errors
npm run lint:fix       # Fix linting errors
npm run type-check     # TypeScript type checking
npm run format         # Format code with Prettier
npm run test           # Run tests
npm run test:ci        # Run tests in CI mode

# Deployment
npm run deploy:dev     # Deploy to development
npm run deploy:staging # Deploy to staging
npm run deploy:prod    # Deploy to production
```

## 🌿 Branch Strategy

### Branch Types

- **main**: Production-ready code
- **develop**: Integration branch for development
- **feature/\***: Feature development branches
- **hotfix/\***: Critical production fixes
- **release/\***: Release preparation branches

### Workflow

1. Create feature branch from `develop`

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push and create Pull Request

   ```bash
   git push origin feature/your-feature-name
   ```

4. After review, merge to `develop`

5. For releases, create release branch from `develop`

   ```bash
   git checkout -b release/v1.x.x
   ```

6. After testing, merge to `main` and `develop`

## 🚀 Deployment Strategy

### Automatic Deployments

- **develop** branch → Development environment
- **main** branch → Staging environment
- **main** branch + `[deploy-prod]` in commit message → Production

### Manual Deployment

```bash
# Switch Firebase project
firebase use development|staging|production

# Deploy
firebase deploy
```

## 🔒 Security Best Practices

### Environment Variables

- Never commit `.env.*` files (except `.env.example`)
- Use different Firebase projects for each environment
- Store secrets in GitHub Secrets for CI/CD

### Firebase Security

- Review Firestore security rules regularly
- Use Firebase Admin SDK for server-side operations
- Enable App Check for production

## 📋 Code Quality Standards

### Pre-commit Hooks

- ESLint checks
- Prettier formatting
- TypeScript type checking

### Pull Request Requirements

- All CI checks must pass
- Code review required
- No merge conflicts
- Up-to-date with target branch

## 🧪 Testing Strategy

### Test Types

- Unit tests (Jest + React Testing Library)
- Component tests
- Integration tests
- End-to-end tests (future)

### Coverage Requirements

- Minimum 70% code coverage
- Critical paths must be 100% covered

## 📊 Monitoring & Analytics

### Development Tools

- React Developer Tools
- Firebase Console
- Network tab for performance
- Lighthouse for PWA audit

### Production Monitoring

- Firebase Analytics
- Firebase Performance Monitoring
- Firebase Crashlytics
- Google Search Console

## 🔄 Release Process

1. **Create Release Branch**

   ```bash
   git checkout develop
   git checkout -b release/v1.x.x
   ```

2. **Update Version**

   ```bash
   npm version patch|minor|major
   ```

3. **Test in Staging**

   - Deploy to staging environment
   - Run full test suite
   - Manual QA testing

4. **Release to Production**

   ```bash
   git checkout main
   git merge release/v1.x.x
   git tag v1.x.x
   git push origin main --tags
   ```

5. **Deploy with Tag**
   ```bash
   git commit -m "chore: release v1.x.x [deploy-prod]"
   ```

## 📝 Commit Message Convention

Use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Build/config changes

## 🆘 Troubleshooting

### Common Issues

1. **Firebase CLI not authenticated**

   ```bash
   firebase login
   ```

2. **Environment variables not loading**

   - Check file naming (`.env.development.local`)
   - Verify REACT*APP* prefix
   - Restart development server

3. **Build failures**
   ```bash
   npm run type-check
   npm run lint
   ```

### Getting Help

1. Check this documentation
2. Review existing issues/PRs
3. Ask in team chat
4. Create detailed issue with reproduction steps

---

## 📞 Contact

- **Tech Lead**: [Your Name]
- **Repository**: [GitHub URL]
- **Firebase Projects**:
  - Dev: your-app-dev
  - Staging: your-app-staging
  - Prod: junkyard-31ade
