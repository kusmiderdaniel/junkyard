# Unified Versioning System

## Overview

To eliminate merge conflicts when creating PRs from develop to main, we've implemented a unified versioning system using the format `2.DDMMYYYYa` across all environments.

## Version Format

- **Base Format**: `2.DDMMYYYY`
- **Letter Suffix**: Automatically added for multiple deployments on the same day (`a`, `b`, `c`, etc.)
- **Example**: `2.25062025a` (second deployment on June 25, 2025)

## How It Works

### Development Environment (develop branch)

- **Auto-versioning**: Each push to `develop` generates a new version and commits it back
- **Source of Truth**: Only the develop branch creates and commits version changes
- **Deployment**: Immediately deploys to development Firebase project

### Staging Environment (main branch)

- **Uses Existing Version**: Deploys whatever version is currently in the main branch
- **No Version Generation**: Does not create new versions or commit changes
- **Deployment**: Deploys to staging Firebase project when main branch is updated

### Production Environment (manual)

- **Uses Existing Version**: Deploys whatever version is currently in the main branch
- **Manual Trigger**: Only deploys via workflow_dispatch
- **No Version Generation**: Does not create new versions or commit changes

## Benefits

### ✅ No More Merge Conflicts

- Version files (`AppFooter.tsx`, `Login.tsx`, `version.json`) will always be identical across branches
- PRs from develop to main will have clean merges

### ✅ Simplified Workflow

- Single version format across all environments
- Clear source of truth (develop branch generates versions)
- Automatic letter suffixes for multiple daily deployments

### ✅ Deployment Clarity

- Development gets new versions automatically
- Staging and production deploy tested versions from main
- Easy to track what version is deployed where

## Files Managed by Versioning

The automated versioning system updates:

- `src/version.json` - Version tracking data
- `src/components/AppFooter.tsx` - Footer version display
- `src/components/Login.tsx` - Login page version display

## Usage

### Normal Development Flow

1. Push to `develop` branch
2. GitHub Actions automatically generates new version
3. Version is committed back to `develop`
4. Deploy to development environment

### Promoting to Staging

1. Create PR from `develop` to `main` (no conflicts!)
2. Merge PR
3. GitHub Actions deploys existing version to staging

### Deploying to Production

1. Use workflow_dispatch from main branch
2. Deploys existing version to production
3. No version changes are made

## Migration Notes

- Removed environment-specific suffixes (`-dev`, `-staging`)
- Unified deployment tracking in `version.json`
- Only develop branch commits version changes
- Staging and production use read-only permissions for version files

This system ensures consistent versioning across all environments while eliminating merge conflicts.
