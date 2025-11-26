document.addEventListener('DOMContentLoaded', () => {
  const cards = Array.from(document.querySelectorAll('.index-card'));
  if (!cards.length || !window.CONFIG?.web_analytics?.leancloud) return;
  if (!window.AV) return;

  const lc = window.CONFIG.web_analytics.leancloud;
  if (!AV.applicationId) {
    AV.init({ appId: lc.app_id, appKey: lc.app_key, serverURL: lc.server_url || undefined });
  }

  const pathMap = new Map();
  cards.forEach(card => {
    const meta = card.querySelector('.index-post-meta');
    const link = card.querySelector('.index-card-title');
    if (!meta || !link) return;
    const path = new URL(link.getAttribute('href'), window.location.origin).pathname;
    pathMap.set(path, meta);
    appendMetric(meta, 'views', path, 'iconfont icon-eye');
    appendMetric(meta, 'comments', path, 'iconfont icon-comment');
  });

  const paths = Array.from(pathMap.keys());
  if (!paths.length) return;

  fetchViews(paths, pathMap);
  fetchComments(paths, pathMap);
});

function appendMetric(container, type, path, iconClass) {
  if (container.querySelector(`.post-metric[data-metric="${type}"][data-path="${path}"]`)) return;
  const span = document.createElement('span');
  span.className = `post-metric post-metric-${type}`;
  span.dataset.metric = type;
  span.dataset.path = path;
  span.innerHTML = `<i class="${iconClass}"></i><span class="count">--</span>`;
  container.appendChild(span);
}

function fetchViews(paths, pathMap) {
  const Counter = new AV.Query('Counter');
  Counter.containedIn('url', paths);
  Counter.limit(1000);
  Counter.find().then(res => {
    const map = Object.create(null);
    res.forEach(item => { map[item.get('url')] = item.get('time'); });
    updateCounts(pathMap, 'views', map);
  }).catch(console.error);
}

function fetchComments(paths, pathMap) {
  const Comment = new AV.Query('Comment');
  Comment.containedIn('url', paths);
  Comment.limit(1000);
  Comment.find().then(res => {
    const map = Object.create(null);
    res.forEach(item => {
      const url = item.get('url');
      if (!url) return;
      map[url] = (map[url] || 0) + 1;
    });
    updateCounts(pathMap, 'comments', map);
  }).catch(console.error);
}

function updateCounts(pathMap, metric, dataMap) {
  pathMap.forEach(meta => {
    const span = meta.querySelector(`.post-metric[data-metric="${metric}"] .count`);
    const path = meta.querySelector(`.post-metric[data-metric="${metric}"]`)?.dataset.path;
    if (!span || !path) return;
    span.textContent = dataMap[path] ?? 0;
  });
}