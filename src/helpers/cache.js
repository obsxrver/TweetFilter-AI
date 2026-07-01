/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');
    const cachedCount = tweetCache.size;
    const keepCount = blacklistedHandles.length;

    if (cachedCountEl) cachedCountEl.textContent = cachedCount;
    if (whitelistedCountEl) whitelistedCountEl.textContent = keepCount;

    const statsBadge = document.getElementById("tweet-filter-stats-badge");
    if (statsBadge) statsBadge.innerHTML = `
            <span data-cached-count>${cachedCount} rated</span>
            <span data-pending-count> | ${pendingRequests} pending</span>
            ${keepCount > 0 ? `<span style="margin-left: 5px;"> | ${keepCount} kept</span>` : ''}
        `;
}

