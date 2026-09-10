#!/usr/bin/env node

/**
 * Build script for nuvio-providers
 *
 * Bundles each provider from src/<provider>/ into a single JS file and generates
 * a scraper manifest entry for each provider. By default it emits into dist/,
 * but this can be overridden with --out-dir.
 *
 * Usage:
 *   node build.js                 # Build all providers into dist/
 *   node build.js vixsrc         # Build only vixsrc into dist/
 *   node build.js --out-dir build
 *   node build.js --minify
 *   node build.js --transpile
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const rootManifestPath = path.join(__dirname, 'manifest.json');
const rootDefaultsPath = path.join(__dirname, 'scraper-defaults.json');
const defaultOutputDir = 'dist';

const EXTERNAL_MODULES = [
    'cheerio-without-node-native',
    'react-native-cheerio',
    'cheerio',
    'crypto-js',
    'axios'
];

function readJsonFile(filePath, fallback = {}) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.warn(`⚠️  Failed to parse JSON: ${filePath} (${error.message})`);
        return fallback;
    }
}

function normalizePosixPath(filePath) {
    return filePath.split(path.sep).join('/');
}

function titleizeProviderName(providerName) {
    return providerName
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase());
}

function getOutputDir(args = process.argv.slice(2)) {
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (['--out-dir', '--output-dir', '--dist-dir'].includes(arg)) {
            return args[i + 1] || defaultOutputDir;
        }

        const match = arg.match(/^--(?:out-dir|output-dir|dist-dir)=(.+)$/);
        if (match) {
            return match[1] || defaultOutputDir;
        }
    }

    return defaultOutputDir;
}

function getProviderNamesToBuild(args = process.argv.slice(2)) {
    const filtered = args.filter(arg => {
        if (['--out-dir', '--output-dir', '--dist-dir', '--minify', '--transpile'].includes(arg)) {
            return false;
        }

        if (arg.startsWith('--out-dir=') || arg.startsWith('--output-dir=') || arg.startsWith('--dist-dir=')) {
            return false;
        }

        return !arg.startsWith('-');
    });

    if (filtered.length > 0) {
        return filtered;
    }

    if (!fs.existsSync(srcDir)) {
        console.error('❌ src/ directory not found. Create provider folders in src/<provider>/');
        process.exit(1);
    }

    return fs.readdirSync(srcDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !['_template', '_utils'].includes(d.name))
        .map(d => d.name);
}

function getRootManifestDefaults() {
    const manifest = readJsonFile(rootManifestPath, { scrapers: [] });
    const template = Array.isArray(manifest.scrapers) && manifest.scrapers.length > 0
        ? manifest.scrapers[0]
        : {};

    return {
        name: template.name || 'Provider',
        description: template.description || 'Auto-generated provider scraper',
        version: template.version || '1.0.0',
        author: template.author || 'Nuvio',
        supportedTypes: Array.isArray(template.supportedTypes) ? template.supportedTypes : ['movie', 'tv'],
        enabled: template.enabled !== undefined ? template.enabled : true,
        logo: template.logo || '',
        contentLanguage: Array.isArray(template.contentLanguage) ? template.contentLanguage : ['en'],
        formats: Array.isArray(template.formats) ? template.formats : ['mp4', 'mkv', 'hls'],
        limited: template.limited !== undefined ? template.limited : false,
        disabledPlatforms: Array.isArray(template.disabledPlatforms) ? template.disabledPlatforms : [],
        supportsExternalPlayer: template.supportsExternalPlayer !== undefined ? template.supportsExternalPlayer : true
    };
}

function getScraperDefaults() {
    const rootDefaults = readJsonFile(rootDefaultsPath, {});
    const manifestDefaults = getRootManifestDefaults();
    return {
        ...manifestDefaults,
        ...rootDefaults,
        supportedTypes: Array.isArray(rootDefaults.supportedTypes)
            ? rootDefaults.supportedTypes
            : Array.isArray(manifestDefaults.supportedTypes)
                ? manifestDefaults.supportedTypes
                : ['movie', 'tv'],
        contentLanguage: Array.isArray(rootDefaults.contentLanguage)
            ? rootDefaults.contentLanguage
            : Array.isArray(manifestDefaults.contentLanguage)
                ? manifestDefaults.contentLanguage
                : ['en'],
        formats: Array.isArray(rootDefaults.formats)
            ? rootDefaults.formats
            : Array.isArray(manifestDefaults.formats)
                ? manifestDefaults.formats
                : ['mp4', 'mkv', 'hls'],
        disabledPlatforms: Array.isArray(rootDefaults.disabledPlatforms)
            ? rootDefaults.disabledPlatforms
            : Array.isArray(manifestDefaults.disabledPlatforms)
                ? manifestDefaults.disabledPlatforms
                : []
    };
}

function resolveTemplateString(value, providerName, providerId) {
    if (typeof value !== 'string') {
        return value;
    }

    return value
        .replace(/\$providerName/gi, providerName)
        .replace(/\$providerId/gi, providerId);
}

function buildScraperEntry(providerName, providerDir, outputDir, builtFileName) {
    const defaults = getScraperDefaults();
    const localScraper = readJsonFile(path.join(providerDir, 'scraper.json'), {});
    const merged = { ...defaults, ...localScraper };
    const resolvedProviderId = localScraper.id || providerName;
    const relativeFilename = normalizePosixPath(builtFileName);
    const resolvedDefaultName = resolveTemplateString(merged.name, providerName, resolvedProviderId);
    const resolvedProviderName = resolveTemplateString(localScraper.name || resolvedDefaultName || titleizeProviderName(providerName), providerName, resolvedProviderId);
    const resolvedDefaultDescription = resolveTemplateString(merged.description, resolvedProviderName, resolvedProviderId);

    return {
        id: resolvedProviderId,
        name: resolvedProviderName,
        description: resolveTemplateString(localScraper.description || resolvedDefaultDescription || '$providerName provider.', resolvedProviderName, resolvedProviderId),
        version: localScraper.version || merged.version || '1.0.0',
        author: localScraper.author || merged.author || 'Nuvio',
        supportedTypes: Array.isArray(localScraper.supportedTypes)
            ? localScraper.supportedTypes
            : Array.isArray(merged.supportedTypes)
                ? merged.supportedTypes
                : ['movie', 'tv'],
        filename: relativeFilename,
        enabled: localScraper.enabled !== undefined ? localScraper.enabled : (merged.enabled !== undefined ? merged.enabled : true),
        logo: localScraper.logo !== undefined ? localScraper.logo : (merged.logo !== undefined ? merged.logo : ''),
        contentLanguage: Array.isArray(localScraper.contentLanguage)
            ? localScraper.contentLanguage
            : Array.isArray(merged.contentLanguage)
                ? merged.contentLanguage
                : ['en'],
        formats: Array.isArray(localScraper.formats)
            ? localScraper.formats
            : Array.isArray(merged.formats)
                ? merged.formats
                : ['mp4', 'mkv', 'hls'],
        limited: localScraper.limited !== undefined ? localScraper.limited : (merged.limited !== undefined ? merged.limited : false),
        disabledPlatforms: Array.isArray(localScraper.disabledPlatforms)
            ? localScraper.disabledPlatforms
            : Array.isArray(merged.disabledPlatforms)
                ? merged.disabledPlatforms
                : [],
        supportsExternalPlayer: localScraper.supportsExternalPlayer !== undefined
            ? localScraper.supportsExternalPlayer
            : (merged.supportsExternalPlayer !== undefined ? merged.supportsExternalPlayer : true)
    };
}

function writeManifest(sources, outputDir) {
    const repoManifest = readJsonFile(rootManifestPath, {});
    const manifest = {
        name: repoManifest.name || 'Nuvio Providers',
        version: repoManifest.version || '1.0.0',
        description: repoManifest.description || 'Generated providers for Nuvio',
        scrapers: sources
    };

    fs.mkdirSync(outputDir, { recursive: true });
    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`📝 Generated manifest: ${normalizePosixPath(path.relative(__dirname, manifestPath))}`);
}

async function buildProvider(providerName, outputDir, options = {}) {
    const providerDir = path.join(srcDir, providerName);
    const entryPoint = path.join(providerDir, 'index.js');
    const providerOutputDir = path.join(outputDir, 'providers');
    fs.mkdirSync(providerOutputDir, { recursive: true });
    const outFile = path.join(providerOutputDir, `${providerName}.js`);

    if (!fs.existsSync(entryPoint)) {
        console.warn(`⚠️  Skipping ${providerName}: no src/${providerName}/index.js found`);
        return null;
    }

    try {
        await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            outfile: outFile,
            format: 'cjs',
            platform: 'neutral',
            target: 'es2016',
            minify: options.minify || false,
            sourcemap: false,
            external: EXTERNAL_MODULES,
            banner: {
                js: `/**\n * ${providerName} - Built from src/${providerName}/\n * Generated: ${new Date().toISOString()}\n */`
            },
            logLevel: 'warning'
        });

        const stats = fs.statSync(outFile);
        const sizeKB = (stats.size / 1024).toFixed(1);
        const minifyIndicator = options.minify ? ' (minified)' : '';
        console.log(`✅ ${providerName}.js (${sizeKB} KB)${minifyIndicator}`);

        const relativeBundlePath = normalizePosixPath(path.join('providers', `${providerName}.js`));
        return buildScraperEntry(providerName, providerDir, outputDir, relativeBundlePath);
    } catch (err) {
        console.error(`❌ Failed to build ${providerName}:`, err.message);
        return null;
    }
}

async function transpileSingleFile(filename, outputDir) {
    const inputPath = path.join(outputDir, 'providers', filename);

    if (!fs.existsSync(inputPath)) {
        console.warn(`⚠️  File not found: ${normalizePosixPath(path.relative(__dirname, inputPath))}`);
        return false;
    }

    const originalContent = fs.readFileSync(inputPath, 'utf-8');

    if (!originalContent.includes('async ') && !originalContent.includes('await ')) {
        console.log(`⏭️  ${filename} - no async/await, skipping`);
        return true;
    }

    try {
        const result = await esbuild.transform(originalContent, {
            loader: 'js',
            target: 'es2016',
            format: 'cjs'
        });

        fs.writeFileSync(inputPath, result.code);

        const stats = fs.statSync(inputPath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`✅ ${filename} transpiled (${sizeKB} KB)`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to transpile ${filename}:`, err.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const outputDir = getOutputDir(args);
    const shouldMinify = args.includes('--minify');

    if (args.includes('--transpile')) {
        const files = args.filter(arg => arg !== '--transpile' && !arg.startsWith('-'));

        fs.mkdirSync(outputDir, { recursive: true });

        fs.mkdirSync(path.join(outputDir, 'providers'), { recursive: true });

        if (files.length === 0) {
            const providerDir = path.join(outputDir, 'providers');
            const allProviderFiles = fs.existsSync(providerDir)
                ? fs.readdirSync(providerDir).filter(f => f.endsWith('.js'))
                : [];

            console.log(`\n🔄 Transpiling ${allProviderFiles.length} file(s) in ${outputDir}/providers/...\n`);

            for (const file of allProviderFiles) {
                await transpileSingleFile(file, outputDir);
            }
        } else {
            console.log(`\n🔄 Transpiling ${files.length} file(s) in ${outputDir}/providers/...\n`);
            for (const file of files) {
                const filename = file.endsWith('.js') ? file : `${file}.js`;
                await transpileSingleFile(filename, outputDir);
            }
        }
        return;
    }

    const providers = getProviderNamesToBuild(args);

    if (providers.length === 0) {
        console.log('No providers found in src/ directory.');
        console.log('Create a provider: mkdir -p src/myprovider && touch src/myprovider/index.js');
        return;
    }

    const minifyLabel = shouldMinify ? ' (minified)' : '';
    console.log(`\n📦 Building ${providers.length} provider(s) into ${outputDir}/${minifyLabel}...\n`);

    fs.mkdirSync(outputDir, { recursive: true });

    const manifestEntries = [];
    let success = 0;
    let failed = 0;

    for (const provider of providers) {
        const manifestEntry = await buildProvider(provider, outputDir, { minify: shouldMinify });
        if (manifestEntry) {
            manifestEntries.push(manifestEntry);
            success++;
        } else {
            failed++;
        }
    }

    writeManifest(manifestEntries, outputDir);
    console.log(`\n✨ Done! ${success} built, ${failed} skipped/failed\n`);
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});

