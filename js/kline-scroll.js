(function () {
  'use strict';

  if (document.querySelector('.kline-scroll-layer')) return;

  var WINDOW_MS = 1000;
  var LIVE_CANDLE_LIMIT = 10;
  var HISTORICAL_VOLATILITY_SCALE = 0.0125;
  var IDLE_PRICE_STEP = 0.03;
  var IDLE_RANDOM_STEPS = 8;
  var IDLE_RANGE = 0.12;
  var IDLE_WICK_LIMIT = 0.015;
  var PRICE_PER_PIXEL_RATIO = 0.0000004;
  var ENTRY_PRICE = 100;
  var INITIAL_ASSETS = 100000;
  var LEVERAGE = 10;
  var POSITION_UNITS = INITIAL_ASSETS * LEVERAGE / ENTRY_PRICE;
  var INITIAL_PRICE = ENTRY_PRICE;

  function createLayer() {
    var layer = document.createElement('div');
    layer.className = 'kline-scroll-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = [
      '<div class="kline-scroll-layer__frame">',
      '  <div class="kline-scroll-layer__grid"></div>',
      '  <div class="kline-scroll-layer__history"></div>',
      '  <div class="kline-scroll-layer__hud">',
      '    <span class="kline-scroll-layer__hud-position">当前持仓：awakefantasy</span>',
      '    <span class="kline-scroll-layer__hud-row">总资产 <strong class="kline-scroll-layer__assets">¥100,000</strong></span>',
      '    <span class="kline-scroll-layer__hud-row">初始资金 <strong>¥100,000</strong></span>',
      '    <span class="kline-scroll-layer__hud-row">仓位 100% · 杠杆 10x</span>',
      '    <span class="kline-scroll-layer__hud-row">持仓 <strong class="kline-scroll-layer__units">10,000 股</strong></span>',
      '    <span class="kline-scroll-layer__hud-row">持仓市值 <strong class="kline-scroll-layer__market">¥1,000,000</strong></span>',
      '    <span class="kline-scroll-layer__hud-pnl">浮盈 <strong>¥0</strong> <small>(0.00%)</small></span>',
      '  </div>',
      '  <div class="kline-scroll-layer__crosshair"><span class="kline-scroll-layer__time"></span><span class="kline-scroll-layer__price"></span></div>',
      '</div>'
    ].join('');
    document.body.prepend(layer);
    return layer;
  }

  function seedCandles(step, price) {
    var count = Math.ceil(window.innerWidth / step) + 4;
    var now = Date.now() - count * WINDOW_MS;
    var candles = [];
    for (var i = 0; i < count; i += 1) {
      candles.push({ open: price, high: price, low: price, close: price, time: now + i * WINDOW_MS });
    }
    return candles;
  }

  function candleSpacing(frameWidth, candleCount) {
    var baseStep = window.innerWidth < 768 ? 12 : 17;
    var fillStep = (frameWidth - 16) / Math.max(candleCount, 1);
    return Math.max(baseStep, fillStep);
  }

  function init() {
    var layer = createLayer();
    var frame = layer.querySelector('.kline-scroll-layer__frame');
    var history = layer.querySelector('.kline-scroll-layer__history');
    var pnlAmount = layer.querySelector('.kline-scroll-layer__hud-pnl strong');
    var pnlPercent = layer.querySelector('.kline-scroll-layer__hud-pnl small');
    var assets = layer.querySelector('.kline-scroll-layer__assets');
    var units = layer.querySelector('.kline-scroll-layer__units');
    var marketValue = layer.querySelector('.kline-scroll-layer__market');
    var positionStatus = layer.querySelector('.kline-scroll-layer__hud-position');
    var crosshair = layer.querySelector('.kline-scroll-layer__crosshair');
    var timeLabel = layer.querySelector('.kline-scroll-layer__time');
    var priceLabel = layer.querySelector('.kline-scroll-layer__price');
    var toggle = document.createElement('a');
    toggle.href = 'javascript:;';
    toggle.className = 'nav-link kline-scroll-toggle';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', '显示 K 线');
    toggle.title = '显示 K 线';
    toggle.innerHTML = '<i class="iconfont icon-chart-line" aria-hidden="true"></i><span class="kline-scroll-toggle__label">K 线</span>';
    var desktopToggle = document.createElement('li');
    desktopToggle.className = 'nav-item';
    desktopToggle.appendChild(toggle);
    var colorButton = document.getElementById('color-toggle-btn');
    if (colorButton && colorButton.parentNode) colorButton.parentNode.insertBefore(desktopToggle, colorButton.nextSibling);
    else document.querySelector('#navbarSupportedContent .navbar-nav')?.appendChild(desktopToggle);

    var mobileToggle = document.createElement('div');
    mobileToggle.className = 'col-4 mobile-grid-cell';
    mobileToggle.id = 'mobile-kline-toggle';
    mobileToggle.innerHTML = '<a href="javascript:;" role="button" aria-label="显示 K 线"><div class="mobile-grid-item"><i class="iconfont icon-chart-line" aria-hidden="true"></i><span>K 线</span></div></a>';
    var mobileColor = document.getElementById('mobile-color-toggle-btn');
    if (mobileColor && mobileColor.parentNode) mobileColor.parentNode.insertBefore(mobileToggle, mobileColor.nextSibling);
    var mobileLink = mobileToggle.querySelector('a');

    var step = window.innerWidth < 768 ? 12 : 17;
    var candles = seedCandles(step, INITIAL_PRICE);
    var open = INITIAL_PRICE;
    var high = INITIAL_PRICE;
    var low = INITIAL_PRICE;
    var price = INITIAL_PRICE;
    var idleCenter = INITIAL_PRICE;
    var positionOpen = true;
    var realizedPnl = 0;
    var lastScrollY = window.scrollY;
    var baseCandleCount = candles.length;
    var scrolledThisWindow = false;
    var renderPending = false;
    var chartBounds = null;
    var chartMin = INITIAL_PRICE - 1;
    var chartMax = INITIAL_PRICE + 1;

    function setEnabled(enabled) {
      document.body.classList.toggle('kline-mode-on', enabled);
      layer.setAttribute('aria-hidden', enabled ? 'false' : 'true');
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggle.setAttribute('aria-label', enabled ? '隐藏 K 线' : '显示 K 线');
      toggle.title = enabled ? '隐藏 K 线' : '显示 K 线';
      if (mobileLink) mobileLink.setAttribute('aria-label', enabled ? '隐藏 K 线' : '显示 K 线');
    }

    function allCandles() {
      return candles.concat([{ open: open, high: high, low: low, close: price, time: Date.now() }]);
    }

    function positionPnl() {
      return positionOpen ? (price - ENTRY_PRICE) * POSITION_UNITS : realizedPnl;
    }

    function checkLiquidation() {
      if (positionOpen && price <= ENTRY_PRICE * (1 - 1 / LEVERAGE)) {
        positionOpen = false;
        realizedPnl = -INITIAL_ASSETS;
      }
    }

    function mapPrice(value, min, max) {
      return 92 - ((value - min) / Math.max(max - min, 0.001)) * 84;
    }

    function renderCandle(element, candle, min, max, left) {
      var bodyTop = mapPrice(Math.max(candle.open, candle.close), min, max);
      var bodyBottom = mapPrice(Math.min(candle.open, candle.close), min, max);
      var wickTop = mapPrice(candle.high, min, max);
      var wickBottom = mapPrice(candle.low, min, max);
      element.className = 'kline-candle ' + (candle.close >= candle.open ? 'is-up' : 'is-down');
      element.style.left = left + 'px';
      element.style.setProperty('--wick-top', wickTop.toFixed(2) + '%');
      element.style.setProperty('--wick-height', Math.max(0, wickBottom - wickTop).toFixed(2) + '%');
      element.style.setProperty('--body-top', bodyTop.toFixed(2) + '%');
      element.style.setProperty('--body-height', Math.max(0, bodyBottom - bodyTop).toFixed(2) + '%');
    }

    function render() {
      renderPending = false;
      var visibleCandles = allCandles();
      var candleStep = candleSpacing(frame.clientWidth, visibleCandles.length);
      var candleWidth = window.innerWidth < 768 ? 5 : 7;
      var scaleCandles = visibleCandles.slice(-Math.ceil(frame.clientWidth / candleStep));
      var values = [];
      scaleCandles.forEach(function (candle) { values.push(candle.open, candle.high, candle.low, candle.close); });
      var rawMin = Math.min.apply(Math, values);
      var rawMax = Math.max.apply(Math, values);
      var range = Math.max(rawMax - rawMin, 0.12);
      chartMin = rawMin - range * 0.14;
      chartMax = rawMax + range * 0.14;
      var trackWidth = Math.max(frame.clientWidth, visibleCandles.length * candleStep + candleWidth * 2);
      var shift = Math.max(0, trackWidth - frame.clientWidth);
      history.style.width = trackWidth + 'px';
      history.style.transform = 'translate3d(' + (-shift) + 'px, 0, 0)';
      var rightAlignOffset = Math.max(0, trackWidth - visibleCandles.length * candleStep - candleWidth * 2);
      visibleCandles.forEach(function (candle, index) {
        var element = history.children[index];
        if (!element) {
          element = document.createElement('span');
          element.innerHTML = '<span class="kline-candle__wick"></span><span class="kline-candle__body"></span>';
          history.appendChild(element);
        }
        renderCandle(element, candle, chartMin, chartMax, rightAlignOffset + index * candleStep + candleWidth);
      });
      while (history.children.length > visibleCandles.length) history.removeChild(history.lastElementChild);
      var pnlValue = positionPnl();
      var pnlPercentValue = pnlValue / INITIAL_ASSETS * 100;
      var currentAssets = Math.max(0, INITIAL_ASSETS + pnlValue);
      assets.textContent = '¥' + Math.round(currentAssets).toLocaleString('en-US');
      units.textContent = (positionOpen ? POSITION_UNITS : 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' 股';
      marketValue.textContent = '¥' + Math.round(positionOpen ? price * POSITION_UNITS : 0).toLocaleString('en-US');
      positionStatus.textContent = positionOpen ? '当前持仓：awakefantasy' : '持仓已强平：awakefantasy';
      pnlAmount.textContent = (pnlValue >= 0 ? '+' : '−') + '¥' + Math.round(Math.abs(pnlValue)).toLocaleString('en-US');
      pnlPercent.textContent = '(' + (pnlPercentValue >= 0 ? '+' : '') + pnlPercentValue.toFixed(2) + '%)';
      pnlAmount.parentElement.classList.toggle('is-profit', pnlValue >= 0);
      pnlAmount.parentElement.classList.toggle('is-loss', pnlValue < 0);
      chartBounds = frame.getBoundingClientRect();
      if (crosshair.classList.contains('is-active')) updateCrosshair(lastPointerX, lastPointerY);
    }

    function scheduleRender() {
      if (renderPending) return;
      renderPending = true;
      window.requestAnimationFrame(render);
    }

    function applyPriceDelta(deltaPixels) {
      if (!deltaPixels) return;
      price = Math.max(0, price - deltaPixels * ENTRY_PRICE * PRICE_PER_PIXEL_RATIO);
      idleCenter = price;
      high = Math.max(high, price);
      low = Math.min(low, price);
      checkLiquidation();
      scheduleRender();
    }

    function closeWindow() {
      var generatedIdleCandle = !scrolledThisWindow;
      if (generatedIdleCandle) {
        for (var i = 0; i < IDLE_RANDOM_STEPS; i += 1) {
          var meanReversion = (idleCenter - price) * 0.35;
          var randomMove = (Math.random() - 0.5) * IDLE_PRICE_STEP;
          price = Math.max(idleCenter - IDLE_RANGE / 2, Math.min(idleCenter + IDLE_RANGE / 2, price + meanReversion + randomMove));
          high = Math.max(high, price);
          low = Math.min(low, price);
          checkLiquidation();
        }
      }
      if (generatedIdleCandle) {
        high = Math.min(high, Math.max(open, price) + IDLE_WICK_LIMIT);
        low = Math.max(low, Math.min(open, price) - IDLE_WICK_LIMIT);
      }
      candles.push({ open: open, high: high, low: low, close: price, time: Date.now() });
      while (candles.length > baseCandleCount + LIVE_CANDLE_LIMIT - 1) {
        candles.splice(0, 1);
      }
      open = price;
      high = price;
      low = price;
      scrolledThisWindow = false;
      scheduleRender();
    }

    function getMaxScroll() { return Math.max(document.documentElement.scrollHeight - window.innerHeight, 0); }
    function atPageEdge(delta) {
      var y = window.scrollY;
      return delta < 0 ? y <= 0 : y >= getMaxScroll() - 1;
    }
    function normalizeWheel(event) {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    }
    function onScroll() {
      scrolledThisWindow = true;
      var currentScrollY = window.scrollY;
      var delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      applyPriceDelta(delta);
    }
    function onWheel(event) {
      scrolledThisWindow = true;
      var delta = normalizeWheel(event);
      if (delta && atPageEdge(delta)) applyPriceDelta(delta);
    }

    var activeTouchY = null;
    function onTouchStart(event) {
      if (event.touches.length === 1) activeTouchY = event.touches[0].clientY;
    }
    function onTouchMove(event) {
      if (activeTouchY === null || event.touches.length !== 1) return;
      var nextY = event.touches[0].clientY;
      var scrollDelta = activeTouchY - nextY;
      activeTouchY = nextY;
      if (!scrollDelta) return;
      scrolledThisWindow = true;
      if (!atPageEdge(scrollDelta)) return;
      var scrollAtGesture = window.scrollY;
      window.setTimeout(function () {
        if (window.scrollY === scrollAtGesture && atPageEdge(scrollDelta)) applyPriceDelta(scrollDelta);
      }, 32);
    }
    function onTouchEnd() { activeTouchY = null; }

    var lastPointerX = 0;
    var lastPointerY = 0;
    function updateCrosshair(x, y) {
      if (!chartBounds || !document.body.classList.contains('kline-mode-on')) return;
      var within = x >= chartBounds.left && x <= chartBounds.right && y >= chartBounds.top && y <= chartBounds.bottom;
      crosshair.classList.toggle('is-active', within);
      if (!within) return;
      var fractionX = Math.max(0, Math.min(1, (x - chartBounds.left) / chartBounds.width));
      var fractionY = Math.max(0, Math.min(1, (y - chartBounds.top) / chartBounds.height));
      var candleStep = candleSpacing(chartBounds.width, allCandles().length);
      var candlesNow = allCandles().slice(-Math.ceil(chartBounds.width / candleStep));
      var idx = Math.max(0, Math.min(candlesNow.length - 1, Math.floor(fractionX * candlesNow.length)));
      var value = chartMax - (fractionY - 0.08) / 0.84 * (chartMax - chartMin);
      var candleTime = candlesNow[idx].time;
      var timeDate = new Date(candleTime);
      timeLabel.textContent = Date.now() - candleTime > 86400000
        ? timeDate.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })
        : timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      priceLabel.textContent = value.toFixed(2);
      crosshair.style.setProperty('--pointer-x', Math.min(chartBounds.width - 70, Math.max(0, x - chartBounds.left)) + 'px');
      crosshair.style.setProperty('--pointer-y', Math.min(chartBounds.height - 25, Math.max(0, y - chartBounds.top)) + 'px');
    }
    document.addEventListener('pointermove', function (event) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      updateCrosshair(lastPointerX, lastPointerY);
    }, { passive: true });
    function toggleMode(event) {
      event.preventDefault();
      var enabled = !document.body.classList.contains('kline-mode-on');
      setEnabled(enabled);
      scheduleRender();
    }
    toggle.addEventListener('click', toggleMode);
    if (mobileLink) mobileLink.addEventListener('click', toggleMode);

    setEnabled(false);
    render();
    window.setInterval(closeWindow, WINDOW_MS);
    fetch('/data/kline/changfei-601869.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Historical K-line data is unavailable.');
        return response.json();
      })
      .then(function (rows) {
        var historyRows = rows.filter(function (row) {
          return row.trade_date && Number.isFinite(Number(row.open)) && Number.isFinite(Number(row.high)) && Number.isFinite(Number(row.low)) && Number.isFinite(Number(row.close));
        });
        if (!historyRows.length) return;
        candles = historyRows.map(function (row) {
          return {
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            time: new Date(row.trade_date + 'T15:00:00+08:00').getTime()
          };
        });
        baseCandleCount = candles.length;
        var latestClose = candles[candles.length - 1].close;
        var priceScale = INITIAL_PRICE / latestClose;
        candles = candles.map(function (candle) {
          return {
            open: INITIAL_PRICE + (candle.open * priceScale - INITIAL_PRICE) * HISTORICAL_VOLATILITY_SCALE,
            high: INITIAL_PRICE + (candle.high * priceScale - INITIAL_PRICE) * HISTORICAL_VOLATILITY_SCALE,
            low: INITIAL_PRICE + (candle.low * priceScale - INITIAL_PRICE) * HISTORICAL_VOLATILITY_SCALE,
            close: INITIAL_PRICE + (candle.close * priceScale - INITIAL_PRICE) * HISTORICAL_VOLATILITY_SCALE,
            time: candle.time
          };
        });
        ENTRY_PRICE = INITIAL_PRICE;
        POSITION_UNITS = INITIAL_ASSETS * LEVERAGE / ENTRY_PRICE;
        open = INITIAL_PRICE;
        high = INITIAL_PRICE;
        low = INITIAL_PRICE;
        price = INITIAL_PRICE;
        idleCenter = INITIAL_PRICE;
        scheduleRender();
      })
      .catch(function () { /* Keep the flat offline chart if local history cannot be loaded. */ });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('resize', scheduleRender, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
