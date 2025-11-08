// SoC Comparator Pro - Main JavaScript
// GitHub JSON Data URLs
const JSON_URLS = [
    'https://raw.githubusercontent.com/NileXYII/Nile-Web-Content-Publishing/refs/heads/main/8gen3.json',
    'https://raw.githubusercontent.com/NileXYII/Nile-Web-Content-Publishing/refs/heads/main/9300.json',
];

let socsData = [];
let filteredSocs1 = [];
let filteredSocs2 = [];
let chart = null;

// Load SoC data from GitHub
async function loadSoCs() {
    try {
        const responses = await Promise.all(JSON_URLS.map(url => fetch(url)));
        const data = await Promise.all(responses.map(r => r.json()));
        
        // Merge all data sources
        data.forEach(d => socsData = socsData.concat(Array.isArray(d) ? d : d.socs || []));
        
        if (socsData.length === 0) throw new Error('No SoCs found in database');
        
        filteredSocs1 = [...socsData];
        filteredSocs2 = [...socsData];
        
        populateSelects();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    } catch (err) {
        showError('Failed to load SoC database: ' + err.message);
        document.getElementById('loading').classList.add('hidden');
    }
}

// Show error message
function showError(msg) {
    const el = document.getElementById('error');
    document.getElementById('errorText').textContent = msg;
    el.classList.remove('hidden');
}

// Populate dropdown selects
function populateSelects(list1 = socsData, list2 = socsData) {
    const sel1 = document.getElementById('soc1');
    const sel2 = document.getElementById('soc2');
    
    const currentVal1 = sel1.value;
    const currentVal2 = sel2.value;
    
    sel1.innerHTML = '<option value="">Select a processor...</option>';
    sel2.innerHTML = '<option value="">Select a processor...</option>';
    
    list1.forEach((soc, i) => {
        const idx = socsData.indexOf(soc);
        sel1.add(new Option(soc.name || `SoC ${i+1}`, idx));
    });
    
    list2.forEach((soc, i) => {
        const idx = socsData.indexOf(soc);
        sel2.add(new Option(soc.name || `SoC ${i+1}`, idx));
    });
    
    if (currentVal1) sel1.value = currentVal1;
    if (currentVal2) sel2.value = currentVal2;
}

// Search functionality for first SoC
document.getElementById('search1').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    filteredSocs1 = socsData.filter(soc => 
        (soc.name || '').toLowerCase().includes(term)
    );
    populateSelects(filteredSocs1, filteredSocs2);
});

// Search functionality for second SoC
document.getElementById('search2').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    filteredSocs2 = socsData.filter(soc => 
        (soc.name || '').toLowerCase().includes(term)
    );
    populateSelects(filteredSocs1, filteredSocs2);
});

// Swap button functionality
document.getElementById('swapBtn').addEventListener('click', () => {
    const sel1 = document.getElementById('soc1');
    const sel2 = document.getElementById('soc2');
    const temp = sel1.value;
    sel1.value = sel2.value;
    sel2.value = temp;
    checkSelections();
});

// Check if both selections are made and different
function checkSelections() {
    const v1 = document.getElementById('soc1').value;
    const v2 = document.getElementById('soc2').value;
    document.getElementById('compareBtn').disabled = !(v1 && v2 && v1 !== v2);
}

// Enable compare button when selections change
document.getElementById('soc1').addEventListener('change', checkSelections);
document.getElementById('soc2').addEventListener('change', checkSelections);

// Compare button click handler
document.getElementById('compareBtn').addEventListener('click', () => {
    const soc1 = socsData[document.getElementById('soc1').value];
    const soc2 = socsData[document.getElementById('soc2').value];
    
    const scores = calcDetailedScore(soc1, soc2);
    
    showWinner(scores.score1, scores.score2, soc1, soc2);
    showScoreCards(scores.score1, scores.score2, soc1, soc2);
    showComparison(soc1, soc2, scores);
    showPerformanceChart(soc1, soc2, scores);
});

