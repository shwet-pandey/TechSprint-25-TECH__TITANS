// Chart Manager
// Manages Chart.js visualization for gas sensor data

class ChartManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas element with id "${canvasId}" not found`);
            return;
        }
        
        this.chart = null;
        this.maxDataPoints = 60; // Show last 60 seconds of data
        this.dataPoints = [];
        this.labels = [];
        
        // Threshold values (in ppm)
        this.thresholds = {
            safe: 50,      // Below 50 ppm is safe
            warning: 200,  // 50-200 ppm is warning
            critical: 500  // Above 200 ppm is critical
        };
        
        this.initChart();
    }
    
    /**
     * Initialize the Chart.js line chart
     */
    initChart() {
        const ctx = this.canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.labels,
                datasets: [
                    {
                        label: 'Gas Concentration (ppm)',
                        data: this.dataPoints,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    // Safe threshold line
                    {
                        label: 'Safe Threshold',
                        data: Array(this.maxDataPoints).fill(this.thresholds.safe),
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    },
                    // Warning threshold line
                    {
                        label: 'Warning Threshold',
                        data: Array(this.maxDataPoints).fill(this.thresholds.warning),
                        borderColor: 'rgb(234, 179, 8)',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    },
                    // Critical threshold line
                    {
                        label: 'Critical Threshold',
                        data: Array(this.maxDataPoints).fill(this.thresholds.critical),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Gas: ${context.parsed.y.toFixed(2)} ppm`;
                                }
                                return context.dataset.label + ': ' + context.parsed.y + ' ppm';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Gas Concentration (ppm)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: function(context) {
                                const value = context.tick.value;
                                if (value === this.thresholds.safe) {
                                    return 'rgba(34, 197, 94, 0.3)';
                                } else if (value === this.thresholds.warning) {
                                    return 'rgba(234, 179, 8, 0.3)';
                                } else if (value === this.thresholds.critical) {
                                    return 'rgba(239, 68, 68, 0.3)';
                                }
                                return 'rgba(0, 0, 0, 0.1)';
                            }.bind(this)
                        },
                        ticks: {
                            stepSize: 50
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
    
    /**
     * Add a new data point to the chart
     * @param {number} value - Gas concentration value
     * @param {string} timestamp - Optional timestamp label
     */
    addDataPoint(value, timestamp = null) {
        const now = new Date();
        const timeLabel = timestamp || 
            `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        this.dataPoints.push(value);
        this.labels.push(timeLabel);
        
        // Keep only the last N data points
        if (this.dataPoints.length > this.maxDataPoints) {
            this.dataPoints.shift();
            this.labels.shift();
        }
        
        // Update threshold lines to maintain constant values
        this.chart.data.datasets[1].data = Array(this.dataPoints.length).fill(this.thresholds.safe);
        this.chart.data.datasets[2].data = Array(this.dataPoints.length).fill(this.thresholds.warning);
        this.chart.data.datasets[3].data = Array(this.dataPoints.length).fill(this.thresholds.critical);
        
        // Update chart
        this.chart.update('none'); // 'none' mode for smooth updates
    }
    
    /**
     * Clear all chart data
     */
    clear() {
        this.dataPoints = [];
        this.labels = [];
        this.chart.data.datasets[0].data = [];
        this.chart.data.labels = [];
        this.chart.update();
    }
    
    /**
     * Get the chart instance
     * @returns {Chart} Chart.js instance
     */
    getChart() {
        return this.chart;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChartManager = ChartManager;
}

