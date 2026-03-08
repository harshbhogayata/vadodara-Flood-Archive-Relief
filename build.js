const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const mode = process.argv.includes('--verify')
    ? 'verify'
    : process.argv.includes('--check')
        ? 'check'
        : 'build';

const assets = [
    'index.html',
    'style.css',
    'app.js',
    'data.js',
    'translations.js',
    'sw.js',
    'social-preview.png',
    'manifest.json'
];

const syntaxCheckFiles = ['app.js', 'build.js', 'sw.js', 'data.js', 'translations.js'];

function readBuffer(file) {
    return fs.readFileSync(path.join(rootDir, file));
}

function readText(file) {
    return readBuffer(file).toString('utf8').replace(/^\uFEFF/, '');
}

function buildVersion() {
    const pkg = JSON.parse(readText('package.json'));
    const hash = crypto.createHash('sha256');

    assets.forEach((file) => {
        hash.update(readBuffer(file));
    });

    return `v${pkg.version}-${hash.digest('hex').slice(0, 8)}`;
}

function renderFile(file, version) {
    const source = readBuffer(file);

    if (!/\.(html|js)$/.test(file)) {
        return source;
    }

    return Buffer.from(source.toString('utf8').replace(/__APP_VERSION__/g, version), 'utf8');
}

function buildArtifacts(version) {
    return assets.map((file) => ({
        file,
        content: renderFile(file, version)
    }));
}

function cleanDist() {
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
}

function writeArtifacts(artifacts) {
    cleanDist();

    artifacts.forEach(({ file, content }) => {
        const outputPath = path.join(distDir, file);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content);
    });
}

function verifyArtifacts(artifacts) {
    const mismatches = [];

    artifacts.forEach(({ file, content }) => {
        const outputPath = path.join(distDir, file);

        if (!fs.existsSync(outputPath)) {
            mismatches.push(`${file} (missing)`);
            return;
        }

        const current = fs.readFileSync(outputPath);
        if (!current.equals(content)) {
            mismatches.push(file);
        }
    });

    return mismatches;
}

function runSyntaxChecks() {
    syntaxCheckFiles.forEach((file) => {
        try {
            new vm.Script(readText(file), { filename: file });
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }
    });
}

const version = buildVersion();
const artifacts = buildArtifacts(version);

if (mode === 'verify') {
    const mismatches = verifyArtifacts(artifacts);
    if (mismatches.length > 0) {
        console.error('dist is out of date with source:');
        mismatches.forEach((file) => console.error(` - ${file}`));
        process.exit(1);
    }

    console.log(`dist matches source for ${version}`);
    process.exit(0);
}

if (mode === 'check') {
    runSyntaxChecks();
    writeArtifacts(artifacts);
    const mismatches = verifyArtifacts(artifacts);
    if (mismatches.length > 0) {
        console.error('Generated dist verification failed.');
        process.exit(1);
    }

    console.log(`Checks passed and dist regenerated for ${version}`);
    process.exit(0);
}

writeArtifacts(artifacts);
console.log(`Build complete for ${version}`);
