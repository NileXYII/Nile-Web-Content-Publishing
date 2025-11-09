// ============================================================================
// SoC Comparator Pro - Enhanced Edition
// Advanced processor comparison tool with weighted scoring, caching, and exports
// ============================================================================

// =========================
// Configuration & Constants
// =========================

const CONFIG = {
  JSON_URLS: [
    'https://raw.githubusercontent.com/NileXYII/Nile-Web-Content-Publishing/refs/heads/main/8gen3.json',
    'https://raw.githubusercontent.com/NileXYII/Nile-Web-Content-Publishing/refs/heads/main/9300.json',
  ],
  CACHE_KEY: 'soc_data_cache',
  CACHE_TIMESTAMP_KEY: 'soc_data_timestamp',
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  LAST_COMPARISON_KEY: 'last_comparison',
  THEME_KEY: 'theme_preference',
  MAX_COMPARISON_SLOTS: 4, // Support up to 4 SoCs
};

// Weighted scoring system (must sum to 100)
const SCORING_WEIGHTS = {
  cpu: 40,      // CPU performance weight
  gpu: 30,      // GPU performance weight
  memory: 15,   // Memory subsystem weight
  efficiency: 10, // Process node efficiency
  cache: 5,     // Cache hierarchy weight
};

// =========================
// Global State Management
// =========================

const state = {
  socsData: [],
  filteredSocs: [],
  activeComparison: [],
  charts: {
    main: null,
    categories: {},
  },
  darkMode: false,
  isLoading: false,
};

// =========================
// Cache Management System
// =========================

/**
 * Save SoC data to localStorage with timestamp
 * @param {Array} data - SoC data array
 */
const cacheData = (data) => {
  try {
    localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CONFIG.CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log('✓ Data cached successfully');
  } catch (error) {
    console.warn('Cache storage failed:', error.message);
  }
};

/**
 * Retrieve cached data if valid
 * @returns {Array|null} Cached data or null if expired/missing
 */
const getCachedData = () => {
  try {
    const timestamp = parseInt(localStorage.getItem(CONFIG.CACHE_TIMESTAMP_KEY), 10);
    const now = Date.now();
    
    // Check if cache is still valid
    if (timestamp && (now - timestamp < CONFIG.CACHE_DURATION)) {
      const cached = localStorage.getItem(CONFIG.CACHE_KEY);
      if (cached) {
        console.log('✓ Using cached data');
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.warn('Cache retrieval failed:', error.message);
  }
  return null;
};

/**
 * Clear all cached data
 */
const clearCache = () => {
  localStorage.removeItem(CONFIG.CACHE_KEY);
  localStorage.removeItem(CONFIG.CACHE_TIMESTAMP_KEY);
  console.log('✓ Cache cleared');
};

// =========================
// Data Loading & Processing
// =========================

/**
 * Fetch SoC data from remote sources or cache
 * Uses async/await for better error handling
 */
const loadSoCs = async () => {
  // Check cache first
  const cached = getCachedData();
  if (cached && cached.length > 0) {
    state.socsData = cached;
    state.filteredSocs = [...cached];
    initializeUI();
    return;
  }

  // Show loading indicator
  showLoadingSpinner(true);

  try {
    // Fetch all JSON files in parallel
    const responses = await Promise.all(
      CONFIG.JSON_URLS.map(url => 
        fetch(url).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
          return res.json();
        })
      )
    );

    // Merge all data sources
    let allSocs = [];
    responses.forEach(data => {
      const socs = Array.isArray(data) ? data : (data.socs || []);
      allSocs = allSocs.concat(socs);
    });

    if (allSocs.length === 0) {
      throw new Error('No SoC data found in any source');
    }

    // Normalize and validate data
    state.socsData = allSocs.map(normalizeChipData);
    state.filteredSocs = [...state.socsData];

    // Cache the loaded data
    cacheData(state.socsData);

    // Restore last comparison if exists
    restoreLastComparison();

    initializeUI();
    
  } catch (error) {
    showErrorMessage(`Failed to load database: ${error.message}`);
    console.error('Load error:', error);
  } finally {
    showLoadingSpinner(false);
  }
};

