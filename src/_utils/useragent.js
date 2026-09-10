// source: https://github.com/cinepro-org/core/blob/main/src/utils/ua.ts

function getRandomizer(seed) {
  if (!seed) {
    // If there is no seed, then use the normal randomizer.
    return Math.random;
  }
  // Hash the string seed into a 32-bit integer (cyrb53-lite variant)
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  // Mulberry32 generator
  return function random() {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Generates a random user agent string to use.
 *
 * @param {string} deviceType
 *   The device type, usually one of 'android', 'windows' or 'ubuntu'.
 *   If omitted, a random one will be picked.
 * @param {string} browserType
 *   The browser type, usually one of 'chrome' or 'firefox'.
 *   If omitted, a random one will be picked.
 * @param {string|null} seed
 *   The seed to use for the random selector.
 * @returns {string}
 *   The user agent string to use for the request.
 */
export function generateRandomUserAgent(deviceType, browserType, seed = null) {
  const devices = ['android', 'windows', 'ubuntu'];
  const browsers = ['chrome', 'firefox'];

  let random = getRandomizer(seed);

  function getRandomElement(arr) {
    return arr[Math.floor(random() * arr.length)];
  }

  if (!deviceType) {
    deviceType = getRandomElement(devices);
  }

  if (!browserType) {
    browserType = getRandomElement(browsers);
  }

  let browserVersion;
  if (browserType === 'chrome') {
    const majorVersion = Math.floor(random() * (127 - 110) + 110);
    const minorVersion = Math.floor(random() * 10);
    const buildVersion = Math.floor(random() * (10000 - 1000) + 1000);
    const patchVersion = Math.floor(random() * 100);
    browserVersion = `${majorVersion}.${minorVersion}.${buildVersion}.${patchVersion}`;
  } else {
    const firefoxVersions = Array.from({ length: 10 }, (_, i) => 90 + i);
    browserVersion = getRandomElement(firefoxVersions).toString();
  }

  if (deviceType === 'windows') {
    const windowsVersions = ['10.0', '11.0'];
    const windowsVersion = getRandomElement(windowsVersions);
    if (browserType === 'chrome') {
      return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else {
      return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`;
    }
  } else if (deviceType === 'ubuntu') {
    const ubuntuVersions = ['20.04', '22.04'];
    const ubuntuVersion = getRandomElement(ubuntuVersions);
    if (browserType === 'chrome') {
      return `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:94.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else {
      return `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`;
    }
  }

  return '';
}
