# Firebase Hosting Caching Strategy

## Overview

This document explains the caching configuration implemented in `firebase.json` to optimize performance while ensuring proper updates.

## Caching Rules

### 1. Static Assets (Long-term caching)

**Files**: `/static/js/**`, `/static/css/**`, `/static/media/**`

- **Cache Duration**: 1 year (31,536,000 seconds)
- **Policy**: `public, max-age=31536000, immutable`
- **Rationale**: Create React App includes content hashes in filenames, making them immutable

### 2. Font Files (Long-term caching)

**Files**: `**/*.@(woff|woff2|ttf|eot)`

- **Cache Duration**: 1 year (31,536,000 seconds)
- **Policy**: `public, max-age=31536000`
- **Rationale**: Font files rarely change and have significant download costs

### 3. Images (Medium-term caching)

**Files**: `**/*.@(jpg|jpeg|gif|png|svg|webp|ico)`

- **Cache Duration**: 30 days (2,592,000 seconds)
- **Policy**: `public, max-age=2592000`
- **Rationale**: Balance between caching benefits and update frequency

### 4. PWA Manifest (Short-term caching)

**Files**: `/manifest.json`

- **Cache Duration**: 1 day (86,400 seconds)
- **Policy**: `public, max-age=86400`
- **Rationale**: Allow relatively quick updates to PWA configuration

### 5. Critical Files (No caching)

**Files**: `/service-worker.js`, `/index.html`

- **Cache Duration**: 0 seconds
- **Policy**: `no-cache, no-store, must-revalidate`
- **Rationale**: Must always fetch latest version for proper app updates

### 6. Default Fallback (Short-term caching)

**Files**: All other files

- **Cache Duration**: 1 hour (3,600 seconds)
- **Policy**: `public, max-age=3600`
- **Rationale**: Conservative caching for unspecified files

## Security Headers

Additional security headers are applied to all files:

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information

## Performance Benefits

1. **Reduced Server Load**: Static assets cached for 1 year
2. **Faster Load Times**: Subsequent visits load from browser cache
3. **Bandwidth Savings**: Fewer file downloads for repeat visitors
4. **Better UX**: Instant loading of cached resources

## Deployment Considerations

- Always test caching behavior in staging environment
- Monitor cache hit rates using Firebase Hosting analytics
- Consider cache invalidation strategies for emergency updates
- Use `firebase hosting:clone` for blue-green deployments if needed

## Cache Invalidation

Files with content hashes (JS/CSS) automatically invalidate when updated.
For other files, consider versioning strategies if manual invalidation is needed.