/**
 * Normalize SoC data structure for consistent processing
 * @param {Object} soc - Raw SoC data
 * @returns {Object} Normalized SoC object
 */
const normalizeChipData = (soc) => ({
  ...soc,
  frequency: parseFloat(soc.frequency) || 0,
  numCores: parseInt(soc.numCores) || 0,
  numThreads: parseInt(soc.numThreads) || 0,
  fabProcess: parseInt(soc.fabProcess) || 999,
  gpuCores: parseInt(soc.gpuCores) || 0,
  gpuClock: parseFloat(soc.gpuClock) || 0,
  l2Cache: parseInt(soc.l2Cache) || 0,
  l3Cache: parseInt(soc.l3Cache) || 0,
  maxMemorySize: parseInt(soc.maxMemorySize) || 0,
  memoryChannels: parseInt(soc.memoryChannels) || 0,
});

// =========================
// UI Initialization
// =========================

/**
 * Initialize UI after data is loaded
 */
const initializeUI = () => {
  populateDropdowns();
  
  const loadingEl = document.getElementById('loading');
  const mainEl = document.getElementById('mainContent');
  
  if (loadingEl) loadingEl.classList.add('hidden');
  if (mainEl) mainEl.classList.remove('hidden');

  console.log(`✓ Loaded ${state.socsData.length} processors`);
};

/**
 * Populate all SoC dropdown selects
 */
const populateDropdowns = () => {
  const selectors = ['soc1', 'soc2'];
  
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Select a processor...</option>';
    
    state.filteredSocs.forEach((soc, index) => {
      const option = new Option(soc.name || `SoC ${index + 1}`, index);
      select.add(option);
    });

    // Restore previous selection if valid
    if (currentValue && state.filteredSocs[currentValue]) {
      select.value = currentValue;
    }
  });

  validateComparison();
};

// =========================
// Search & Filter System
// =========================

/**
 * Filter SoC list based on search term
 * @param {string} term - Search query
 */
const filterSoCs = (term) => {
  const query = term.toLowerCase().trim();
  
  if (!query) {
    state.filteredSocs = [...state.socsData];
  } else {
    state.filteredSocs = state.socsData.filter(soc => {
      const name = (soc.name || '').toLowerCase();
      const manufacturer = (soc.manufacturer || '').toLowerCase();
      return name.includes(query) || manufacturer.includes(query);
    });
  }
  
  populateDropdowns();
};

// =========================
// Weighted Scoring System
// =========================

/**
 * Calculate comprehensive weighted performance score (0-100)
 * @param {Object} soc - SoC data object
 * @returns {number} Performance index (0-100)
 */
