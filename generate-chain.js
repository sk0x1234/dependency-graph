#!/usr/bin/env node

/**
 * Generate complete dependency chain visualization
 * Usage: node generate-chain.js <package-name> [output-file]
 * 
 * Examples:
 *   node generate-chain.js brace-expansion
 *   node generate-chain.js brace-expansion chain.txt
 *   node generate-chain.js react-query chain.md
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node generate-chain.js <package-name> [output-file]');
  console.error('');
  console.error('Examples:');
  console.error('  node generate-chain.js brace-expansion');
  console.error('  node generate-chain.js brace-expansion chain.txt');
  process.exit(1);
}

const targetPackage = args[0];
const outputFile = args[1] || `chain-${targetPackage}.txt`;

const lockFilePath = path.join(__dirname, 'package-lock.json');
let packageLock;

try {
  packageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
} catch (e) {
  console.error(`Error reading package-lock.json: ${e.message}`);
  process.exit(1);
}

const packages = packageLock.packages || {};
const chains = [];

// Extract all the information we need
function extractPackageInfo(pkgPath) {
  const pkg = packages[pkgPath];
  if (!pkg) return null;

  const parts = pkgPath.replace(/^node_modules\//, '').split('/node_modules/');
  const name = parts[parts.length - 1];

  return {
    path: pkgPath,
    name: name,
    version: pkg.version || 'unknown',
    dependencies: pkg.dependencies || {},
  };
}

// Find package
function findPackage(name) {
  for (const [pkgPath, pkg] of Object.entries(packages)) {
    if (pkgPath.includes(`node_modules/${name}`) || pkgPath.includes(`node_modules/${name}@`)) {
      return extractPackageInfo(pkgPath);
    }
  }
  return null;
}

// Build complete chain upstream
function buildUpstreamChain(packageName, visited = new Set(), chain = []) {
  if (visited.has(packageName)) {
    return [chain];
  }
  visited.add(packageName);

  const dependents = [];
  for (const [pkgPath, pkg] of Object.entries(packages)) {
    if (!pkg.dependencies) continue;
    for (const depName of Object.keys(pkg.dependencies)) {
      if (depName === packageName) {
        const info = extractPackageInfo(pkgPath);
        if (info) dependents.push({ name: info.name, version: info.version });
      }
    }
  }

  if (dependents.length === 0) {
    return [chain];
  }

  const allChains = [];
  for (const dependent of dependents) {
    const newChain = [...chain, dependent];
    allChains.push(...buildUpstreamChain(dependent.name, new Set(visited), newChain));
  }

  return allChains;
}

// Build complete chain downstream
function buildDownstreamChain(packageName, visited = new Set(), chain = []) {
  if (visited.has(packageName)) {
    return [chain];
  }
  visited.add(packageName);

  const pkg = findPackage(packageName);
  if (!pkg || Object.keys(pkg.dependencies).length === 0) {
    return [chain];
  }

  const allChains = [];
  for (const depName of Object.keys(pkg.dependencies)) {
    const depInfo = findPackage(depName);
    const newChain = [...chain, { name: depName, version: depInfo ? depInfo.version : 'unknown' }];
    allChains.push(...buildDownstreamChain(depName, new Set(visited), newChain));
  }

  return allChains;
}

// Generate output
function generateOutput() {
  const pkg = findPackage(targetPackage);

  if (!pkg) {
    console.error(`\n✗ Package "${targetPackage}" not found in package-lock.json\n`);
    process.exit(1);
  }

  let output = '';
  output += `DEPENDENCY CHAIN ANALYSIS\n`;
  output += `${'='.repeat(80)}\n\n`;

  output += `Target Package: ${targetPackage}\n`;
  output += `Version: ${pkg.version}\n`;
  output += `Path: ${pkg.path}\n\n`;

  // Upstream chains
  output += `${'_'.repeat(80)}\n`;
  output += `UPSTREAM DEPENDENCIES (What depends on ${targetPackage})\n`;
  output += `${'_'.repeat(80)}\n\n`;

  const upstreamChains = buildUpstreamChain(targetPackage);
  console.log(`Building upstream chain...`);

  if (upstreamChains.length === 0 || (upstreamChains.length === 1 && upstreamChains[0].length === 0)) {
    output += `No upstream dependencies found.\n\n`;
  } else {
    upstreamChains.forEach((chain, idx) => {
      if (chain.length === 0) return;
      output += `Chain ${idx + 1}:\n`;
      output += `${targetPackage} (${pkg.version})`;
      for (const dep of chain) {
        // Skip empty names (root dependencies)
        if (!dep.name || dep.name.trim() === '') continue;
        const depDisplay = typeof dep === 'string' ? dep : `${dep.name} (${dep.version})`;
        output += `\n  ← ${depDisplay}`;
      }
      output += `\n\n`;
    });
  }

  // Downstream chains
  output += `${'_'.repeat(80)}\n`;
  output += `DOWNSTREAM DEPENDENCIES (What ${targetPackage} depends on)\n`;
  output += `${'_'.repeat(80)}\n\n`;

  const downstreamChains = buildDownstreamChain(targetPackage);
  console.log(`Building downstream chain...`);

  if (downstreamChains.length === 0 || (downstreamChains.length === 1 && downstreamChains[0].length === 0)) {
    output += `No downstream dependencies found.\n\n`;
  } else {
    // Show only first 10 chains to avoid huge output
    const chainsToShow = downstreamChains.slice(0, 10);
    chainsToShow.forEach((chain, idx) => {
      if (chain.length === 0) return;
      output += `Chain ${idx + 1}:\n`;
      output += `${targetPackage} (${pkg.version})`;
      for (const dep of chain) {
        const depDisplay = typeof dep === 'string' ? dep : `${dep.name} (${dep.version})`;
        output += `\n  → ${depDisplay}`;
      }
      output += `\n\n`;
    });

    if (downstreamChains.length > 10) {
      output += `... and ${downstreamChains.length - 10} more chains (truncated)\n\n`;
    }
  }

  // Summary
  output += `${'='.repeat(80)}\n`;
  output += `SUMMARY\n`;
  output += `${'='.repeat(80)}\n`;
  output += `Upstream chains: ${upstreamChains.filter(c => c.length > 0).length}\n`;
  output += `Downstream chains: ${Math.min(downstreamChains.filter(c => c.length > 0).length, 10)}`;
  if (downstreamChains.length > 10) output += ` (+ more)`;
  output += `\n`;

  return output;
}

try {
  const output = generateOutput();

  // Print to terminal
  console.log('\n' + output);

  // Write to file
  fs.writeFileSync(outputFile, output, 'utf-8');
  console.log(`✓ Chain analysis also saved to: ${outputFile}\n`);
  console.log(`File size: ${(output.length / 1024).toFixed(2)} KB`);
} catch (e) {
  console.error(`Error generating output: ${e.message}`);
  process.exit(1);
}
