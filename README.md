# Nuvio Providers

A collection of streaming providers for the Nuvio app. Providers are JavaScript modules that fetch streams from various sources.

📖 **[Read the Comprehensive Developer Guide](DOCUMENTATION.md)**

## Quick Start

### Using in Nuvio App

1. Open **Nuvio** > **Settings** > **Plugins**
2. Add this repository URL:
   ```
   https://raw.githubusercontent.com/autovalue/nuvio-providers/refs/heads/gh-pages/manifest.json
   ```
3. Refresh and enable the providers you want
4. **Developer Mode**: To test local changes, run `npm start` on your computer.
   > ⚠️ **Important:** You must use the **development build** of Nuvio (`npx expo run:android` or `npx expo run:ios`). Some providers may work locally but fail in React Native.
   - Go to **Settings** > **Developer** > **Plugin Tester** in the app.
   - Enter your local server URL (e.g., `http://192.168.1.5:3000/manifest.json`).
   - You can also test individual provider URLs here.

---

## Project Structure

```
nuvio-providers/
├── src/                          # Provider source code
│   ├── provider-one/
│   │   ├── index.js
│   │   ├── extractor.js
│   │   └── ...
│   └── provider-two/
│       └── ...
│
├── manifest.json                 # Source manifest template / default metadata
├── scraper-defaults.json         # Root fallback values for generated scraper entries
├── build.js                      # Build + manifest generation script
├── package.json
├── .github/workflows/
│   └── build-and-publish.yml     # Builds providers and publishes the dist folder to a branch
│
├── dist/                         # Generated publish output
│   ├── manifest.json             # Flat manifest for the published branch
│   └── providers/
│       ├── provider-one.js
│       └── provider-two.js
└── ...
```

The generated `dist/` output is the package intended for GitHub Pages or other static hosting. It contains a top-level `manifest.json` and a `providers/` directory with bundled provider files, rather than the original source tree.

---

## Build System

The build script now generates a publishable output directory and manifest automatically.

### Default behavior

```bash
npm run build
```

This creates a `dist/` folder with:

```text
dist/
├── manifest.json
└── providers/
    ├── provider-one.js
    ├── provider-two.js
    └── ...
```

### Custom output directory

```bash
node build.js --out-dir public
```

This writes to `public/` instead of `dist/`.

### Per-provider metadata

If a source folder contains a `scraper.json`, it will be used as the metadata source for that provider. If it does not exist, the build falls back to:

1. the root `scraper-defaults.json` file
2. the current root `manifest.json` structure as a template default
3. reasonable built-in defaults for fields such as supported types, formats, and enabled state

This lets you add provider-specific metadata without needing to keep a separate repo-wide manifest in sync by hand.

### Build commands

```bash
# Build all providers into dist/
node build.js

# Build only specific providers
node build.js baechusquad
node build.js baechusquad test-external-audio

# Build into a custom directory
node build.js --out-dir build

# Minify output
node build.js --minify

# Transpile async/await in output files
node build.js --transpile
```

---

## GitHub Pages publishing

A workflow is included at [.github/workflows/build-and-publish.yml](.github/workflows/build-and-publish.yml) that:

- installs dependencies
- runs the provider build
- publishes only the generated `dist` content to a target branch
- defaults the target branch to `gh-pages`
- allows overriding the branch with a repository variable named `PUBLISH_BRANCH`

### Branch override

Set a repository Actions variable named `PUBLISH_BRANCH` to change the publish target from the default `gh-pages` branch.

This is intended to keep the main repository branch clean while the publish branch contains only the flat output needed for the plugin manifest and provider files.

---

## Development

There are two ways to create providers:

### Option 1: Single-File Provider

For simple providers, you can create a single JavaScript file directly in the `providers/` directory.

**Important:** The app's JavaScript engine (Hermes) has limitations with `async/await` in dynamic code.
- **Recommended**: Use Promise chains (`.then()`).
- **Alternative**: Use `async/await` and run the transpiler command (see below).