const calculatePerformanceIndex = (soc) => {
  // CPU Score (0-100) - based on cores, frequency, threads
  const cpuScore = Math.min(100, (
    (soc.numCores / 12) * 40 +
    (soc.frequency / 4.0) * 40 +
    (soc.numThreads / 16) * 20
  ));

  // GPU Score (0-100) - based on cores and clock
  const gpuScore = Math.min(100, (
    (soc.gpuCores / 32) * 60 +
    (soc.gpuClock / 1000) * 40
  ));

  // Memory Score (0-100)
  const memoryScore = Math.min(100, (
    (soc.maxMemorySize / 24) * 50 +
    (soc.memoryChannels / 8) * 50
  ));

  // Efficiency Score (0-100) - smaller process node is better
  const efficiencyScore = Math.max(0, 100 - (soc.fabProcess / 10) * 10);

  // Cache Score (0-100)
  const cacheScore = Math.min(100, (
    (soc.l2Cache / 16) * 50 +
    (soc.l3Cache / 64) * 50
  ));

  // Apply weighted formula
  const totalScore = (
    cpuScore * (SCORING_WEIGHTS.cpu / 100) +
    gpuScore * (SCORING_WEIGHTS.gpu / 100) +
    memoryScore * (SCORING_WEIGHTS.memory / 100) +
    efficiencyScore * (SCORING_WEIGHTS.efficiency / 100) +
    cacheScore * (SCORING_WEIGHTS.cache / 100)
  );

  return Math.round(totalScore * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate detailed comparison scores and breakdown
 * @param {Object} soc1 - First SoC
 * @param {Object} soc2 - Second SoC
 * @returns {Object} Detailed comparison results
 */
const calculateDetailedComparison = (soc1, soc2) => {
  const metrics = {
    frequency: { a: soc1.frequency, b: soc2.frequency, higher: true, label: 'CPU Clock' },
    cores: { a: soc1.numCores, b: soc2.numCores, higher: true, label: 'Core Count' },
    process: { a: soc1.fabProcess, b: soc2.fabProcess, higher: false, label: 'Process Node' },
    gpu: { a: soc1.gpuCores, b: soc2.gpuCores, higher: true, label: 'GPU Cores' },
    cache: { a: soc1.l2Cache + soc1.l3Cache, b: soc2.l2Cache + soc2.l3Cache, higher: true, label: 'Total Cache' },
    threads: { a: soc1.numThreads, b: soc2.numThreads, higher: true, label: 'Thread Count' },
  };

  let categoryWins1 = 0;
  let categoryWins2 = 0;
  const breakdown = {};

  // Calculate category winners
  Object.entries(metrics).forEach(([key, data]) => {
    if (data.higher) {
      if (data.a > data.b) {
        categoryWins1++;
        breakdown[key] = { winner: 1, diff: data.a - data.b };
      } else if (data.b > data.a) {
        categoryWins2++;
        breakdown[key] = { winner: 2, diff: data.b - data.a };
      } else {
        breakdown[key] = { winner: 0, diff: 0 };
      }
    } else {
      if (data.a < data.b) {
        categoryWins1++;
        breakdown[key] = { winner: 1, diff: data.b - data.a };
      } else if (data.b < data.a) {
        categoryWins2++;
        breakdown[key] = { winner: 2, diff: data.a - data.b };
      } else {
        breakdown[key] = { winner: 0, diff: 0 };
      }
    }
  });

  // Calculate performance indices
  const perfIndex1 = calculatePerformanceIndex(soc1);
  const perfIndex2 = calculatePerformanceIndex(soc2);

  return {
    categoryWins1,
    categoryWins2,
    perfIndex1,
    perfIndex2,
    breakdown,
    metrics,
  };
};

// =========================
// Comparison Execution
// =========================

/**
 * Execute comparison between selected SoCs
 */
const executeComparison = () => {
  const sel1 = document.getElementById('soc1');
  const sel2 = document.getElementById('soc2');

  if (!sel1 || !sel2) return;

  const idx1 = parseInt(sel1.value, 10);
  const idx2 = parseInt(sel2.value, 10);

  if (isNaN(idx1) || isNaN(idx2) || idx1 === idx2) {
    showErrorMessage('Please select two different processors');
    return;
  }

  const soc1 = state.filteredSocs[idx1];
  const soc2 = state.filteredSocs[idx2];

  if (!soc1 || !soc2) {
    showErrorMessage('Invalid processor selection');
    return;
  }

  // Calculate comprehensive comparison
  const results = calculateDetailedComparison(soc1, soc2);

  // Save comparison to localStorage
  saveLastComparison(idx1, idx2);

  // Update UI sections
  displayWinnerBanner(results, soc1, soc2);
  displayScoreCards(results, soc1, soc2);
  displayComparisonTable(soc1, soc2, results);
  displayPerformanceRadar(soc1, soc2);

  // Scroll to results
  scrollToResults();
};

// =========================
// UI Display Functions
// =========================

/**
 * Display winner banner with animation
 */
const displayWinnerBanner = (results, soc1, soc2) => {
  const banner = document.getElementById('winner');
  const titleEl = document.getElementById('winnerText');
  const subtextEl = document.getElementById('winnerSubtext');

  if (!banner || !titleEl || !subtextEl) return;

  let title, subtext;

  if (results.perfIndex1 > results.perfIndex2) {
    title = `🏆 ${soc1.name} Wins!`;
    subtext = `Performance Index: ${results.perfIndex1} vs ${results.perfIndex2} | Wins ${results.categoryWins1}/${results.categoryWins1 + results.categoryWins2} categories`;
  } else if (results.perfIndex2 > results.perfIndex1) {
    title = `🏆 ${soc2.name} Wins!`;
    subtext = `Performance Index: ${results.perfIndex2} vs ${results.perfIndex1} | Wins ${results.categoryWins2}/${results.categoryWins1 + results.categoryWins2} categories`;
  } else {
    title = '🤝 Perfect Tie!';
    subtext = `Both processors score ${results.perfIndex1} | Evenly matched across all metrics`;
  }

  titleEl.textContent = title;
  subtextEl.textContent = subtext;
  banner.classList.remove('hidden');
};

/**
 * Display score cards with performance indices
 */
const displayScoreCards = (results, soc1, soc2) => {
  const cardsSection = document.getElementById('scoreCards');
  if (!cardsSection) return;

  const score1El = document.getElementById('score1');
  const score2El = document.getElementById('score2');
  const name1El = document.getElementById('soc1Name');
  const name2El = document.getElementById('soc2Name');

  if (score1El) score1El.textContent = results.perfIndex1;
  if (score2El) score2El.textContent = results.perfIndex2;
  if (name1El) name1El.textContent = soc1.name;
  if (name2El) name2El.textContent = soc2.name;

  cardsSection.classList.remove('hidden');
};

/**
 * Generate SVG icons for categories
 */
const getCategoryIcon = (category) => {
  const icons = {
    'General Info': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
    'CPU Performance': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M13 7H7v6h6V7z"></path><path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clip-rule="evenodd"></path></svg>',
    'Memory': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"></path><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"></path><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"></path></svg>',
    'Graphics': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>',
  };
  return icons[category] || icons['General Info'];
};

/**
 * Display detailed comparison table
 */
const displayComparisonTable = (soc1, soc2, results) => {
  const resultContainer = document.getElementById('result');
  if (!resultContainer) return;

  // Destroy existing category charts
  destroyCategoryCharts();

  const categories = [
    {
      name: 'General Info',
      chartId: 'generalChart',
      fields: [
        { label: 'Processor Name', key: 'name' },
        { label: 'Manufacturer', key: 'manufacturer' },
        { label: 'Launch Date', key: 'launch' },
        { label: 'Process Node', key: 'fabProcess', unit: 'nm', compare: 'lower' },
        { label: 'Die Size', key: 'socSize', unit: 'mm²', compare: 'lower' },
      ],
    },
    {
      name: 'CPU Performance',
      chartId: 'cpuChart',
      fields: [
        { label: 'CPU Cores', key: 'numCores', compare: 'higher' },
        { label: 'CPU Threads', key: 'numThreads', compare: 'higher' },
        { label: 'Max Frequency', key: 'frequency', unit: 'GHz', compare: 'higher' },
        { label: 'L2 Cache', key: 'l2Cache', unit: 'MB', compare: 'higher' },
        { label: 'L3 Cache', key: 'l3Cache', unit: 'MB', compare: 'higher' },
        { label: 'Architecture', key: 'architecture' },
      ],
    },
    {
      name: 'Memory',
      chartId: 'memoryChart',
      fields: [
        { label: 'Memory Type', key: 'memoryType' },
        { label: 'Max Memory', key: 'maxMemorySize', unit: 'GB', compare: 'higher' },
        { label: 'Memory Channels', key: 'memoryChannels', compare: 'higher' },
        { label: 'Memory Bandwidth', key: 'memoryBandwidth', unit: 'GB/s', compare: 'higher' },
      ],
    },
    {
      name: 'Graphics',
      chartId: 'graphicsChart',
      fields: [
        { label: 'GPU Model', key: 'gpuName' },
        { label: 'GPU Cores', key: 'gpuCores', compare: 'higher' },
        { label: 'GPU Clock', key: 'gpuClock', unit: 'MHz', compare: 'higher' },
        { label: 'GPU Architecture', key: 'gpuArchitecture' },
      ],
    },
  ];

  let html = '<div class="bg-white rounded-2xl shadow-xl overflow-hidden">';

  categories.forEach(({ name, chartId, fields }) => {
    html += `
      <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4">
        <div class="flex items-center justify-center">
          <span class="mr-3">${getCategoryIcon(name)}</span>
          <h3 class="text-2xl font-bold">${name}</h3>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-4 text-left text-sm font-bold text-gray-700">Specification</th>
              <th class="px-6 py-4 text-center text-sm font-bold text-purple-700">${soc1.name}</th>
              <th class="px-6 py-4 text-center text-sm font-bold text-pink-700">${soc2.name}</th>
            </tr>
          </thead>
          <tbody>`;

    fields.forEach(({ label, key, unit, compare }) => {
      const val1 = soc1[key] !== undefined && soc1[key] !== '' ? soc1[key] : 'N/A';
      const val2 = soc2[key] !== undefined && soc2[key] !== '' ? soc2[key] : 'N/A';
      
      let class1 = '';
      let class2 = '';

      // Highlight winner if comparable
      if (compare && val1 !== 'N/A' && val2 !== 'N/A') {
        const num1 = parseFloat(val1);
        const num2 = parseFloat(val2);

        if (!isNaN(num1) && !isNaN(num2)) {
          if (compare === 'higher') {
            class1 = num1 > num2 ? 'bg-green-100 font-bold text-green-900' : num1 < num2 ? 'bg-red-50 text-red-700' : '';
            class2 = num2 > num1 ? 'bg-green-100 font-bold text-green-900' : num2 < num1 ? 'bg-red-50 text-red-700' : '';
          } else {
            class1 = num1 < num2 ? 'bg-green-100 font-bold text-green-900' : num1 > num2 ? 'bg-red-50 text-red-700' : '';
            class2 = num2 < num1 ? 'bg-green-100 font-bold text-green-900' : num2 > num1 ? 'bg-red-50 text-red-700' : '';
          }
        }
      }

      const display1 = val1 !== 'N/A' && unit ? `${val1} ${unit}` : val1;
      const display2 = val2 !== 'N/A' && unit ? `${val2} ${unit}` : val2;

      html += `
        <tr class="border-b hover:bg-gray-50 transition">
          <td class="px-6 py-4 font-semibold text-gray-700">${label}</td>
          <td class="px-6 py-4 text-center ${class1}">${display1}</td>
          <td class="px-6 py-4 text-center ${class2}">${display2}</td>
        </tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
      <div class="p-6 bg-gray-50 border-b-4 border-purple-100">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <h4 class="text-lg font-bold text-gray-800">${name} Comparison</h4>
        </div>
        <div class="category-chart-container">
          <canvas id="${chartId}"></canvas>
        </div>
      </div>`;
  });

  html += '</div>';
  resultContainer.innerHTML = html;

  // Create category charts after DOM update
  setTimeout(() => {
    categories.forEach(({ name, chartId, fields }) => {
      createCategoryChart(chartId, name, soc1, soc2, fields);
    });
  }, 100);
};

/**
 * Create individual category comparison chart
 */
const createCategoryChart = (canvasId, categoryName, soc1, soc2, fields) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`Canvas not found: ${canvasId}`);
    return;
  }

  // Destroy existing chart
  if (state.charts.categories[canvasId]) {
    state.charts.categories[canvasId].destroy();
  }

  const labels = [];
  const data1 = [];
  const data2 = [];

  fields.forEach(({ label, key, compare }) => {
    if (!compare) return; // Skip non-numeric fields

    const val1 = parseFloat(soc1[key]) || 0;
    const val2 = parseFloat(soc2[key]) || 0;

    if (val1 === 0 && val2 === 0) return;

    labels.push(label);

    // Invert values for "lower is better" metrics
    if (compare === 'lower') {
      data1.push(val1 > 0 ? 100 - Math.min(val1, 100) : 0);
      data2.push(val2 > 0 ? 100 - Math.min(val2, 100) : 0);
    } else {
      data1.push(val1);
      data2.push(val2);
    }
  });

  if (labels.length === 0) return;

  state.charts.categories[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: soc1.name,
          data: data1,
          backgroundColor: 'rgba(147, 51, 234, 0.7)',
          borderColor: 'rgb(147, 51, 234)',
          borderWidth: 2,
          borderRadius: 8,
        },
        {
          label: soc2.name,
          data: data2,
          backgroundColor: 'rgba(236, 72, 153, 0.7)',
          borderColor: 'rgb(236, 72, 153)',
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 12, weight: 'bold' },
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#e5e7eb' },
        },
      y: {
        grid: { display: false },
      },
    },
  },
});

