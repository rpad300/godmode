/**
 * Purpose:
 *   Thin wrapper around the Brave Web Search API for enriching company analysis
 *   with real-time web data (titles, descriptions, URLs).
 *
 * Responsibilities:
 *   - Execute web searches via Brave Search REST API with configurable count, country, and language
 *   - Assemble search result snippets into a plain-text context string for LLM consumption
 *
 * Key dependencies:
 *   - Native fetch (Node 18+): HTTP calls to Brave Search API
 *
 * Side effects:
 *   - Network: outbound HTTPS requests to api.search.brave.com (15s timeout)
 *
 * Notes:
 *   - Result count is clamped to [1, 20] per Brave API limits
 *   - snippetsFromResult concatenates title+description+URL blocks with --- separators
 *     and stops accumulating once maxChars is exceeded to stay within LLM context limits
 *   - API reference: https://api.search.brave.com/app/documentation/web-search/query
 */

const BRAVE_WEB_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Run a web search via Brave Search API
 * @param {string} apiKey - Brave API key (X-Subscription-Token)
 * @param {string} query - Search query
 * @param {object} opts - Optional: count (default 10), country, search_lang
 * @returns {Promise<{ success: boolean, web?: { results?: Array<{ title, url, description }> }, error?: string }>}
 */
async function webSearch(apiKey, query, opts = {}) {
    if (!apiKey || !String(apiKey).trim()) {
        return { success: false, error: 'Brave API key required' };
    }
    const count = Math.min(Math.max(Number(opts.count) || 10, 1), 20);
    const params = new URLSearchParams({ q: query, count: String(count) });
    if (opts.country) params.set('country', opts.country);
    if (opts.search_lang) params.set('search_lang', opts.search_lang);
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${BRAVE_WEB_SEARCH_URL}?${params.toString()}`, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': String(apiKey).trim()
            }
        });
        clearTimeout(t);
        if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `Brave API ${res.status}: ${errText.slice(0, 200)}` };
        }
        const data = await res.json();
        return { success: true, web: data.web || {}, data };
    } catch (e) {
        return { success: false, error: e.message || 'Brave search failed' };
    }
}

/**
 * Build a text context from Brave search results (titles + descriptions + URLs)
 * @param {object} result - Result from webSearch()
 * @param {number} maxChars - Approximate max characters to include
 */
function snippetsFromResult(result, maxChars = 12000) {
    const results = result?.web?.results || [];
    const parts = [];
    let len = 0;
    for (const r of results) {
        const block = [r.title, r.description, r.url].filter(Boolean).join('\n');
        if (!block) continue;
        if (len + block.length > maxChars) break;
        parts.push(block);
        len += block.length;
    }
    return parts.join('\n\n---\n\n');
}

module.exports = { webSearch, snippetsFromResult };
