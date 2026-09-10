/**
 * HTTP Utilities
 * Use this file for network requests and headers.
 */

/**
 * Fetch text content from a URL
 * @param {string} provider
 * @param {string} url
 * @param {object} headers
 * @param {object} options
 */
export async function fetchText(provider, url, headers, options = {}) {
    console.log(`[${provider}] Fetching: ${url}`);

    const response = await fetch(url, {
        headers: {
          ...headers,
          ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for ${url}`);
    }

    return await response.text();
}

/**
 * Fetch JSON content from a URL
 * @param {string} provider
 * @param {string} url
 * @param {object} headers
 * @param {object} options
 */
export async function fetchJson(provider, url, headers, options = {}) {
    const raw = await fetchText(provider, url, headers, options);
    return JSON.parse(raw);
}