// =========================
// Chart & DOM Cleanup
// =========================

/**
 * Destroy category charts
 */
const destroyCategoryCharts = () => {
  Object.keys(state.charts.categories).forEach((id) => {
    try {
      const chart = state.charts.categories[id];
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    } catch (e) {
      console.warn('Failed to destroy category chart', id, e);
    }
    delete state.charts.categories[id];
  });
};

/**
 * Destroy main/radar charts
 */
const destroyMainCharts = () => {
  if (state.charts.main && typeof state.charts.main.destroy === 'function') {
    state.charts.main.destroy();
    state.charts.main = null;
  }
};

// =========================
// Performance Breakdown
// =========================

/**
 * Return component scores used for radar chart and breakdown
 * Values are normalized 0-100
 * @param {Object} soc
 * @returns {Object} { cpu, gpu, memory, efficiency, cache }
 */
const getComponentScores = (soc) => {
  // CPU: combine cores, frequency, threads (scale to 100)
  const cpu = Math.min(100, (
    (soc.numCores / 12) * 40 +
    (soc.frequency / 4.0) * 40 +
    (soc.numThreads / 16) * 20
  ));

  // GPU: cores + clock
  const gpu = Math.min(100, (
    (soc.gpuCores / 32) * 60 +
    (soc.gpuClock / 1000) * 40
  ));

  // Memory: maxMemorySize (GB) and channels
  const memory = Math.min(100, (
    (soc.maxMemorySize / 24) * 50 +
    (soc.memoryChannels / 8) * 50
  ));

  // Efficiency: smaller fabProcess -> higher score
  const efficiency = Math.max(0, 100 - (soc.fabProcess / 10) * 10);

  // Cache: L2 + L3
  const cache = Math.min(100, (
    (soc.l2Cache / 16) * 50 +
    (soc.l3Cache / 64) * 50
  ));

  return {
    cpu: Math.round(cpu * 10) / 10,
    gpu: Math.round(gpu * 10) / 10,
    memory: Math.round(memory * 10) / 10,
    efficiency: Math.round(efficiency * 10) / 10,
    cache: Math.round(cache * 10) / 10,
  };
};

