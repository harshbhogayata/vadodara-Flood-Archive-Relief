const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Files and directories to copy
const assets = [
    'index.html',
    'style.css',
    'app.js',
    'data.js',
    'translations.js',
    'sw.js',
    'social-preview.png'
];

// Clean or create dist directory
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

console.log('📂 Building project to ./dist...');

// Copy Function
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (exists) {
            fs.copyFileSync(src, dest);
            console.log(`   - Copied ${path.basename(src)}`);
        } else {
            console.warn(`   ⚠️ Warning: Source ${src} not found.`);
        }
    }
}

// Execute Copy
assets.forEach(asset => {
    copyRecursiveSync(path.join(__dirname, asset), path.join(distDir, asset));
});

console.log('✅ Build complete!');