// Calculate detailed comparison scores
function calcDetailedScore(a, b) {
    const metrics = {
        frequency: { a: parseFloat(a.frequency) || 0, b: parseFloat(b.frequency) || 0, higher: true },
        cores: { a: parseInt(a.numCores) || 0, b: parseInt(b.numCores) || 0, higher: true },
        process: { a: parseInt(a.fabProcess) || 999, b: parseInt(b.fabProcess) || 999, higher: false },
        gpu: { a: parseInt(a.gpuCores) || 0, b: parseInt(b.gpuCores) || 0, higher: true },
        cache: { a: parseInt(a.l2Cache) || 0, b: parseInt(b.l2Cache) || 0, higher: true },
        threads: { a: parseInt(a.numThreads) || 0, b: parseInt(b.numThreads) || 0, higher: true }
    };
    
    let score1 = 0, score2 = 0;
    const breakdown = {};
    
    for (const [key, data] of Object.entries(metrics)) {
        if (data.higher) {
            if (data.a > data.b) { score1++; breakdown[key] = 1; }
            else if (data.b > data.a) { score2++; breakdown[key] = 2; }
            else breakdown[key] = 0;
        } else {
            if (data.a < data.b) { score1++; breakdown[key] = 1; }
            else if (data.b < data.a) { score2++; breakdown[key] = 2; }
            else breakdown[key] = 0;
        }
    }
    
    return { score1, score2, breakdown, metrics };
}

// Show winner banner
function showWinner(s1, s2, soc1, soc2) {
    const el = document.getElementById('winner');
    const textEl = document.getElementById('winnerText');
    const subtextEl = document.getElementById('winnerSubtext');
    
    if (s1 > s2) {
        textEl.textContent = `${soc1.name} Wins!`;
        subtextEl.textContent = `Dominates with ${s1} out of ${s1 + s2} categories`;
    } else if (s2 > s1) {
        textEl.textContent = `${soc2.name} Wins!`;
        subtextEl.textContent = `Dominates with ${s2} out of ${s1 + s2} categories`;
    } else {
        textEl.textContent = 'Perfect Tie!';
        subtextEl.textContent = 'Both processors are equally matched';
    }
    
    el.classList.remove('hidden');
}

// Show score cards
function showScoreCards(s1, s2, soc1, soc2) {
    document.getElementById('score1').textContent = s1;
    document.getElementById('score2').textContent = s2;
    document.getElementById('soc1Name').textContent = soc1.name;
    document.getElementById('soc2Name').textContent = soc2.name;
    document.getElementById('scoreCards').classList.remove('hidden');
}

// Get icon SVG for categories
function getIconSVG(category) {
    const icons = {
        'General Info': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
        'CPU Performance': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M13 7H7v6h6V7z"></path><path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clip-rule="evenodd"></path></svg>',
        'Memory': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"></path><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"></path><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"></path></svg>',
        'Graphics': '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>'
    };
    return icons[category] || icons['General Info'];
}