// =========================
// Radar Chart (Performance)
// =========================

/**
 * Create a radar chart comparing two SoCs across component scores
 */
const createPerformanceRadar = (canvasId, soc1, soc2) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy previous
  if (state.charts.main) {
    destroyMainCharts();
  }

  const labels = ['CPU', 'GPU', 'Memory', 'Efficiency', 'Cache'];
  const s1 = getComponentScores(soc1);
  const s2 = getComponentScores(soc2);

  state.charts.main = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: soc1.name,
          data: [s1.cpu, s1.gpu, s1.memory, s1.efficiency, s1.cache],
          fill: true,
          backgroundColor: 'rgba(147,51,234,0.12)',
          borderColor: 'rgb(147,51,234)',
          pointRadius: 4,
        },
        {
          label: soc2.name,
          data: [s2.cpu, s2.gpu, s2.memory, s2.efficiency, s2.cache],
          fill: true,
          backgroundColor: 'rgba(236,72,153,0.12)',
          borderColor: 'rgb(236,72,153)',
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { stepSize: 20 },
        },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { enabled: true },
      },
    },
  });
};

/**
 * Wrapper to display performance radar in UI area
 */
const displayPerformanceRadar = (soc1, soc2) => {
  const radarContainer = document.getElementById('performanceRadar');
  if (!radarContainer) return;

  radarContainer.innerHTML = `
    <div class="p-6 bg-white rounded-2xl shadow-md">
      <h4 class="text-lg font-bold mb-4">Performance Radar</h4>
      <div style="height:360px">
        <canvas id="radarChartMain"></canvas>
      </div>
    </div>`;
  
  setTimeout(() => createPerformanceRadar('radarChartMain', soc1, soc2), 50);
};

