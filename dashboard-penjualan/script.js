/**
 * script.js — Dashboard Penjualan 2024
 * ============================================================
 * Arsitektur:
 *  1. CONFIG          — Konstanta warna, label, path CSV
 *  2. STATE           — Data global dan nilai filter aktif
 *  3. CSV LOADER      — Muat dan parse data dari CSV via PapaParse
 *  4. FILTER          — Populate dropdown & apply filter
 *  5. KPI             — Hitung dan render KPI cards
 *  6. CHARTS          — Inisialisasi dan update semua chart
 *  7. UTILS           — Helper format angka, warna, dll
 *  8. INIT            — Entry point
 * ============================================================
 */

/* ============================================================
   1. CONFIG — Konstanta global
   ============================================================ */
const CONFIG = {
  // Path file CSV (relatif terhadap index.html)
  CSV_PATH: 'sales_data.csv',

  // Palet warna utama — konsisten di seluruh dashboard
  COLORS: {
    blue:    '#3b82f6',
    emerald: '#10b981',
    violet:  '#8b5cf6',
    amber:   '#f59e0b',
    rose:    '#f43f5e',
    cyan:    '#06b6d4',
    indigo:  '#6366f1',
    teal:    '#14b8a6',
    orange:  '#f97316',
    pink:    '#ec4899',
  },

  // Warna dengan transparansi untuk latar area/bar
  alpha(hex, a = 0.15) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },

  // Urutan bulan dalam Bahasa Indonesia
  MONTHS: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
};

// Array warna untuk chart multi-seri
const PALETTE = Object.values(CONFIG.COLORS);

/* ============================================================
   2. STATE — Data global dan state filter
   ============================================================ */
const STATE = {
  rawData: [],        // Data asli dari CSV (tidak berubah)
  filtered: [],       // Data setelah filter diterapkan
  charts: {},         // Referensi instance Chart.js
  filters: {          // Nilai filter aktif
    region:   'all',
    category: 'all',
    customer: 'all',
    channel:  'all',
  },
};

/* ============================================================
   3. CSV LOADER — Muat data dengan PapaParse
   ============================================================ */

/**
 * Memuat file CSV dan mengisi STATE.rawData.
 * Setelah data siap, memanggil inisialisasi dashboard.
 */
function loadCSV() {
  Papa.parse(CONFIG.CSV_PATH, {
    download: true,
    header: true,         // Baris pertama sebagai key objek
    skipEmptyLines: true,
    dynamicTyping: true,  // Auto konversi angka dan boolean

    complete(results) {
      if (!results.data || results.data.length === 0) {
        showError('CSV kosong atau gagal dibaca.');
        return;
      }

      // Simpan data mentah
      STATE.rawData = results.data;
      STATE.filtered = [...STATE.rawData];

      // Inisialisasi dashboard
      populateFilters();
      initAllCharts();
      updateDashboard();
      setDataStatus('loaded', `${STATE.rawData.length} baris data dimuat`);
    },

    error(err) {
      showError(`Gagal memuat CSV: ${err.message}`);
    },
  });
}

/* ============================================================
   4. FILTER — Populate dropdown & terapkan filter
   ============================================================ */

/**
 * Mengisi semua dropdown filter dengan nilai unik dari data.
 */
function populateFilters() {
  const getUnique = (key) =>
    [...new Set(STATE.rawData.map(r => r[key]).filter(Boolean))].sort();

  fillSelect('filter-region',   getUnique('region'));
  fillSelect('filter-category', getUnique('product_category'));
  fillSelect('filter-customer', getUnique('customer_type'));
  fillSelect('filter-channel',  getUnique('sales_channel'));
}

/**
 * Mengisi elemen <select> dengan array pilihan.
 * @param {string} id  - ID elemen select
 * @param {string[]} options - Array nilai pilihan
 */
function fillSelect(id, options) {
  const el = document.getElementById(id);
  if (!el) return;
  // Pertahankan opsi pertama (default "Semua ..."), hapus sisanya
  while (el.options.length > 1) el.remove(1);
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    el.appendChild(o);
  });
}

/**
 * Terapkan semua filter aktif ke STATE.filtered.
 * Dipanggil setiap kali salah satu filter berubah.
 */
