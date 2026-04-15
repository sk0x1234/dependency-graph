# Dependency Analysis Scripts

Three utility scripts to analyze and trace dependencies in `package-lock.json`.

## Quick Start

### Option 1: Copy to your repo (Recommended)

```bash
# Download the scripts to your project root
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/trace-dependency.js | node /dev/stdin <package-name>
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/generate-chain.js | node /dev/stdin <package-name>
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/dep-stats.js | node /dev/stdin
```

Or copy locally:
```bash
# Make executable
cp trace-dependency.js generate-chain.js dep-stats.js /your/repo/
chmod +x trace-dependency.js generate-chain.js dep-stats.js

# Then run
node trace-dependency.js <package-name>
node generate-chain.js <package-name>
node dep-stats.js
```

### Option 2: Use via curl (on-the-fly, no installation)

```bash
# Trace a package
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/trace-dependency.js | node /dev/stdin brace-expansion

# Generate full chain
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/generate-chain.js | node /dev/stdin react-query

# Show stats
curl -s https://raw.githubusercontent.com/sk0x1234/dependency-graph/refs/heads/main/dep-stats.js | node /dev/stdin
```

### Option 3: Add to package.json

```json
{
  "scripts": {
    "dep:trace": "node trace-dependency.js",
    "dep:chain": "node generate-chain.js", 
    "dep:stats": "node dep-stats.js"
  }
}
```

Then run:
```bash
npm run dep:trace brace-expansion
npm run dep:chain react-query
npm run dep:stats
```

---

## 1. `trace-dependency.js` - Package Tracer

Find what packages depend on a given package and what it depends on.

### Usage

```bash
node trace-dependency.js <package-name> [--upstream] [--downstream] [--all]
```

### Options

- `--upstream` - Only show packages that depend on it
- `--downstream` - Only show packages it depends on
- `--all` - Verbose mode with full dependency chains

### Examples

```bash
# Both upstream and downstream (default)
node trace-dependency.js brace-expansion

# What depends on this package
node trace-dependency.js react-query --upstream

# What this package depends on
node trace-dependency.js rimraf --downstream

# Verbose with full chains
node trace-dependency.js ata-layer --all
```

### Sample Output

```
Dependency Chain for: brace-expansion
============================================================

Package Details:
  Path: brace-expansion
  Version: 2.0.2

📦 What depends on it (UPSTREAM):
  → minimatch (^2.0.1)
    → glob (^7.1.3)
      → rimraf (^3.0.0)

📚 What it depends on (DOWNSTREAM):
  → balanced-match (^1.0.0)
```

---

## 2. `generate-chain.js` - Chain Generator

Generate a complete dependency chain showing all upstream/downstream paths.

### Usage

```bash
node generate-chain.js <package-name> [output-file]
```

### Examples

```bash
# Generate chain (saves to chain-brace-expansion.txt)
node generate-chain.js brace-expansion

# Generate with custom output file
node generate-chain.js react-query chain-react-query.md
```

### Sample Output

```
DEPENDENCY CHAIN ANALYSIS
================================================================================

Target Package: brace-expansion
Version: 2.0.2
Path: node_modules/brace-expansion

________________________________________________________________________________
UPSTREAM DEPENDENCIES (What depends on brace-expansion)
________________________________________________________________________________

Chain 1:
brace-expansion
  ← minimatch
  ← glob
  ← rimraf
  ← broadcast-channel
  ← react-query
  ← data-layer

________________________________________________________________________________
DOWNSTREAM DEPENDENCIES (What brace-expansion depends on)
________________________________________________________________________________

Chain 1:
brace-expansion
  → balanced-match

================================================================================
SUMMARY
================================================================================
Upstream chains: 1
Downstream chains: 1
```

---

## 3. `dep-stats.js` - Dependency Statistics

Show statistics about packages and their dependencies.

### Usage

```bash
node dep-stats.js [package-name]
```

### Examples

```bash
# Overall statistics
node dep-stats.js

# Stats for specific package
node dep-stats.js data-layer

# Check any package
node dep-stats.js react
```

### Sample Output - Overall

```
📊 Package Lock Statistics
══════════════════════════════════════════════════
Total packages:          725
Packages with deps:      431
Root dependencies:       108
Total dependency edges:  1372
Avg deps per package:    3.18

Largest dependency tree:
  webpack-dev-server
  28 dependencies
```

### Sample Output - Package-Specific

