# 📚 PWA Receipt System Documentation

Welcome to the comprehensive documentation for the PWA Receipt System. All documentation has been organized by category for easy navigation.

---

## 🔒 **Security Documentation** (`/docs/security/`)

Critical security information and incident reports.

### Essential Security Docs

- **[SECURITY_ALERT.md](./security/SECURITY_ALERT.md)** - ⚠️ Critical security incident report (API key exposure)
- **[GITHUB_SECRETS_SETUP.md](./security/GITHUB_SECRETS_SETUP.md)** - 🔑 How to set up GitHub Secrets for secure CI/CD
- **[SECURITY_RULES.md](./security/SECURITY_RULES.md)** - 🛡️ Firebase security rules and best practices
- **[SECURITY_FIXES.md](./security/SECURITY_FIXES.md)** - 🔧 Security vulnerabilities fixed (npm audit)
- **[PRODUCTION_DEBUG_CLEANUP.md](./security/PRODUCTION_DEBUG_CLEANUP.md)** - 🧹 Production debugging code cleanup

### ⚠️ **Security Notice**

All sensitive information (API keys, credentials) has been removed from documentation. If you're setting up the project, follow the security setup guides.

---

## 💻 **Development Documentation** (`/docs/development/`)

Guides for developers working on the project.

### Getting Started

- **[QUICK_START_GUIDE.md](./development/QUICK_START_GUIDE.md)** - 🚀 Quick setup instructions
- **[DEVELOPMENT.md](./development/DEVELOPMENT.md)** - 📖 Comprehensive development guide
- **[ENV_SETUP.md](./development/ENV_SETUP.md)** - 🔧 Environment configuration guide

### Workflows & CI/CD

- **[DEVELOPMENT_WORKFLOW.md](./development/DEVELOPMENT_WORKFLOW.md)** - 🔄 Git workflow and deployment process
- **[GITHUB_ACTIONS_SETUP.md](./development/GITHUB_ACTIONS_SETUP.md)** - 🤖 CI/CD pipeline configuration

---

## 📦 **Archive Documentation** (`/docs/archive/`)

Historical documentation from past development work. These files document completed refactoring, optimizations, and updates.

### Completed Work

- **[COMPONENT_REFACTORING.md](./archive/COMPONENT_REFACTORING.md)** - Component reorganization
- **[RECEIPT_REFACTORING.md](./archive/RECEIPT_REFACTORING.md)** - Receipt form improvements
- **[DEPENDENCY_UPDATES.md](./archive/DEPENDENCY_UPDATES.md)** - Package updates and migrations
- **[SEARCH_OPTIMIZATION_SUMMARY.md](./archive/SEARCH_OPTIMIZATION_SUMMARY.md)** - Search performance improvements
- **[CACHING_STRATEGY.md](./archive/CACHING_STRATEGY.md)** - PWA caching implementation
- **[FUNCTIONS_CLEANUP.md](./archive/FUNCTIONS_CLEANUP.md)** - Firebase Functions cleanup
- **[CLEANUP_SUMMARY.md](./archive/CLEANUP_SUMMARY.md)** - General code cleanup
- **[LOGO_UPDATE_SUMMARY.md](./archive/LOGO_UPDATE_SUMMARY.md)** - Logo and branding updates
- **[PRODUCTION_READINESS_REVIEW.md](./archive/PRODUCTION_READINESS_REVIEW.md)** - Production checklist

---

## 📂 **Documentation Structure**

```
docs/
├── README.md                  # This file
├── security/                  # 🔒 Security-related documentation
│   ├── SECURITY_ALERT.md
│   ├── GITHUB_SECRETS_SETUP.md
│   ├── SECURITY_RULES.md
│   ├── SECURITY_FIXES.md
│   └── PRODUCTION_DEBUG_CLEANUP.md
├── development/              # 💻 Development guides
│   ├── QUICK_START_GUIDE.md
│   ├── DEVELOPMENT.md
│   ├── ENV_SETUP.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   └── GITHUB_ACTIONS_SETUP.md
└── archive/                  # 📦 Historical documentation
    ├── COMPONENT_REFACTORING.md
    ├── RECEIPT_REFACTORING.md
    ├── DEPENDENCY_UPDATES.md
    └── ... (other completed work)
```

---

## 🚨 **Important Notes**

1. **Security First**: All API keys and sensitive data have been removed from documentation
2. **Environment Setup**: Follow the guides in `/development/` for local setup
3. **CI/CD Security**: Use GitHub Secrets as documented in `/security/GITHUB_SECRETS_SETUP.md`
4. **Historical Context**: Check `/archive/` for understanding past decisions and changes

---

## 🔍 **Quick Links**

- **New Developer?** Start with [QUICK_START_GUIDE.md](./development/QUICK_START_GUIDE.md)
- **Security Incident?** Check [SECURITY_ALERT.md](./security/SECURITY_ALERT.md)
- **Setting up CI/CD?** See [GITHUB_SECRETS_SETUP.md](./security/GITHUB_SECRETS_SETUP.md)
- **Understanding the codebase?** Browse the [archive](./archive/) for context

---

_Last updated: June 2024_
