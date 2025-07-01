#!/bin/bash

# Setup git merge strategies to auto-resolve version conflicts
echo "🔧 Setting up git merge strategies for automatic conflict resolution..."

# Configure git to always take the incoming version for version.json
git config merge.theirs.driver true

echo "✅ Git merge strategies configured successfully!"
echo ""
echo "This will automatically resolve conflicts in src/version.json by always taking"
echo "the version from the branch being merged (develop -> main)."
echo ""
echo "To manually resolve conflicts instead, run:"
echo "  git config --unset merge.theirs.driver" 