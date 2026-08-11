#!/usr/bin/env bash
# Clean compiled files in bin and src directories

# Ensure we only search in directories that exist to avoid 'find' errors
dirs=()
[[ -d "bin" ]] && dirs+=("bin")
[[ -d "src" ]] && dirs+=("src")

if [ ${#dirs[@]} -gt 0 ]; then
  find "${dirs[@]}" -type f \( -name "*.js" -o -name "*.d.ts" \) -delete
fi
