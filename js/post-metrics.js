document.addEventListener('DOMContentLoaded', initPostMetrics);

function initPostMetrics() {
  const cards = Array.from(document.querySelectorAll('.index-card'));
  const lc = window.CONFIG?.web_analytics?.leancloud;
  if (!cards.length || !lc?.app_id || !lc?.app_key || Fluid?.ctx?.dnt) return;

  const apiBase = buildApiBase(lc);
  const headers = buildHeaders(lc);

  const pathMap = new Map();
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
    pathMap.set(path, meta);
    appendMetric(meta, 'views', path, 'iconfont icon-eye');
    appendMetric(meta, 'comments', path, 'iconfont icon-comment');
  });

  const paths = Array.from(pathMap.keys());
  if (!paths.length) return;

  fetchViews(paths, pathMap, apiBase, headers);
  fetchComments(paths, pathMap, apiBase, headers);
}

function appendMetric(container, type, path, iconClass) {
  if (container.querySelector(`.post-metric[data-metric="${type}"][data-path="${path}"]`)) return;
  const span = document.createElement('span');
  span.className = `post-metric post-metric-${type}`;
  span.dataset.metric = type;
  span.dataset.path = path;
  span.innerHTML = `<i class="${iconClass}"></i><span class="count">--</span>`;
  container.appendChild(span);
}

function fetchViews(paths, pathMap, apiBase, headers) {
  const where = encodeURIComponent(JSON.stringify({ target: { '$in': paths } }));
  fetch(`${apiBase}/classes/Counter?where=${where}&limit=1000`, { headers })
    .then(res => res.json())
    .then(data => {
      if (!data?.results) return;
      const map = Object.create(null);
      data.results.forEach(item => {
        if (!item.target) return;
        map[item.target] = item.time || 0;
      });
      updateCounts(pathMap, 'views', map);
    })
    .catch(err => console.warn('[post-metrics] fetch views failed:', err));
}

function fetchComments(paths, pathMap, apiBase, headers) {
  const where = encodeURIComponent(JSON.stringify({ url: { '$in': paths } }));
  fetch(`${apiBase}/classes/Comment?where=${where}&limit=1000`, { headers })
    .then(res => res.json())
    .then(data => {
      if (!data?.results) return;
      const map = Object.create(null);
      data.results.forEach(item => {
        const key = item.url;
        if (!key) return;
        map[key] = (map[key] || 0) + 1;
      });
      updateCounts(pathMap, 'comments', map);
    })
    .catch(err => console.warn('[post-metrics] fetch comments failed:', err));
}

function updateCounts(pathMap, metric, dataMap) {
  pathMap.forEach((meta, path) => {
    const span = meta.querySelector(`.post-metric[data-metric="${metric}"][data-path="${path}"] .count`)
      || meta.querySelector(`.post-metric[data-metric="${metric}"] .count`);
    if (!span) return;
    span.textContent = dataMap[path] ?? 0;
  });
}

function buildApiBase(lc) {
  if (lc.server_url) {
    return lc.server_url.replace(/\/$/, '') + '/1.1';
  }
  const shortId = lc.app_id.slice(0, 8).toLowerCase();
  return `https://${shortId}.api.lncldglobal.com/1.1`;
}

function buildHeaders(lc) {
  return {
    'X-LC-Id'     : lc.app_id,
    'X-LC-Key'    : lc.app_key,
    'Content-Type': 'application/json'
  };
}

function normalizePath(pathname) {
  const normalized = pathname.replace(/\/*(index.html)?$/, '/');
  try {
    return decodeURI(normalized);
  } catch (e) {
    return normalized;
  }
}