function applyFilters() {
  const { region, category, customer, channel } = STATE.filters;

  STATE.filtered = STATE.rawData.filter(row => {
    if (region   !== 'all' && row.region           !== region)   return false;
    if (category !== 'all' && row.product_category !== category) return false;
    if (customer !== 'all' && row.customer_type    !== customer) return false;
    if (channel  !== 'all' && row.sales_channel    !== channel)  return false;
    return true;
  });

  updateDashboard();
  updateFilterSummary();
}

/**
 * Tampilkan ringkasan filter aktif di bawah dropdown.
 */
function updateFilterSummary() {
  const summary = document.getElementById('filter-summary');
  const text    = document.getElementById('filter-summary-text');
  const { region, category, customer, channel } = STATE.filters;

  const active = [
    region   !== 'all' ? `Region: ${region}`     : null,
    category !== 'all' ? `Kategori: ${category}` : null,
    customer !== 'all' ? `Tipe: ${customer}`      : null,
    channel  !== 'all' ? `Channel: ${channel}`    : null,
  ].filter(Boolean);

  if (active.length > 0) {
    text.textContent = active.join(' · ') + ` — ${STATE.filtered.length} transaksi`;
    summary.classList.remove('hidden');
  } else {
    summary.classList.add('hidden');
  }
}

/**
 * Reset semua filter ke default.
 */
function resetFilters() {
  STATE.filters = { region: 'all', category: 'all', customer: 'all', channel: 'all' };
  ['filter-region','filter-category','filter-customer','filter-channel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 'all';
  });
  applyFilters();
}

/* ============================================================
   5. KPI — Hitung dan render KPI cards
   ============================================================ */

/**
 * Hitung semua KPI dari STATE.filtered dan tampilkan.
 */
function updateKPIs() {
  const data = STATE.filtered;

  // Total Revenue
  const totalRevenue = data.reduce((sum, r) => sum + (r.total_sales || 0), 0);

  // Total Transaksi
  const totalTransactions = data.length;

  // Total Qty Terjual
  const totalQty = data.reduce((sum, r) => sum + (r.quantity || 0), 0);

  // Rata-rata Diskon
  const avgDiscount = data.length > 0
    ? data.reduce((sum, r) => sum + (r.discount || 0), 0) / data.length
    : 0;

  // Render ke DOM
  animateKPI('kpi-revenue',      formatCurrency(totalRevenue));
  animateKPI('kpi-transactions', totalTransactions.toLocaleString('id-ID'));
  animateKPI('kpi-quantity',     totalQty.toLocaleString('id-ID'));
  animateKPI('kpi-discount',     `${(avgDiscount * 100).toFixed(1)}%`);
}

/**
 * Animasikan perubahan nilai KPI dengan fade.
 * @param {string} id    - ID elemen
 * @param {string} value - Nilai baru
 */
function animateKPI(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(4px)';
  setTimeout(() => {
    el.textContent = value;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }, 80);
}

/* ============================================================
   6. CHARTS — Inisialisasi dan update semua chart
   ============================================================ */

/**
 * Default options Chart.js yang dipakai bersama.
 * Mengurangi repetisi konfigurasi.
 */
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { font: { family: 'Inter', size: 11 }, color: '#64748b', boxWidth: 10, padding: 12 },
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.88)',
      titleFont: { family: 'Inter', size: 12 },
      bodyFont:  { family: 'Inter', size: 11 },
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
    },
  },
};

/**
 * Inisialisasi semua instance Chart.js sekali saat halaman load.
 * Data diisi kosong; updateCharts() yang akan mengisi data nyata.
 */