// =========================
// Persistence & Utilities
// =========================

/**
 * Save last comparison indices to localStorage
 */
const saveLastComparison = (idx1, idx2) => {
  try {
    const payload = { idx1, idx2, timestamp: Date.now() };
    localStorage.setItem(CONFIG.LAST_COMPARISON_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save last comparison', e);
  }
};

/**
 * Restore last comparison if it exists
 */
const restoreLastComparison = () => {
  try {
    const raw = localStorage.getItem(CONFIG.LAST_COMPARISON_KEY);
    if (!raw) return;
    const { idx1, idx2 } = JSON.parse(raw);
    const sel1 = document.getElementById('soc1');
    const sel2 = document.getElementById('soc2');
    if (sel1 && sel2 && state.filteredSocs[idx1] && state.filteredSocs[idx2]) {
      sel1.value = idx1;
      sel2.value = idx2;
      // Optionally auto-run comparison - comment out if undesired
      // executeComparison();
    }
  } catch (e) {
    console.warn('Failed to restore last comparison', e);
  }
};

/**
 * Scroll viewport to results section
 */
const scrollToResults = () => {
  const el = document.getElementById('result');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * Set loading spinner visibility
 */
const showLoadingSpinner = (show) => {
  state.isLoading = !!show;
  const loadingEl = document.getElementById('loading');
  if (!loadingEl) return;
  if (show) loadingEl.classList.remove('hidden');
  else loadingEl.classList.add('hidden');
};

/**
 * Display an error message in UI (simple)
 */
const showErrorMessage = (msg) => {
  console.error(msg);
  // Simple toast / banner fallback
  const errEl = document.getElementById('errorBanner');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 6000);
  } else {
    alert(msg);
  }
};