**Example (Promise Chains):**
```javascript
// providers/myprovider.js

function getStreams(tmdbId, mediaType, season, episode) {
  console.log(`[MyProvider] Fetching ${mediaType} ${tmdbId}`);
  
  return fetch(`https://api.example.com/streams/${tmdbId}`)
    .then(response => response.json())
    .then(data => {
      return data.streams.map(s => ({
        name: "MyProvider",
        title: s.title,
        url: s.url,
        quality: s.quality
      }));
    })
    .catch(error => {
      console.error('[MyProvider] Error:', error.message);
      return [];
    });
}

module.exports = { getStreams };
```

To register the provider, add it to `manifest.json`:
```json
{
  "id": "myprovider",
  "name": "My Provider",
  "filename": "providers/myprovider.js",
  "supportedTypes": ["movie", "tv"],
  "enabled": true
}
```

### Option 2: Multi-File Provider (Recommended)

For complex providers, use the `src/` directory. This allows you to split code into multiple files. The build script automatically handles bundling and `async/await` transpilation.

1. **Create source folder:**
   ```bash
   mkdir -p src/myprovider
   ```

2. **Create entry point** (`src/myprovider/index.js`):
   ```javascript
   import { fetchPage } from './http.js';
   import { extractStreams } from './extractor.js';

   // async/await is fully supported here
   async function getStreams(tmdbId, mediaType, season, episode) {
     const page = await fetchPage(tmdbId, mediaType, season, episode);
     return extractStreams(page);
   }

   module.exports = { getStreams };
   ```

3. **Build:**
   ```bash
   node build.js myprovider
   ```

This generates `providers/myprovider.js`.

---

## Building

### Build Source Providers
Bundles files from `src/<provider>/` into `providers/<provider>.js`.

```bash
# Build specific provider
node build.js provider-one

# Build multiple
node build.js provider-one provider-two

# Build all source providers
node build.js
```

### Transpile Single-File Providers
If you wrote a single-file provider using `async/await`, you must transpile it for compatibility.

```bash
# Transpile specific file
node build.js --transpile myprovider.js

# Transpile all applicable files in providers/
node build.js --transpile
```

### Watch Mode
Automatically rebuilds when files change.
```bash
npm run build:watch
```

---

## Testing

Create a test script to identify issues before loading into the app.

```javascript
// test-myprovider.js
const { getStreams } = require('./providers/myprovider.js');

async function test() {
  console.log('Testing...');
  const streams = await getStreams('872585', 'movie'); // Oppenheimer ID
  console.log('Streams found:', streams.length);
}

test();
```

Run with Node.js:
```bash
node test-myprovider.js
```

---

## Stream Object Format

Providers must return an array of stream objects:

```javascript
{
  name: "Provider Name",           // Provider identifier
  title: "1080p Stream",           // Stream description
  url: "https://...",              // Direct stream URL (m3u8, mp4, mkv)
  quality: "1080p",                // Quality label
  size: "2.5 GB",                  // Optional file size
  headers: {                       // Optional headers for playback
    "Referer": "https://source.com",
    "User-Agent": "Mozilla/5.0..."
  }
}
```

---

## Available Modules

Providers have access to these modules via `require()`:

| Module | Usage |
|--------|-------|
| `cheerio-without-node-native` | HTML parsing |
| `crypto-js` | Encryption/decryption |
| `axios` | HTTP requests |

Native `fetch` and `console` are also available globally.

---

## Manifest Options

The `manifest.json` file controls provider settings.

```json
{
  "id": "unique-id",
  "name": "Display Name",
  "description": "Short description",
  "version": "1.0.0",
  "author": "Your Name",
  "supportedTypes": ["movie", "tv"],
  "filename": "providers/file.js",
  "enabled": true,
  "logo": "https://url/to/logo.png",
  "contentLanguage": ["en", "hi"],
  "formats": ["mkv", "mp4"],
  "limited": false,
  "disabledPlatforms": ["ios"],
  "supportsExternalPlayer": true
}
```

---

## License

This project is licensed under the **GNU General Public License v3.0**.

---

## Disclaimer

- **No content is hosted by this repository.**
- Providers fetch publicly available content from third-party websites.
- Users are responsible for compliance with local laws.
- For DMCA concerns, contact the actual content hosts.


--- 

## Acknowledgements

Thanks to the original https://github.com/yoruix/nuvio-providers repo for the inspiration for this.