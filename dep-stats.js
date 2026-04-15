#!/usr/bin/env node

/**
 * Quick stats on package dependencies
 * Usage: node dep-stats.js [package-name] [options]
 * 
 * Options:
 *   --tree      Generate full dependency tree (default: root level only)
 *   --depth N   Limit tree depth (default: 2)
 * 
 * Examples:
 *   node dep-stats.js                 # Show all stats
 *   node dep-stats.js --tree          # Show full dependency tree
 *   node dep-stats.js --tree --depth 3
 *   node dep-stats.js @clover/data-layer
 *   node dep-stats.js react-query
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const hasTreeFlag = args.includes('--tree');
const depthIndex = args.indexOf('--depth');
const maxDepth = depthIndex >= 0 ? parseInt(args[depthIndex + 1]) : 2;
const targetPackage = args[0] && !args[0].startsWith('--') ? args[0] : null;

const lockFilePath = path.join(__dirname, 'package-lock.json');
let packageLock;

try {
  packageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
} catch (e) {
  console.error(`Error reading package-lock.json: ${e.message}`);
  process.exit(1);
}

const packages = packageLock.packages || {};

// Build dependency tree
function buildDepTree(pkgName, visited = new Set(), depth = 0) {
  if (visited.has(pkgName) || depth > maxDepth) {
    return null;
  }
  visited.add(pkgName);

  // Find the package
  let pkg = null;
  let pkgPath = null;
  
  for (const [path, p] of Object.entries(packages)) {
    if (path.includes(`node_modules/${pkgName}`) || path === `node_modules/${pkgName}`) {
      pkg = p;
      pkgPath = path;
      break;
    }
  }

  if (!pkg || !pkg.dependencies) {
    return { name: pkgName, depth, deps: [] };
  }

  const deps = Object.keys(pkg.dependencies).map(depName => 
    buildDepTree(depName, new Set(visited), depth + 1)
  ).filter(Boolean);

  return { name: pkgName, depth, deps, count: deps.length };
}

// Render tree to string
function renderTree(node, prefix = '', isLast = true) {
  if (!node) return '';

  const connector = isLast ? '└── ' : '├── ';
  const depCount = node.deps && node.deps.length > 0 ? ` (${node.count})` : '';
  
  let output = prefix + connector + node.name + depCount + '\n';
  
  if (node.deps && node.deps.length > 0) {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    node.deps.forEach((dep, idx) => {
      const isLastDep = idx === node.deps.length - 1;
      output += renderTree(dep, newPrefix, isLastDep);
    });
  }

  return output;
}

// Show full dependency tree
function showTree() {
  if (packages[''].dependencies) {
    const rootDeps = Object.keys(packages[''].dependencies);
    
    console.log('\n🌳 Full Dependency Tree');
    console.log('═'.repeat(60));
    console.log(`Total root dependencies: ${rootDeps.length}\n`);

    rootDeps.forEach((dep, idx) => {
      const isLast = idx === rootDeps.length - 1;
      const tree = buildDepTree(dep);
      
      // For root level, show without prefix
      console.log(`${isLast ? '└── ' : '├── '}${tree.name}${tree.count ? ` (${tree.count})` : ''}`);
      
      if (tree.deps && tree.deps.length > 0) {
        const prefix = isLast ? '    ' : '│   ';
        tree.deps.forEach((depTree, subIdx) => {
          const isLastSub = subIdx === tree.deps.length - 1;
          process.stdout.write(renderTree(depTree, prefix, isLastSub));
        });
      }
    });
    
    console.log('');
  }
}

// Simple stats
function showStats() {
  if (!targetPackage) {
    // Show overall stats
    const stats = {
      totalPackages: Object.keys(packages).length,
      packagesWithDeps: 0,
      rootDeps: 0,
      totalDepEdges: 0,
      largestDepTree: { pkg: '', count: 0 },
    };

    for (const [pkgPath, pkg] of Object.entries(packages)) {
      if (pkg.dependencies) {
        stats.packagesWithDeps++;
        const depCount = Object.keys(pkg.dependencies).length;
        stats.totalDepEdges += depCount;

        if (depCount > stats.largestDepTree.count) {
          stats.largestDepTree = {
            pkg: pkgPath.replace(/^node_modules\//, ''),
            count: depCount,
          };
        }
      }
    }

    // Count root deps
    if (packages[''].dependencies) {
      stats.rootDeps = Object.keys(packages[''].dependencies).length;
    }

    console.log('\n📊 Package Lock Statistics');
    console.log('═'.repeat(50));
    console.log(`Total packages:          ${stats.totalPackages}`);
    console.log(`Packages with deps:      ${stats.packagesWithDeps}`);
    console.log(`Root dependencies:       ${stats.rootDeps}`);
    console.log(`Total dependency edges:  ${stats.totalDepEdges}`);
    console.log(`Avg deps per package:    ${(stats.totalDepEdges / stats.packagesWithDeps).toFixed(2)}`);
    console.log(`\nLargest dependency tree:`);
    console.log(`  ${stats.largestDepTree.pkg}`);
    console.log(`  ${stats.largestDepTree.count} dependencies`);
    console.log('');
  } else {
    // Show stats for specific package
    function findPackageInfo(name) {
      for (const [pkgPath, pkg] of Object.entries(packages)) {
        if (pkgPath.includes(`node_modules/${name}`) || pkgPath.includes(`node_modules/${name}@`)) {
          return { path: pkgPath, pkg };
        }
      }
      return null;
    }

    const info = findPackageInfo(targetPackage);
    if (!info) {
      console.log(`\n✗ Package "${targetPackage}" not found\n`);
      process.exit(1);
    }

    const depCount = info.pkg.dependencies ? Object.keys(info.pkg.dependencies).length : 0;

    // Count how many packages depend on this
    let dependentCount = 0;
    for (const [, pkg] of Object.entries(packages)) {
      if (!pkg.dependencies) continue;
      if (targetPackage in pkg.dependencies) {
        dependentCount++;
      }
    }

    console.log(`\n📦 Package: ${targetPackage}`);
    console.log('═'.repeat(50));
    console.log(`Version:    ${info.pkg.version || 'unknown'}`);
    console.log(`Path:       ${info.path}`);
    console.log(`Dependencies:       ${depCount}`);
    console.log(`Depended on by:     ${dependentCount} packages`);

    if (depCount > 0) {
      console.log(`\nDirect dependencies:`);
      for (const [dep, version] of Object.entries(info.pkg.dependencies)) {
        console.log(`  • ${dep}@${version}`);
      }
    }
    console.log('');
  }
}

// Main execution
if (hasTreeFlag) {
  showTree();
} else {
  showStats();
}
