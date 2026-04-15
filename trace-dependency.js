#!/usr/bin/env node

/**
 * Trace dependency chains in package-lock.json
 * Usage: node trace-dependency.js [package-name] [--upstream] [--downstream] [--all]
 * 
 * Examples:
 *   node trace-dependency.js brace-expansion          # Shows both directions
 *   node trace-dependency.js brace-expansion --all     # Verbose with full paths
 *   node trace-dependency.js react-query --upstream    # What depends on it
 *   node trace-dependency.js rimraf --downstream       # What it depends on
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node trace-dependency.js <package-name> [--upstream] [--downstream] [--all]');
  console.error('');
  console.error('Examples:');
  console.error('  node trace-dependency.js brace-expansion          # Both directions');
  console.error('  node trace-dependency.js brace-expansion --all     # Verbose output');
  console.error('  node trace-dependency.js react-query --upstream    # What depends on it');
  console.error('  node trace-dependency.js rimraf --downstream       # What it depends on');
  process.exit(1);
}

const packageName = args[0];
const showUpstream = args.includes('--upstream') || args.includes('--all') || args.length === 1;
const showDownstream = args.includes('--downstream') || args.includes('--all') || args.length === 1;
const verbose = args.includes('--all');

// Load package-lock.json
const lockFilePath = path.join(process.cwd(), 'package-lock.json');
let packageLock;

try {
  packageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
} catch (e) {
  console.error(`Error reading package-lock.json: ${e.message}`);
  process.exit(1);
}

const packages = packageLock.packages || {};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function colorize(text, color) {
  if (!process.stdout.isTTY) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

// Find all packages with matching name
function findPackage(name) {
  const matches = [];
  for (const [path, pkg] of Object.entries(packages)) {
    if (path.includes(`node_modules/${name}`) || path.includes(`node_modules/${name}@`)) {
      matches.push({ path, pkg });
    }
  }
  return matches;
}

// Get all packages that depend on a given package
function findDependents(targetName) {
  const dependents = [];
  for (const [pkgPath, pkg] of Object.entries(packages)) {
    if (!pkg.dependencies) continue;
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (depName === targetName) {
        dependents.push({
          path: pkgPath,
          name: pkgPath.split('/node_modules/').pop().split('@').slice(0, -1).join('@') || 'root',
          version: depVersion,
        });
      }
    }
  }
  return dependents;
}

// Recursively trace upstream (what depends on this)
function traceUpstream(packageName, visited = new Set(), depth = 0, maxDepth = 10) {
  if (depth > maxDepth || visited.has(packageName)) return [];
  visited.add(packageName);

  const dependents = findDependents(packageName);
  const result = [];

  for (const dependent of dependents) {
    result.push({ depth, ...dependent });
    if (verbose) {
      result.push(...traceUpstream(dependent.name.split('@').slice(0, -1).join('@'), visited, depth + 1, maxDepth));
    }
  }

  return result;
}

// Recursively trace downstream (what it depends on)
function traceDownstream(packageName, visited = new Set(), depth = 0, maxDepth = 10) {
  if (depth > maxDepth || visited.has(packageName)) return [];
  visited.add(packageName);

  const matches = findPackage(packageName);
  const result = [];

  for (const match of matches) {
    if (!match.pkg.dependencies) continue;

    for (const [depName, depVersion] of Object.entries(match.pkg.dependencies)) {
      result.push({ depth, name: depName, version: depVersion });
      if (verbose) {
        result.push(...traceDownstream(depName, visited, depth + 1, maxDepth));
      }
    }
  }

  return result;
}

// Format and display results
function displayResults() {
  const matches = findPackage(packageName);

  if (matches.length === 0) {
    console.log(colorize(`\n✗ Package "${packageName}" not found in package-lock.json\n`, 'red'));
    return;
  }

  console.log(colorize(`\nDependency Chain for: ${packageName}`, 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));

  // Show package info
  console.log(colorize('\nPackage Details:', 'yellow'));
  for (const match of matches) {
    const cleanPath = match.path.replace(/^node_modules\//, '');
    console.log(`  Path: ${colorize(cleanPath, 'gray')}`);
    console.log(`  Version: ${match.pkg.version || 'unknown'}`);
  }

  // Show upstream dependencies
  if (showUpstream) {
    const upstream = traceUpstream(packageName);
    if (upstream.length > 0) {
      console.log(colorize('\n📦 What depends on it (UPSTREAM):', 'green'));
      const grouped = {};
      for (const item of upstream) {
        const indent = '  '.repeat(item.depth + 1);
        if (!grouped[item.depth]) grouped[item.depth] = [];
        grouped[item.depth].push(`${indent}→ ${colorize(item.name, 'cyan')} (${item.version})`);
      }
      for (const depth of Object.keys(grouped).sort((a, b) => a - b)) {
        grouped[depth].forEach(line => console.log(line));
      }
    } else {
      console.log(colorize('\n📦 No upstream dependencies found', 'gray'));
    }
  }

  // Show downstream dependencies
  if (showDownstream) {
    const downstream = traceDownstream(packageName);
    if (downstream.length > 0) {
      console.log(colorize('\n📚 What it depends on (DOWNSTREAM):', 'green'));
      const grouped = {};
      for (const item of downstream) {
        const indent = '  '.repeat(item.depth + 1);
        if (!grouped[item.depth]) grouped[item.depth] = [];
        grouped[item.depth].push(`${indent}→ ${colorize(item.name, 'cyan')} (${item.version})`);
      }
      for (const depth of Object.keys(grouped).sort((a, b) => a - b)) {
        grouped[depth].forEach(line => console.log(line));
      }
    } else {
      console.log(colorize('\n📚 No downstream dependencies found', 'gray'));
    }
  }

  console.log('');
}

displayResults();
