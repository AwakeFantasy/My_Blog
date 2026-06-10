(function () {
  const waline = window.CONFIG?.waline || {};
  const serverURL = waline.serverURL || 'https://waline.awakefantasy.top';
  if (!serverURL) return;

  const SITE_PV_PATH = '/__waline_site_pv__';
  const SITE_UV_PATH = '/__waline_site_uv__';
  const SITE_UV_KEY = 'waline-site-uv-counted';

  function normalizePath(pathname) {
    const normalized = pathname.replace(/\/*(index.html)?$/, '/');
    try {
      return decodeURI(normalized);
    } catch (e) {
      return normalized;
    }
  }

  function appendPostPageview() {
    if (!document.querySelector('#waline')) return false;

    const metaRow = document.querySelector('#banner .banner-text > .mt-1');
    if (!metaRow || metaRow.querySelector('.waline-pageview-meta')) return false;

    const item = document.createElement('span');
    item.className = 'post-meta mr-2 waline-pageview-meta';
    item.innerHTML = '<i class="iconfont icon-eye" aria-hidden="true"></i> <span class="waline-pageview-count">--</span> \u6b21';
    metaRow.appendChild(item);
    return true;
  }

  function appendSiteStats() {
    const footer = document.querySelector('footer .footer-inner');
    if (!footer || footer.querySelector('.waline-site-statistics')) return false;

    const stats = document.createElement('div');
    stats.className = 'statistics waline-site-statistics';
    stats.innerHTML = [
      '<a href="/traffic/" title="\u67e5\u770b\u8bbf\u95ee\u7edf\u8ba1\u8d8b\u52bf">\u603b\u8bbf\u95ee\u91cf <span class="waline-site-pv">--</span> \u6b21</a>',
      '<span class="waline-site-uv-wrap"> | <a href="/traffic/" title="\u67e5\u770b\u8bbf\u95ee\u7edf\u8ba1\u8d8b\u52bf">\u603b\u8bbf\u5ba2\u6570 <span class="waline-site-uv">--</span> \u4eba</a></span>'
    ].join('');
    footer.appendChild(stats);
    return true;
  }

  const hasPostPageview = appendPostPageview();
  const hasSiteStats = appendSiteStats();
  if (!hasPostPageview && !hasSiteStats) return;

  import('/js/waline-esm.js')
    .then(({ pageviewCount }) => {
      if (typeof pageviewCount !== 'function') return;

      if (hasPostPageview) {
        pageviewCount({
          serverURL,
          path: normalizePath(window.location.pathname),
          selector: '.waline-pageview-count',
          update: true
        });
      }

      if (hasSiteStats) {
        pageviewCount({
          serverURL,
          path: SITE_PV_PATH,
          selector: '.waline-site-pv',
          update: true
        });

        const shouldCountUv = localStorage.getItem(SITE_UV_KEY) !== '1';
        pageviewCount({
          serverURL,
          path: SITE_UV_PATH,
          selector: '.waline-site-uv',
          update: shouldCountUv
        });
        if (shouldCountUv) localStorage.setItem(SITE_UV_KEY, '1');
      }
    })
    .catch(err => console.warn('[waline-metrics] pageview failed:', err));
})();
