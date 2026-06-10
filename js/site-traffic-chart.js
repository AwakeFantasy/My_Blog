(function () {
  const chartEl = document.getElementById('site-traffic-chart');
  const statusEl = document.getElementById('site-traffic-status');
  const summaryEl = document.getElementById('site-traffic-summary');
  if (!chartEl || !window.echarts) return;

  const chart = echarts.init(chartEl);

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  function renderSummary(latest) {
    if (!summaryEl || !latest) return;
    summaryEl.innerHTML = [
      `<span>总访问量 <strong>${formatNumber(latest.pv)}</strong> 次</span>`,
      `<span>总访客数 <strong>${formatNumber(latest.uv)}</strong> 人</span>`,
      `<span>最近快照 ${latest.date}</span>`
    ].join('');
  }

  function renderChart(data) {
    const dates = data.map(item => item.date);
    const pv = data.map(item => Number(item.pv || 0));
    const uv = data.map(item => Number(item.uv || 0));

    chart.setOption({
      color: ['#d14b4b', '#2f7ebc'],
      tooltip: {
        trigger: 'axis',
        valueFormatter: value => formatNumber(value)
      },
      legend: {
        data: ['总访问量', '总访客数'],
        top: 0
      },
      grid: {
        left: 48,
        right: 24,
        top: 56,
        bottom: 42
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: value => formatNumber(value)
        }
      },
      series: [
        {
          name: '总访问量',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: pv
        },
        {
          name: '总访客数',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: uv
        }
      ]
    });

    renderSummary(data[data.length - 1]);
    setStatus('');
  }

  fetch('/data/site-traffic.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        setStatus('还没有访问量快照。定时任务成功运行一次后，这里会显示折线图。');
        return;
      }
      renderChart(data);
    })
    .catch(error => {
      console.warn('[site-traffic-chart] failed to load data:', error);
      setStatus('访问量数据暂时加载失败。');
    });

  window.addEventListener('resize', () => chart.resize());
})();
