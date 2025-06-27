# Content Security Policy (CSP) Implementation Guide

## Overview

This document outlines the Content Security Policy and security headers implementation for the PWA application to prevent XSS attacks, clickjacking, and other security vulnerabilities.

## Security Headers Implemented

### 1. Content Security Policy (CSP)

**Purpose**: Prevents XSS attacks by controlling which resources can be loaded and executed.

**Current Policy**:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googleapis.com https://apis.google.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;
connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.cloudfunctions.net wss://*.firebaseio.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

**Breakdown**:

- `default-src 'self'`: Only allow resources from same origin by default
- `script-src`: Allow scripts from self, inline scripts (for React), and Google APIs (Firebase)
- `style-src`: Allow styles from self, inline styles, and Google Fonts
- `font-src`: Allow fonts from self and Google Fonts
- `img-src`: Allow images from self, data URLs, and any HTTPS source
- `connect-src`: Allow connections to Firebase and Google APIs
- `object-src 'none'`: Block all plugins (Flash, etc.)
- `base-uri 'self'`: Prevent base tag injection
- `form-action 'self'`: Only allow form submissions to same origin
- `frame-ancestors 'none'`: Prevent embedding in frames (anti-clickjacking)

### 2. X-Frame-Options

**Value**: `DENY`
**Purpose**: Prevents the page from being embedded in frames (clickjacking protection)

### 3. X-Content-Type-Options

**Value**: `nosniff`
**Purpose**: Prevents MIME type sniffing attacks

### 4. X-XSS-Protection

**Value**: `1; mode=block`
**Purpose**: Enables browser's built-in XSS protection

### 5. Referrer-Policy

**Value**: `strict-origin-when-cross-origin`
**Purpose**: Controls how much referrer information is sent with requests

### 6. Permissions-Policy

**Value**: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=()`
**Purpose**: Disables sensitive browser APIs that the app doesn't need

### 7. Strict-Transport-Security (HSTS)

**Value**: `max-age=31536000; includeSubDomains; preload`
**Purpose**: Forces HTTPS connections (production only)

## Implementation Files

### 1. HTML Meta Tags (`public/index.html`)

- Primary CSP implementation via meta tags
- Works across all hosting platforms
- Immediate protection during page load

### 2. Netlify/Vercel Headers (`public/_headers`)

- Server-level header configuration
- Enhanced CSP with additional directives
- Platform-specific optimizations

### 3. Apache Configuration (`public/.htaccess`)

- Apache server configuration
- Includes caching and compression rules
- SPA routing fallback

## Security Improvements Made

### ErrorBoundary Security Fix

**Issue**: Previously stored unencrypted user ID in localStorage

```typescript
// ❌ BEFORE - Security Risk
userId: localStorage.getItem('userId') || 'anonymous';
```

**Solution**: Use secure Firebase auth instead

```typescript
// ✅ AFTER - Secure Implementation
private getCurrentUserIdSecure(): string | null {
  try {
    const { getCurrentUserId } = require('../firebase');
    return getCurrentUserId();
  } catch {
    return null; // Fail securely
  }
}
```

**Benefits**:

- No sensitive data stored in localStorage
- Uses Firebase's secure authentication context
- Fails securely if auth is unavailable
- Prevents data leakage through browser storage

## Testing CSP Implementation

### 1. Browser Developer Tools

- Check Network tab for CSP violations
- Look for console warnings about blocked resources
- Verify headers in Response Headers

### 2. CSP Validator Tools

- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [CSP Scanner](https://cspscanner.com/)

### 3. Manual Testing

```bash
# Test with curl
curl -I https://yourdomain.com
```

## Monitoring and Maintenance

### 1. CSP Reporting (Future Enhancement)

Add reporting endpoint to track violations:

```
Content-Security-Policy: ...; report-uri /csp-report
```

### 2. Gradual Tightening

Start with permissive policy and gradually tighten:

1. Current: Allow 'unsafe-inline' for development
2. Future: Remove 'unsafe-inline', use nonces/hashes
3. Advanced: Implement strict CSP with nonces

### 3. Regular Reviews

- Review CSP policy quarterly
- Update for new third-party services
- Monitor violation reports

## Browser Compatibility

| Header             | Chrome  | Firefox    | Safari     | Edge    |
| ------------------ | ------- | ---------- | ---------- | ------- |
| CSP                | ✅ Full | ✅ Full    | ✅ Full    | ✅ Full |
| X-Frame-Options    | ✅      | ✅         | ✅         | ✅      |
| HSTS               | ✅      | ✅         | ✅         | ✅      |
| Permissions-Policy | ✅      | ⚠️ Partial | ⚠️ Partial | ✅      |

## Deployment Checklist

- [ ] CSP headers are set correctly
- [ ] HSTS is enabled for HTTPS domains
- [ ] No CSP violations in browser console
- [ ] Error boundary no longer uses localStorage for user ID
- [ ] X-Frame-Options prevents embedding
- [ ] Security headers validator passes
- [ ] Performance impact is minimal

## Common Issues and Solutions

### 1. React Inline Scripts Blocked

**Issue**: CSP blocks React's inline scripts
**Solution**: Allow 'unsafe-inline' for script-src (development) or use nonces (production)

### 2. Firebase Connection Issues

**Issue**: CSP blocks Firebase connections
**Solution**: Ensure all Firebase domains are in connect-src

### 3. Google Fonts Loading Issues

**Issue**: CSP blocks Google Fonts
**Solution**: Add fonts.googleapis.com to style-src and fonts.gstatic.com to font-src

## Security Best Practices

1. **Principle of Least Privilege**: Only allow necessary domains
2. **Regular Updates**: Keep CSP updated with new requirements
3. **Monitoring**: Implement CSP reporting in production
4. **Testing**: Test CSP changes in staging environment
5. **Documentation**: Keep this document updated with changes

## References

- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP CSP Guide](https://owasp.org/www-community/controls/Content_Security_Policy)
- [Google CSP Guide](https://developers.google.com/web/fundamentals/security/csp)