function initAllCharts() {
  // 1. Sales Trend — Line chart
  STATE.charts.salesTrend = new Chart(
    document.getElementById('chart-sales-trend').getContext('2d'),
    {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8' } },
          y: {
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: {
              font: { family: 'Inter', size: 11 }, color: '#94a3b8',
              callback: v => formatCurrencyShort(v),
            },
          },
        },
        elements: { point: { radius: 4, hoverRadius: 6 }, line: { tension: 0.4 } },
        plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      },
    }
  );

  // 2. Revenue per Region — Polar Area chart
  STATE.charts.region = new Chart(
    document.getElementById('chart-region').getContext('2d'),
    {
      type: 'polarArea',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          r: {
            // Sembunyikan grid label angka agar tidak berebut ruang dengan legend
            ticks: {
              display: false,
              backdropColor: 'transparent',
            },
            grid: { color: '#e2e8f0' },
            angleLines: { color: '#e2e8f0' },
          },
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { position: 'bottom', labels: { ...CHART_DEFAULTS.plugins.legend.labels } },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${formatCurrencyShort(ctx.parsed.r)}`,
            },
          },
        },
      },
    }
  );

  // 3. Revenue per Category — Horizontal Bar chart
  STATE.charts.category = new Chart(
    document.getElementById('chart-category').getContext('2d'),
    {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', callback: v => formatCurrencyShort(v) },
          },
          y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' } },
        },
        plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      },
    }
  );

  // 4. Sales per Sales Rep — Bar chart vertikal
  STATE.charts.salesRep = new Chart(
    document.getElementById('chart-salesrep').getContext('2d'),
    {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' } },
          y: {
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', callback: v => formatCurrencyShort(v) },
          },
        },
        plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      },
    }
  );

  // 5. Customer Type — Pie chart
  STATE.charts.customerType = new Chart(
    document.getElementById('chart-customer-type').getContext('2d'),
    {
      type: 'pie',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { position: 'bottom', labels: { ...CHART_DEFAULTS.plugins.legend.labels } },
        },
      },
    }
  );

  // 6. Payment Method — Doughnut chart
  STATE.charts.payment = new Chart(
    document.getElementById('chart-payment').getContext('2d'),
    {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        cutout: '55%',
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { position: 'bottom', labels: { ...CHART_DEFAULTS.plugins.legend.labels } },
        },
      },
    }
  );

  // 7. Sales Channel — Pie chart
  STATE.charts.channel = new Chart(
    document.getElementById('chart-channel').getContext('2d'),
    {
      type: 'pie',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { position: 'bottom', labels: { ...CHART_DEFAULTS.plugins.legend.labels } },
        },
      },
    }
  );

  // 8. Discount vs Sales — Scatter chart
  STATE.charts.scatter = new Chart(
    document.getElementById('chart-scatter').getContext('2d'),
    {
      type: 'scatter',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: {
            title: { display: true, text: 'Diskon (%)', font: { family: 'Inter', size: 11 }, color: '#94a3b8' },
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 10 }, color: '#94a3b8', callback: v => `${(v*100).toFixed(0)}%` },
          },
          y: {
            title: { display: true, text: 'Total Sales (Rp)', font: { family: 'Inter', size: 11 }, color: '#94a3b8' },
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 10 }, color: '#94a3b8', callback: v => formatCurrencyShort(v) },
          },
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: ctx => `Diskon: ${(ctx.parsed.x*100).toFixed(0)}% | Sales: ${formatCurrencyShort(ctx.parsed.y)}`,
            },
          },
        },
        elements: { point: { radius: 5, hoverRadius: 7 } },
      },
    }
  );

  // 9. Top 10 Highest Sales — Horizontal Bar chart
  STATE.charts.top10 = new Chart(
    document.getElementById('chart-top10').getContext('2d'),
    {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 10 }, color: '#94a3b8', callback: v => formatCurrencyShort(v) },
          },
          y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, color: '#64748b' } },
        },
        plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      },
    }
  );

  // 10. Quantity per Category — Bar chart
  STATE.charts.qtyCategory = new Chart(
    document.getElementById('chart-qty-category').getContext('2d'),
    {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' } },
          y: {
            grid: { color: '#f1f5f9', borderDash: [4,4] },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8' },
          },
        },
        plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      },
    }
  );
}

/**
 * Update data semua chart berdasarkan STATE.filtered.
 */
function updateCharts() {
  updateSalesTrendChart();
  updateRegionChart();
  updateCategoryChart();
  updateSalesRepChart();
  updateCustomerTypeChart();
  updatePaymentChart();
  updateChannelChart();
  updateScatterChart();
  updateTop10Chart();
  updateQtyCategoryChart();
}

/* ---- Chart update helpers ---- */

/** 1. Sales Trend — Revenue per bulan */
function updateSalesTrendChart() {
  // Akumulasi revenue per bulan (index 0–11)
  const monthly = Array(12).fill(0);
  STATE.filtered.forEach(row => {
    const d = new Date(row.date);
    if (!isNaN(d)) monthly[d.getMonth()] += (row.total_sales || 0);
  });

  setChartData(STATE.charts.salesTrend, {
    labels: CONFIG.MONTHS,
    datasets: [{
      label: 'Revenue',
      data: monthly,
      borderColor: CONFIG.COLORS.blue,
      backgroundColor: CONFIG.alpha(CONFIG.COLORS.blue, 0.1),
      borderWidth: 2.5,
      fill: true,
    }],
  });
}

/** 2. Revenue per Region — Polar Area */
function updateRegionChart() {
  const agg = aggregateBy('region', 'total_sales');
  const labels = Object.keys(agg);
  const values = Object.values(agg);

  // Gunakan warna dari PALETTE dengan alpha 0.75 agar segmen terlihat
  // transparan dan tumpang tindih polar area tetap terbaca
  const bgColors     = PALETTE.slice(0, labels.length).map(c => CONFIG.alpha(c, 0.75));
  const borderColors = PALETTE.slice(0, labels.length);

  setChartData(STATE.charts.region, {
    labels,
    datasets: [{
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      hoverBackgroundColor: PALETTE.slice(0, labels.length).map(c => CONFIG.alpha(c, 0.92)),
    }],
  });
}

/** 3. Revenue per Kategori Produk */
function updateCategoryChart() {
  const agg = aggregateBy('product_category', 'total_sales');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  setChartData(STATE.charts.category, {
    labels,
    datasets: [{
      label: 'Revenue',
      data: values,
      backgroundColor: PALETTE.slice(0, labels.length).map(c => CONFIG.alpha(c, 0.85)),
      borderRadius: 6,
      borderSkipped: false,
    }],
  });
}

/** 4. Sales per Sales Rep */
function updateSalesRepChart() {
  const agg = aggregateBy('sales_rep', 'total_sales');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);
  const colors = [CONFIG.COLORS.blue, CONFIG.COLORS.emerald, CONFIG.COLORS.violet,
                  CONFIG.COLORS.amber, CONFIG.COLORS.rose];

  setChartData(STATE.charts.salesRep, {
    labels,
    datasets: [{
      label: 'Revenue',
      data: values,
      backgroundColor: labels.map((_, i) => CONFIG.alpha(colors[i % colors.length], 0.85)),
      borderColor:     labels.map((_, i) => colors[i % colors.length]),
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }],
  });
}

/** 5. Customer Type Distribution */
function updateCustomerTypeChart() {
  const agg = aggregateBy('customer_type', 'total_sales');
  const labels = Object.keys(agg);
  const values = Object.values(agg);

  setChartData(STATE.charts.customerType, {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [CONFIG.COLORS.blue, CONFIG.COLORS.emerald],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  });
}

/** 6. Payment Method Usage */
function updatePaymentChart() {
  const agg = aggregateBy('payment_method', 'total_sales');
  const labels = Object.keys(agg);
  const values = Object.values(agg);

  setChartData(STATE.charts.payment, {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [CONFIG.COLORS.violet, CONFIG.COLORS.amber, CONFIG.COLORS.cyan],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  });
}

/** 7. Sales Channel Distribution */
function updateChannelChart() {
  const agg = aggregateBy('sales_channel', 'total_sales');
  const labels = Object.keys(agg);
  const values = Object.values(agg);

  setChartData(STATE.charts.channel, {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [CONFIG.COLORS.indigo, CONFIG.COLORS.teal],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  });
}

/** 8. Discount vs Sales — Scatter */
function updateScatterChart() {
  const points = STATE.filtered.map(row => ({
    x: row.discount || 0,
    y: row.total_sales || 0,
  }));

  setChartData(STATE.charts.scatter, {
    datasets: [{
      label: 'Transaksi',
      data: points,
      backgroundColor: CONFIG.alpha(CONFIG.COLORS.rose, 0.55),
      borderColor: CONFIG.COLORS.rose,
      borderWidth: 1,
    }],
  });
}

/** 9. Top 10 Highest Sales */
function updateTop10Chart() {
  const sorted = [...STATE.filtered]
    .sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0))
    .slice(0, 10);

  // Label singkat: ID order + nama produk
  const labels = sorted.map(r => `${r.order_id}`);
  const values = sorted.map(r => r.total_sales || 0);
  const tooltipLabels = sorted.map(r => `${r.order_id}: ${r.product_name}`);

  setChartData(STATE.charts.top10, {
    labels,
    datasets: [{
      label: 'Total Sales',
      data: values,
      backgroundColor: values.map((_, i) =>
        i === 0 ? CONFIG.alpha(CONFIG.COLORS.amber, 0.9) : CONFIG.alpha(CONFIG.COLORS.blue, 0.75)
      ),
      borderRadius: 5,
      borderSkipped: false,
    }],
  });

  // Simpan tooltip label tambahan ke opsi chart
  STATE.charts.top10.options.plugins.tooltip.callbacks = {
    title: ctx => tooltipLabels[ctx[0].dataIndex],
    label: ctx => ` ${formatCurrencyShort(ctx.parsed.x)}`,
  };
}

/** 10. Quantity per Category */
function updateQtyCategoryChart() {
  const agg = aggregateBy('product_category', 'quantity');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  setChartData(STATE.charts.qtyCategory, {
    labels,
    datasets: [{
      label: 'Qty Terjual',
      data: values,
      backgroundColor: PALETTE.slice(0, labels.length).map(c => CONFIG.alpha(c, 0.8)),
      borderColor:     PALETTE.slice(0, labels.length),
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }],
  });
}

/* ============================================================
   7. UTILS — Helper functions
   ============================================================ */

/**
 * Agregasi data: jumlahkan kolom numerik berdasarkan key kategori.
 * @param {string} groupKey    - Nama kolom untuk digroup
 * @param {string} sumKey      - Nama kolom numerik yang dijumlah
 * @returns {Object}           - { label: total, ... }
 */
function aggregateBy(groupKey, sumKey) {
  return STATE.filtered.reduce((acc, row) => {
    const key = row[groupKey] || 'N/A';
    acc[key] = (acc[key] || 0) + (row[sumKey] || 0);
    return acc;
  }, {});
}

/**
 * Update data chart dan panggil .update() untuk animasi re-render.
 * @param {Chart} chart  - Instance Chart.js
 * @param {Object} data  - Objek { labels, datasets }
 */
function setChartData(chart, data) {
  if (!chart) return;
  chart.data = data;
  chart.update('active'); // 'active' menggunakan animasi default Chart.js
}

/**
 * Format angka ke format Rupiah lengkap.
 * Contoh: 23750000 → "Rp 23.750.000"
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format angka ke format singkat untuk axis chart.
 * Contoh: 23750000 → "23,8 Jt"
 */
function formatCurrencyShort(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(1)} Jt`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(0)} Rb`;
  return value.toFixed(0);
}

/**
 * Tampilkan status data di header badge.
 * @param {'loaded'|'error'|'loading'} status
 * @param {string} message
 */
function setDataStatus(status, message) {
  const el = document.getElementById('data-status');
  if (!el) return;

  const dotColor = status === 'loaded' ? 'bg-emerald-400'
                 : status === 'error'  ? 'bg-red-400'
                 : 'bg-yellow-400 animate-pulse';

  el.innerHTML = `
    <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
    ${message}
  `;
}

/**
 * Tampilkan pesan error di halaman.
 */
function showError(msg) {
  setDataStatus('error', 'Gagal memuat data');
  console.error('[Dashboard]', msg);
}

/* ============================================================
   8. UPDATE DASHBOARD — Panggil semua update sekaligus
   ============================================================ */

/**
 * Fungsi utama yang memanggil semua update setiap kali filter berubah.
 */
function updateDashboard() {
  updateKPIs();
  updateCharts();
}

/* ============================================================
   9. EVENT LISTENERS — Filter & Reset
   ============================================================ */

/**
 * Daftarkan semua event listener untuk filter.
 * Dipanggil satu kali saat DOMContentLoaded.
 */
function bindEventListeners() {
  // Filter Region
  document.getElementById('filter-region')?.addEventListener('change', e => {
    STATE.filters.region = e.target.value;
    applyFilters();
  });

  // Filter Kategori
  document.getElementById('filter-category')?.addEventListener('change', e => {
    STATE.filters.category = e.target.value;
    applyFilters();
  });

  // Filter Tipe Customer
  document.getElementById('filter-customer')?.addEventListener('change', e => {
    STATE.filters.customer = e.target.value;
    applyFilters();
  });

  // Filter Sales Channel
  document.getElementById('filter-channel')?.addEventListener('change', e => {
    STATE.filters.channel = e.target.value;
    applyFilters();
  });

  // Tombol Reset
  document.getElementById('btn-reset-filter')?.addEventListener('click', resetFilters);
}

/* ============================================================
   INIT — Entry point saat DOM siap
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Set global Chart.js defaults
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = '#f1f5f9';

  // Bind event listeners
  bindEventListeners();

  // Muat data CSV dan inisialisasi dashboard
  loadCSV();
});