// Show detailed comparison table
function showComparison(soc1, soc2, scores) {
    const specs = [
        {cat: 'General Info', fields: [
            {l: 'Processor Name', k: 'name'},
            {l: 'Launch Date', k: 'launch'},
            {l: 'Process Node', k: 'fabProcess', u: 'nm', c: 'l'},
            {l: 'Die Size', k: 'socSize', u: 'mm²', c: 'l'}
        ]},
        {cat: 'CPU Performance', fields: [
            {l: 'CPU Cores', k: 'numCores', c: 'h'},
            {l: 'CPU Threads', k: 'numThreads', c: 'h'},
            {l: 'Max Frequency', k: 'frequency', u: 'GHz', c: 'h'},
            {l: 'L2 Cache', k: 'l2Cache', u: 'MB', c: 'h'},
            {l: 'L3 Cache', k: 'l3Cache', u: 'MB', c: 'h'}
        ]},
        {cat: 'Memory', fields: [
            {l: 'Memory Type', k: 'memoryType'},
            {l: 'Max Memory', k: 'maxMemorySize', u: 'GB', c: 'h'},
            {l: 'Memory Channels', k: 'memoryChannels', c: 'h'}
        ]},
        {cat: 'Graphics', fields: [
            {l: 'GPU Model', k: 'gpuName'},
            {l: 'GPU Cores', k: 'gpuCores', c: 'h'},
            {l: 'GPU Clock', k: 'gpuClock', u: 'MHz', c: 'h'}
        ]}
    ];

    let html = '<div class="bg-white rounded-2xl shadow-xl overflow-hidden">';
    
    specs.forEach(({cat, fields}) => {
        html += `<div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4">
            <div class="flex items-center justify-center">
                <span class="mr-3">${getIconSVG(cat)}</span>
                <h3 class="text-2xl font-bold">${cat}</h3>
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
        
        fields.forEach(({l, k, u, c}) => {
            const v1 = soc1[k] || 'N/A';
            const v2 = soc2[k] || 'N/A';
            let w1 = '', w2 = '';
            
            if (c && v1 !== 'N/A' && v2 !== 'N/A') {
                const n1 = parseFloat(v1), n2 = parseFloat(v2);
                if (c === 'h') {
                    w1 = n1 > n2 ? 'bg-green-100 font-bold text-green-900' : n1 < n2 ? 'bg-red-50 text-red-700' : '';
                    w2 = n2 > n1 ? 'bg-green-100 font-bold text-green-900' : n2 < n1 ? 'bg-red-50 text-red-700' : '';
                } else {
                    w1 = n1 < n2 ? 'bg-green-100 font-bold text-green-900' : n1 > n2 ? 'bg-red-50 text-red-700' : '';
                    w2 = n2 < n1 ? 'bg-green-100 font-bold text-green-900' : n2 > n1 ? 'bg-red-50 text-red-700' : '';
                }
            }
            
            html += `<tr class="border-b hover:bg-gray-50 transition">
                <td class="px-6 py-4 font-semibold text-gray-700">${l}</td>
                <td class="px-6 py-4 text-center ${w1}">${v1}${u && v1 !== 'N/A' ? ' '+u : ''}</td>
                <td class="px-6 py-4 text-center ${w2}">${v2}${u && v2 !== 'N/A' ? ' '+u : ''}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
    });
    
    html += '</div>';
    document.getElementById('result').innerHTML = html;
}


                
                        
                // Enhanced performance radar chart with animations and better styling
