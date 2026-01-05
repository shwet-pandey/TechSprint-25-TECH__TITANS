// Gas Sensor Simulator
// Simulates realistic gas concentration values for different scenarios
//
// HARDWARE INTEGRATION NOTES:
// ===========================
// In production, replace this simulator with actual hardware integration:
//
// Option 1: MQTT Integration
// ---------------------------
// - Connect Arduino/Raspberry Pi with MQ-2 or MQ-9 gas sensor
// - Publish sensor readings to MQTT broker (e.g., Mosquitto, AWS IoT)
// - Replace this class with MQTT client that subscribes to sensor topic
// - Example: mqttClient.subscribe('sensors/gas/kitchen', (data) => { ... })
//
// Option 2: HTTP/REST API
// -----------------------
// - Create API endpoint on IoT device (ESP32, Raspberry Pi)
// - Poll endpoint every second: fetch('http://device-ip/api/gas-reading')
// - Replace gasSensor.start() with setInterval polling
//
// Option 3: WebSocket
// -------------------
// - Establish WebSocket connection to IoT device
// - Receive real-time sensor data: ws.onmessage = (event) => { ... }
// - Replace callback system with WebSocket event handlers
//
// Sensor Calibration:
// - Real sensors need calibration for accurate ppm readings
// - Implement calibration offset/multiplier in hardware code
// - Consider sensor warm-up time (typically 20-30 seconds)

class GasSensorSimulator {
    constructor() {
        this.currentMode = 'normal';
        this.currentValue = 0;
        this.targetValue = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.callbacks = [];
        
        // Mode configurations
        this.modes = {
            normal: {
                min: 0,
                max: 50,
                baseValue: 15,
                volatility: 5,
                spikeChance: 0.1, // 10% chance of spike per second
                spikeIntensity: 20
            },
            minorLeak: {
                min: 50,
                max: 200,
                baseValue: 100,
                volatility: 15,
                spikeChance: 0.3,
                spikeIntensity: 40,
                riseRate: 0.5 // gradual rise over time
            },
            criticalLeak: {
                min: 200,
                max: 1000,
                baseValue: 500,
                volatility: 50,
                spikeChance: 0.5,
                spikeIntensity: 100,
                riseRate: 2.0 // rapid rise
            }
        };
        
        // State tracking for realistic behavior
        this.timeElapsed = 0;
        this.lastSpikeTime = 0;
    }
    
    /**
     * Start the simulation
     * @param {string} mode - 'normal', 'minorLeak', or 'criticalLeak'
     * @param {number} updateInterval - Update interval in milliseconds (default: 1000ms)
     */
    start(mode = 'normal', updateInterval = 1000) {
        if (this.isRunning) {
            this.stop();
        }
        
        if (!this.modes[mode]) {
            console.error(`Invalid mode: ${mode}. Use 'normal', 'minorLeak', or 'criticalLeak'`);
            return;
        }
        
        this.currentMode = mode;
        this.isRunning = true;
        this.timeElapsed = 0;
        this.currentValue = this.modes[mode].baseValue;
        this.targetValue = this.modes[mode].baseValue;
        
        // Update every second
        this.intervalId = setInterval(() => {
            this.update();
        }, updateInterval);
        
        // Initial update
        this.update();
        
        console.log(`Gas sensor simulation started in ${mode} mode`);
    }
    
    /**
     * Stop the simulation
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('Gas sensor simulation stopped');
    }
    
    /**
     * Update the gas concentration value based on current mode
     */
    update() {
        const modeConfig = this.modes[this.currentMode];
        this.timeElapsed += 1;
        
        // Calculate base value with gradual changes
        if (this.currentMode === 'minorLeak' || this.currentMode === 'criticalLeak') {
            // Gradual rise for leak modes
            const riseAmount = modeConfig.riseRate * (this.timeElapsed / 10);
            this.targetValue = modeConfig.baseValue + riseAmount;
            
            // Cap at max
            if (this.targetValue > modeConfig.max) {
                this.targetValue = modeConfig.max;
            }
        } else {
            // Normal mode: fluctuate around base
            this.targetValue = modeConfig.baseValue;
        }
        
        // Add random volatility
        const volatility = (Math.random() - 0.5) * modeConfig.volatility;
        this.targetValue += volatility;
        
        // Check for spikes (sudden increases)
        if (Math.random() < modeConfig.spikeChance && 
            this.timeElapsed - this.lastSpikeTime > 3) {
            const spike = Math.random() * modeConfig.spikeIntensity;
            this.targetValue += spike;
            this.lastSpikeTime = this.timeElapsed;
        }
        
        // Smooth transition to target value (realistic sensor behavior)
        const smoothingFactor = 0.3;
        this.currentValue = this.currentValue * (1 - smoothingFactor) + 
                           this.targetValue * smoothingFactor;
        
        // Clamp values to mode range
        this.currentValue = Math.max(modeConfig.min, 
                                     Math.min(modeConfig.max, this.currentValue));
        
        // Round to 2 decimal places
        this.currentValue = Math.round(this.currentValue * 100) / 100;
        
        // Notify callbacks
        this.notifyCallbacks({
            value: this.currentValue,
            mode: this.currentMode,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Change the simulation mode
     * @param {string} mode - New mode to switch to
     */
    setMode(mode) {
        if (!this.modes[mode]) {
            console.error(`Invalid mode: ${mode}`);
            return;
        }
        
        const wasRunning = this.isRunning;
        if (wasRunning) {
            this.stop();
        }
        
        this.currentMode = mode;
        this.timeElapsed = 0;
        
        if (wasRunning) {
            this.start(mode);
        }
    }
    
    /**
     * Get current gas concentration value
     * @returns {number} Current gas concentration in ppm
     */
    getValue() {
        return this.currentValue;
    }
    
    /**
     * Get current mode
     * @returns {string} Current simulation mode
     */
    getMode() {
        return this.currentMode;
    }
    
    /**
     * Subscribe to value updates
     * @param {Function} callback - Function to call on each update
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }
    
    /**
     * Unsubscribe from updates
     * @param {Function} callback - Callback to remove
     */
    offUpdate(callback) {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    }
    
    /**
     * Notify all registered callbacks
     * @param {Object} data - Update data
     */
    notifyCallbacks(data) {
        this.callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in gas sensor callback:', error);
            }
        });
    }
}

// Export singleton instance
const gasSensor = new GasSensorSimulator();

// Also export class for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GasSensorSimulator, gasSensor };
}

