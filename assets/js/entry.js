/**
 * Entry page: back-to-map link (preserve filters from referrer) + related places from index.json
 */
(function () {
  const config = window.FOLKLORE_ENTRY;
  if (!config) return;

  const backLink = document.getElementById('back-to-map');
  const relatedEl = document.getElementById('related-places');

  // Back to map: if we came from /map/ with query, preserve it
  if (backLink) {
    const ref = document.referrer;
    const base = (config.base || '/').replace(/\/$/, '');
    try {
      const u = new URL(ref);
      const pathNorm = u.pathname.replace(/\/$/, '') || '/';
      const isMapPage = pathNorm === '/map' || pathNorm.endsWith('/map');
      if (isMapPage && u.search) backLink.href = base + '/map' + u.search;
    } catch (_) {}
  }

  // Related places: fetch index, filter by shared tags, sort by count then title, show top 6
  const indexUrl = config.indexUrl || (config.base || '') + 'map/index.json';
  fetch(indexUrl, { cache: 'default' })
    .then(function (r) { return r.json(); })
    .then(function (entries) {
      const myTags = new Set((config.tags || []).map(function (t) { return String(t).toLowerCase(); }));
      const currentSlug = config.slug;

      const withScores = entries
        .filter(function (e) {
          const slug = (e.url || '').split('/').filter(Boolean).pop() || '';
          return slug !== currentSlug;
        })
        .map(function (e) {
          const entryTags = (e.tags || []).map(function (t) { return String(t).toLowerCase(); });
          let shared = 0;
          entryTags.forEach(function (t) {
            if (myTags.has(t)) shared++;
          });
          return { entry: e, shared: shared };
        })
        .filter(function (x) { return x.shared > 0; })
        .sort(function (a, b) {
          if (b.shared !== a.shared) return b.shared - a.shared;
          return (a.entry.title || '').localeCompare(b.entry.title || '');
        })
        .slice(0, 6)
        .map(function (x) { return x.entry; });

      if (withScores.length === 0) {
        relatedEl.innerHTML = '<p class="related-none">No related places with shared tags.</p>';
        return;
      }

      relatedEl.innerHTML = '<ul class="related-list" role="list">' +
        withScores.map(function (e) {
          const tagsHtml = (e.tags || []).slice(0, 3).map(function (t) {
            return '<span class="tag-chip tag-chip-small">' + escapeHtml(t) + '</span>';
          }).join('');
          return '<li><a href="' + escapeAttr(e.url) + '">' + escapeHtml(e.title) + '</a>' +
            (e.county ? ' <span class="related-county">' + escapeHtml(e.county) + '</span>' : '') +
            (tagsHtml ? ' <div class="related-tags">' + tagsHtml + '</div>' : '') + '</li>';
        }).join('') +
        '</ul>';
    })
    .catch(function () {
      relatedEl.innerHTML = '<p class="related-none">Unable to load related places.</p>';
    });

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
