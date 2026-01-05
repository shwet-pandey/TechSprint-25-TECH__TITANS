// Decision Engine
// Analyzes gas sensor data and makes safety decisions based on trends and thresholds

class DecisionEngine {
    constructor() {
        this.historySize = 10; // Analyze last 10 values
        this.valueHistory = [];
        this.currentState = 'SAFE';
        this.currentExplanation = '';
        
        // Thresholds (in ppm)
        this.thresholds = {
            safe: 50,
            warning: 200,
            critical: 500
        };
    }
    
    /**
     * Add a new gas value to history and analyze
     * @param {number} value - Current gas concentration value
     * @returns {Object} Decision result with state and explanation
     */
    analyze(value) {
        // Add to history
        this.valueHistory.push(value);
        
        // Keep only last N values
        if (this.valueHistory.length > this.historySize) {
            this.valueHistory.shift();
        }
        
        // Need at least 3 values for trend analysis
        if (this.valueHistory.length < 3) {
            this.currentState = 'SAFE';
            this.currentExplanation = 'Initializing... collecting data for analysis.';
            return {
                state: this.currentState,
                explanation: this.currentExplanation
            };
        }
        
        // Analyze current value and trends
        const analysis = this.performAnalysis();
        this.currentState = analysis.state;
        this.currentExplanation = analysis.explanation;
        
        return {
            state: this.currentState,
            explanation: this.currentExplanation,
            currentValue: value,
            trend: analysis.trend,
            average: analysis.average
        };
    }
    
    /**
     * Perform comprehensive analysis of gas values
     * @returns {Object} Analysis result
     */
    performAnalysis() {
        const currentValue = this.valueHistory[this.valueHistory.length - 1];
        const recentValues = this.valueHistory.slice(-5); // Last 5 values
        const olderValues = this.valueHistory.slice(0, -5); // Values before that
        
        // Calculate trend
        const trend = this.calculateTrend();
        const average = this.calculateAverage(recentValues);
        const maxValue = Math.max(...recentValues);
        const minValue = Math.min(...recentValues);
        const volatility = maxValue - minValue;
        
        // Decision logic based on value + trend + volatility
        
        // CRITICAL conditions
        if (currentValue >= this.thresholds.critical) {
            if (trend === 'rising') {
                return {
                    state: 'CRITICAL',
                    explanation: `Critical gas level detected (${currentValue.toFixed(1)} ppm) with rising trend. Immediate action required!`,
                    trend: trend,
                    average: average
                };
            } else if (trend === 'stable' && currentValue > this.thresholds.critical * 1.2) {
                return {
                    state: 'CRITICAL',
                    explanation: `Sustained critical gas level (${currentValue.toFixed(1)} ppm). System at maximum danger.`,
                    trend: trend,
                    average: average
                };
            } else {
                return {
                    state: 'CRITICAL',
                    explanation: `Critical gas level (${currentValue.toFixed(1)} ppm) detected. Monitor closely.`,
                    trend: trend,
                    average: average
                };
            }
        }
        
        // WARNING conditions
        if (currentValue >= this.thresholds.warning) {
            if (trend === 'rising' && volatility > 30) {
                return {
                    state: 'WARNING',
                    explanation: `Warning: Gas level at ${currentValue.toFixed(1)} ppm with rapid rise and high volatility. Leak likely developing.`,
                    trend: trend,
                    average: average
                };
            } else if (trend === 'rising') {
                return {
                    state: 'WARNING',
                    explanation: `Warning: Gas level at ${currentValue.toFixed(1)} ppm and rising. Potential leak detected.`,
                    trend: trend,
                    average: average
                };
            } else if (trend === 'stable' && currentValue > this.thresholds.warning * 1.1) {
                return {
                    state: 'WARNING',
                    explanation: `Warning: Sustained elevated gas level (${currentValue.toFixed(1)} ppm). Investigate source.`,
                    trend: trend,
                    average: average
                };
            } else {
                return {
                    state: 'WARNING',
                    explanation: `Warning: Gas level at ${currentValue.toFixed(1)} ppm. Above safe threshold.`,
                    trend: trend,
                    average: average
                };
            }
        }
        
        // SAFE conditions with trend awareness
        if (currentValue < this.thresholds.warning) {
            if (trend === 'rising' && currentValue > this.thresholds.safe && volatility > 20) {
                return {
                    state: 'WARNING',
                    explanation: `Caution: Gas level rising (${currentValue.toFixed(1)} ppm) with increasing volatility. Monitor closely.`,
                    trend: trend,
                    average: average
                };
            } else if (trend === 'rising' && currentValue > this.thresholds.safe * 0.8) {
                return {
                    state: 'SAFE',
                    explanation: `Safe: Gas level at ${currentValue.toFixed(1)} ppm, slightly elevated but within normal range.`,
                    trend: trend,
                    average: average
                };
            } else if (trend === 'falling' && currentValue < this.thresholds.safe) {
                return {
                    state: 'SAFE',
                    explanation: `Safe: Gas level at ${currentValue.toFixed(1)} ppm and decreasing. Normal conditions.`,
                    trend: trend,
                    average: average
                };
            } else {
                return {
                    state: 'SAFE',
                    explanation: `Safe: Gas level at ${currentValue.toFixed(1)} ppm. All systems normal.`,
                    trend: trend,
                    average: average
                };
            }
        }
        
        // Default safe
        return {
            state: 'SAFE',
            explanation: `Safe: Gas level at ${currentValue.toFixed(1)} ppm. Normal operation.`,
            trend: trend,
            average: average
        };
    }
    
    /**
     * Calculate trend from recent values
     * @returns {string} 'rising', 'falling', or 'stable'
     */
    calculateTrend() {
        if (this.valueHistory.length < 3) {
            return 'stable';
        }
        
        const recent = this.valueHistory.slice(-3);
        const older = this.valueHistory.slice(-5, -3);
        
        if (older.length === 0) {
            return 'stable';
        }
        
        const recentAvg = this.calculateAverage(recent);
        const olderAvg = this.calculateAverage(older);
        
        const difference = recentAvg - olderAvg;
        const threshold = 5; // Minimum change to consider a trend
        
        if (difference > threshold) {
            return 'rising';
        } else if (difference < -threshold) {
            return 'falling';
        } else {
            return 'stable';
        }
    }
    
    /**
     * Calculate average of values
     * @param {Array<number>} values - Array of values
     * @returns {number} Average value
     */
    calculateAverage(values) {
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getState() {
        return this.currentState;
    }
    
    /**
     * Get current explanation
     * @returns {string} Current explanation
     */
    getExplanation() {
        return this.currentExplanation;
    }
    
    /**
     * Reset history
     */
    reset() {
        this.valueHistory = [];
        this.currentState = 'SAFE';
        this.currentExplanation = 'System reset. Analyzing...';
    }
}

// Export singleton instance
const decisionEngine = new DecisionEngine();

// Also export class for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DecisionEngine, decisionEngine };
}