/**
 * Validate comparison selections (enable/disable compare button)
 */
const validateComparison = () => {
  const sel1 = document.getElementById('soc1');
  const sel2 = document.getElementById('soc2');
  const btn = document.getElementById('compareBtn');
  if (!btn) return;
  const idx1 = sel1 ? sel1.value : null;
  const idx2 = sel2 ? sel2.value : null;
  btn.disabled = (!idx1 || !idx2 || idx1 === idx2);
};

// =========================
// Export / Download Helpers
// =========================

/**
 * Export current comparison table as CSV
 * Builds CSV by reading the comparison table DOM
 */
const exportComparisonCSV = (soc1, soc2, results) => {
  // We will export some key fields and the performance indices
  const rows = [];
  rows.push(['Metric', soc1.name, soc2.name]);

  // Add summarized metrics
  rows.push(['Performance Index', results.perfIndex1, results.perfIndex2]);
  rows.push(['Category Wins', results.categoryWins1, results.categoryWins2]);

  // Add breakdown metrics
  Object.entries(results.metrics).forEach(([key, data]) => {
    const label = data.label || key;
    rows.push([label, data.a !== undefined ? data.a : 'N/A', data.b !== undefined ? data.b : 'N/A']);
  });

  // Convert to CSV string
  const csv = rows.map(r => r.map(cell => `"${(`${cell}`).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadExport(csv, `${soc1.name}_vs_${soc2.name}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Export current comparison as JSON
 */
const exportComparisonJSON = (soc1, soc2, results) => {
  const payload = {
    soc1,
    soc2,
    results,
    exportedAt: new Date().toISOString(),
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  downloadExport(jsonStr, `${soc1.name}_vs_${soc2.name}.json`, 'application/json;charset=utf-8;');
};

/**
 * Generic file download helper
 */
const downloadExport = (content, filename, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// =========================
// Misc UI Helpers
// =========================

/**
 * Clear cached SoC data (and reload)
 */
const handleClearCache = () => {
  clearCache();
  state.socsData = [];
  state.filteredSocs = [];
  // simple UI reset
  const sel1 = document.getElementById('soc1');
  const sel2 = document.getElementById('soc2');
  if (sel1) sel1.innerHTML = '<option value="">Select a processor...</option>';
  if (sel2) sel2.innerHTML = '<option value="">Select a processor...</option>';
  loadSoCs();
};

/**
 * Toggle theme preference (basic)
 */
const toggleDarkMode = () => {
  state.darkMode = !state.darkMode;
  document.documentElement.classList.toggle('dark', state.darkMode);
  try {
    localStorage.setItem(CONFIG.THEME_KEY, state.darkMode ? 'dark' : 'light');
  } catch (e) { /* ignore */ }
};

/**
 * Load stored theme preference
 */
const restoreTheme = () => {
  try {
    const pref = localStorage.getItem(CONFIG.THEME_KEY);
    if (pref) {
      state.darkMode = pref === 'dark';
      document.documentElement.classList.toggle('dark', state.darkMode);
    }
  } catch (e) { /* ignore */ }
};

// =========================
// Event Binding & Init
// =========================

document.addEventListener('DOMContentLoaded', () => {
  // Buttons & inputs
  const compareBtn = document.getElementById('compareBtn');
  if (compareBtn) compareBtn.addEventListener('click', executeComparison);

  const sel1 = document.getElementById('soc1');
  const sel2 = document.getElementById('soc2');
  if (sel1) sel1.addEventListener('change', validateComparison);
  if (sel2) sel2.addEventListener('change', validateComparison);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let t;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => filterSoCs(e.target.value), 250);
    });
  }

  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', handleClearCache);

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleDarkMode);

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const sel1Idx = parseInt(document.getElementById('soc1').value, 10);
      const sel2Idx = parseInt(document.getElementById('soc2').value, 10);
      if (isNaN(sel1Idx) || isNaN(sel2Idx)) return showErrorMessage('Select two processors to export comparison');
      const soc1 = state.filteredSocs[sel1Idx], soc2 = state.filteredSocs[sel2Idx];
      const results = calculateDetailedComparison(soc1, soc2);
      exportComparisonCSV(soc1, soc2, results);
    });
  }
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const sel1Idx = parseInt(document.getElementById('soc1').value, 10);
      const sel2Idx = parseInt(document.getElementById('soc2').value, 10);
      if (isNaN(sel1Idx) || isNaN(sel2Idx)) return showErrorMessage('Select two processors to export comparison');
      const soc1 = state.filteredSocs[sel1Idx], soc2 = state.filteredSocs[sel2Idx];
      const results = calculateDetailedComparison(soc1, soc2);
      exportComparisonJSON(soc1, soc2, results);
    });
  }

  // Restore theme and data
  restoreTheme();
  loadSoCs();
});
