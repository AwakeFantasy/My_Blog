(function () {
  document.addEventListener('DOMContentLoaded', initPostMetrics);

  function initPostMetrics() {
    const waline = window.CONFIG?.waline || {};
    const serverURL = waline.serverURL || 'https://waline.awakefantasy.top';
    const cards = Array.from(document.querySelectorAll('.index-card'));
    if (!serverURL || !cards.length || window.Fluid?.ctx?.dnt) return;

    const metrics = [];
    cards.forEach(card => {
      const meta = card.querySelector('.index-post-meta')
        || card.querySelector('.index-btm.post-metas')
        || card.querySelector('.index-btm');
      const link = card.querySelector('.index-card-title')
        || card.querySelector('.index-header a')
        || card.querySelector('a[href]');
      if (!meta || !link) return;

      const url = new URL(link.getAttribute('href'), window.location.origin);
      const path = normalizePath(url.pathname);
      const metric = appendMetric(meta, path);
      if (metric) metrics.push(metric);
    });

    if (!metrics.length) return;

    import('/js/waline-esm.js')
      .then(({ pageviewCount }) => {
        if (typeof pageviewCount !== 'function') return;
        metrics.forEach(metric => {
          pageviewCount({
            serverURL,
            path: metric.dataset.path,
            selector: `[data-waline-pageview="${escapeAttrSelector(metric.dataset.path)}"] .count`,
            update: false
          });
        });
      })
      .catch(err => console.warn('[post-metrics] fetch Waline views failed:', err));
  }

  function appendMetric(container, path) {
    const attrValue = escapeAttrSelector(path);
    if (container.querySelector(`[data-waline-pageview="${attrValue}"]`)) return null;

    const span = document.createElement('span');
    span.className = 'post-metric post-metric-views';
    span.dataset.walinePageview = path;
    span.dataset.path = path;
    span.title = '阅读量';
    span.innerHTML = '<i class="iconfont icon-eye" aria-hidden="true"></i><span class="count">--</span>';
    container.appendChild(span);
    return span;
  }

  function normalizePath(pathname) {
    const normalized = pathname.replace(/\/*(index.html)?$/, '/');
    try {
      return decodeURI(normalized);
    } catch (e) {
      return normalized;
    }
  }

  function escapeAttrSelector(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }
})();