```
📦 Package: data-layer
══════════════════════════════════════════════════
Version:    1.14.1
Path:       node_modules//data-layer
Dependencies:       6
Depended on by:     1 packages

Direct dependencies:
  • @microapp/utils-browser@^0.8.1
  • @native/message-hub@^0.0.21
  • html-entities@^2.5.2
  • react-query@^3.39.3
  • uuid@10.0.0
  • whatwg-fetch@^3.6.2
```

---

## Common Use Cases

### 🔍 Find why a package is in your lock file

Example: You noticed `brace-expansion` in your lock file after running `npm install --omit=dev`.

```bash
node trace-dependency.js brace-expansion --all
# or
node generate-chain.js brace-expansion
```

**Result shows the full chain:**
```
@data-layer (production)
  → react-query
    → broadcast-channel
      → rimraf
        → glob
          → minimatch
            → brace-expansion ✓
```

### 📦 Check package dependencies

```bash
node dep-stats.js @data-layer
# Shows all 6 dependencies of @data-layer
```

### 🔗 Trace a specific dependency issue

```bash
# Step 1: Find the unwanted package
node generate-chain.js unwanted-package

# Step 2: Understand the chain
node trace-dependency.js parent-package --upstream

# Step 3: Keep tracing up
node trace-dependency.js grandparent-package --upstream
```

### 📊 Understand your dependency graph

```bash
# See overall stats
node dep-stats.js

# Check critical packages
node dep-stats.js react
node dep-stats.js webpack
node dep-stats.js typescript
```

---

## Requirements

- **Node.js** (any version)
- **package-lock.json** in repo root
- **No dependencies** - scripts are self-contained

## Compatibility

✅ Works with any Node.js project (React, Vue, Angular, etc.)  
✅ Works with npm (npm v6+)  
✅ Works with package-lock.json files  

---

## Real Example

In the web-app-inventory repo, we discovered `brace-expansion` came from:

```bash
$ node trace-dependency.js brace-expansion --all

Dependency Chain for: brace-expansion
============================================================

Package Details:
  Path: brace-expansion
  Version: 2.0.2

📦 What depends on it (UPSTREAM):
  → minimatch (^2.0.1)
    → glob (^7.1.3)
      → rimraf (^3.0.2)
        → broadcast-channel (^3.4.1)
          → react-query (^3.39.3)
            → @data-layer (v1.14.1)
```

This helped identify that `@data-layer` → `react-query` → `broadcast-channel` was the source.

---

## Tips & Tricks

### Get JSON output (for further processing)

Edit scripts to add `--json` flag to output machine-readable JSON:

```bash
# Modify the script to add:
console.log(JSON.stringify(results, null, 2));
```

### Create aliases for faster access

```bash
# In ~/.zshrc or ~/.bash_profile
alias trace="node /path/to/trace-dependency.js"
alias chain="node /path/to/generate-chain.js"
alias deps="node /path/to/dep-stats.js"

# Then use:
trace brace-expansion
chain react-query
deps
```

### Redirect to file for sharing

```bash
node dep-stats.js > project-deps.txt
node generate-chain.js @data-layer > data-layer-chain.txt
```

---

## Troubleshooting

### "Package not found"

```bash
# Package might not be installed yet
npm install

# Or check the exact package name
node dep-stats.js
# Lists all installed packages by category
```

### Script not found when using curl

Make sure you're piping correctly:

```bash
# ❌ Wrong - tries to execute brace-expansion as a module
curl -s https://... | node brace-expansion

# ✅ Correct - passes brace-expansion to the script
curl -s https://... | node /dev/stdin brace-expansion
```

### Slow on very large lock files

The scripts are optimized for most projects. For extremely large mono-repos (1000+ packages):

- Use `--upstream` or `--downstream` only instead of both
- Save output to file: `node generate-chain.js package > file.txt`
- Use `dep-stats.js` for quick aggregated stats

---

## For DevOps/CI Integration

```bash
#!/bin/bash
# Check if prod deps contain any security issues

packages_to_check=("lodash" "moment" "request")

for pkg in "${packages_to_check[@]}"; do
  if node dep-stats.js "$pkg" 2>/dev/null | grep -q "Packages with deps"; then
    echo "⚠️  Found $pkg in dependencies"
    node generate-chain.js "$pkg" >> dependency-report.txt
  fi
done
```

---

## License & Attribution

These scripts are standalone utilities for analyzing npm dependencies.  
No external dependencies required.
