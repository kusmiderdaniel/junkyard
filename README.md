# Junkyard PWA - Receipt Management System

A Progressive Web Application for managing receipts, clients, products, and business data with Firebase backend.

## Features

- 📱 **Progressive Web App** - Works offline, installable
- 🔐 **Firebase Authentication** - Secure user management
- 💾 **Firestore Database** - Real-time data synchronization
- 📊 **Statistics & Reports** - Business insights with charts
- 📄 **PDF Generation** - Receipt and summary documents
- 📊 **Excel Export/Import** - Data import/export functionality
- 🎨 **Modern UI** - Built with Tailwind CSS

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Firebase project setup

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure Firebase:
```bash
cp env.example .env
# Edit .env with your Firebase configuration
```

3. Start the development server:
```bash
npm start
```

4. Build for production:
```bash
npm run build
```

## Environment Variables

Required environment variables (see `env.example`):
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_ENV` (development/production)

## Deployment

This app is configured for Firebase Hosting:

```bash
firebase deploy
```

## Architecture

- **React 18** with TypeScript
- **Firebase v11** (Auth, Firestore, Storage)
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **@react-pdf/renderer** for PDF generation
- **ExcelJS** for spreadsheet handling

## Production Ready

✅ **Code Quality**: TypeScript, ESLint
✅ **Performance**: Lazy loading, code splitting
✅ **Security**: Firestore rules, environment variables
✅ **PWA**: Service worker, offline capability
✅ **Bundle Size**: Optimized (885kB main bundle)

## License

Private project