function showPerformanceChart(soc1, soc2, scores) {
    const ctx = document.getElementById('performanceChart');
    document.getElementById('chartSection').classList.remove('hidden');
    
    if (chart) chart.destroy();
    
    const categories = ['Max Frequency', 'CPU Cores', 'Process Node', 'GPU Cores', 'L2 Cache', 'Threads'];
    
    // Normalize data for better visualization
    const normalize = (val, max) => (val / max) * 100;
    
    const freq1 = parseFloat(soc1.frequency) || 0;
    const freq2 = parseFloat(soc2.frequency) || 0;
    const maxFreq = Math.max(freq1, freq2, 1);
    
    const cores1 = parseInt(soc1.numCores) || 0;
    const cores2 = parseInt(soc2.numCores) || 0;
    const maxCores = Math.max(cores1, cores2, 1);
    
    const proc1 = parseInt(soc1.fabProcess) || 999;
    const proc2 = parseInt(soc2.fabProcess) || 999;
    const maxProc = Math.max(proc1, proc2, 1);
    
    const gpu1 = parseInt(soc1.gpuCores) || 0;
    const gpu2 = parseInt(soc2.gpuCores) || 0;
    const maxGpu = Math.max(gpu1, gpu2, 1);
    
    const cache1 = parseInt(soc1.l2Cache) || 0;
    const cache2 = parseInt(soc2.l2Cache) || 0;
    const maxCache = Math.max(cache1, cache2, 1);
    
    const threads1 = parseInt(soc1.numThreads) || 0;
    const threads2 = parseInt(soc2.numThreads) || 0;
    const maxThreads = Math.max(threads1, threads2, 1);
    
    const data1 = [
        normalize(freq1, maxFreq),
        normalize(cores1, maxCores),
        normalize(maxProc - proc1, maxProc), // Inverted - lower is better
        normalize(gpu1, maxGpu),
        normalize(cache1, maxCache),
        normalize(threads1, maxThreads)
    ];
    
    const data2 = [
        normalize(freq2, maxFreq),
        normalize(cores2, maxCores),
        normalize(maxProc - proc2, maxProc), // Inverted - lower is better
        normalize(gpu2, maxGpu),
        normalize(cache2, maxCache),
        normalize(threads2, maxThreads)
    ];
    
    // Create gradient fills
    const createGradient = (ctx, color1, color2) => {
        const gradient = ctx.createRadialGradient(
            ctx.canvas.width / 2, 
            ctx.canvas.height / 2, 
            0,
            ctx.canvas.width / 2, 
            ctx.canvas.height / 2, 
            ctx.canvas.width / 2
        );
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };
    
    chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: categories,
            datasets: [{
                label: soc1.name,
                data: data1,
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.25)',
                borderWidth: 3,
                pointBackgroundColor: 'rgb(147, 51, 234)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(147, 51, 234)',
                pointHoverBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.2
            },
            {
                label: soc2.name,
                data: data2,
                borderColor: 'rgb(236, 72, 153)',
                backgroundColor: 'rgba(236, 72, 153, 0.25)',
                borderWidth: 3,
                pointBackgroundColor: 'rgb(236, 72, 153)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(236, 72, 153)',
                pointHoverBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart',
                onComplete: function() {
                    // Optional: Add completion callback
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    beginAtZero: true,
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.08)',
                        lineWidth: 2
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        circular: true,
                        lineWidth: 1.5
                    },
                    pointLabels: {
                        color: '#1f2937',
                        font: {
                            size: 13,
                            weight: '600',
                            family: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                        },
                        padding: 15,
                        callback: function(label) {
                            // Add line breaks for long labels
                            if (label.length > 12) {
                                const words = label.split(' ');
                                return words;
                            }
                            return label;
                        }
                    },
                    ticks: {
                        display: true,
                        stepSize: 20,
                        color: '#6b7280',
                        backdropColor: 'rgba(255, 255, 255, 0.9)',
                        backdropPadding: 4,
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'center',
                    labels: {
                        color: '#1f2937',
                        font: {
                            size: 15,
                            weight: '700',
                            family: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e5e7eb',
                    titleFont: {
                        size: 15,
                        weight: 'bold',
                        family: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500',
                        family: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                    },
                    padding: 16,
                    cornerRadius: 12,
                    displayColors: true,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.r;
                            
                            // Get actual values
                            let actualValue = '';
                            const index = context.dataIndex;
                            const soc = context.datasetIndex === 0 ? soc1 : soc2;
                            
                            switch(index) {
                                case 0:
                                    actualValue = `${parseFloat(soc.frequency) || 0} GHz`;
                                    break;
                                case 1:
                                    actualValue = `${parseInt(soc.numCores) || 0} cores`;
                                    break;
                                case 2:
                                    actualValue = `${parseInt(soc.fabProcess) || 0}nm`;
                                    break;
                                case 3:
                                    actualValue = `${parseInt(soc.gpuCores) || 0} cores`;
                                    break;
                                case 4:
                                    actualValue = `${parseInt(soc.l2Cache) || 0} MB`;
                                    break;
                                case 5:
                                    actualValue = `${parseInt(soc.numThreads) || 0} threads`;
                                    break;
                            }
                            
                            return `${label}: ${actualValue} (${value.toFixed(1)}%)`;
                        },
                        title: function(context) {
                            return context[0].label;
                        }
                    }
                },
                // Add custom plugin for center text
                title: {
                    display: true,
                    text: 'Performance Comparison (Normalized)',
                    color: '#1f2937',
                    font: {
                        size: 18,
                        weight: 'bold',
                        family: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                }
            },
            interaction: {
                mode: 'point',
                intersect: true
            }
        }
    });
                        }

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSoCs();
});
