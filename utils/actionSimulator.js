// Action Simulator
// Simulates system actions based on decision states
//
// HARDWARE INTEGRATION NOTES:
// ===========================
// In production, replace simulated actions with actual hardware control:
//
// Gas Valve Control:
// ------------------
// - Connect to smart gas valve/solenoid via IoT device
// - Use relay module (e.g., 5V relay) to control valve
// - Replace turnOffGasSupply() with: 
//   * MQTT: mqttClient.publish('actuators/gas-valve', 'OFF')
//   * HTTP: fetch('http://device-ip/api/valve', { method: 'POST', body: JSON.stringify({state: 'OFF'}) })
//   * GPIO: digitalWrite(GAS_VALVE_PIN, LOW) // on Arduino/Raspberry Pi
//
// Safety Considerations:
// - Implement hardware failsafe (valve closes on power loss)
// - Add manual override switch for emergency situations
// - Log all valve state changes for audit trail
// - Consider adding physical indicator (LED/buzzer) for valve status
//
// Alert System:
// -------------
// - Connect to physical alarm/buzzer for critical alerts
// - Integrate with smart home systems (Google Home, Alexa)
// - Send SMS/push notifications via Twilio or Firebase Cloud Messaging
// - Consider local siren for immediate attention

class ActionSimulator {
    constructor() {
        this.gasSupplyState = 'ON'; // 'ON' or 'OFF'
        this.eventLog = [];
        this.maxLogEntries = 50;
        this.callbacks = {
            onGasSupplyChange: [],
            onEventLog: []
        };
    }
    
    /**
     * Handle decision state and trigger appropriate actions
     * @param {string} state - Decision state (SAFE, WARNING, CRITICAL)
     * @param {string} explanation - Explanation for the decision
     */
    handleDecision(state, explanation) {
        const timestamp = new Date();
        
        switch (state) {
            case 'CRITICAL':
                this.turnOffGasSupply(timestamp, explanation);
                break;
            case 'SAFE':
                // Only turn on if it was off
                if (this.gasSupplyState === 'OFF') {
                    this.turnOnGasSupply(timestamp, explanation);
                }
                break;
            case 'WARNING':
                // Warning doesn't change gas supply, but log it
                this.logEvent('WARNING', 'Warning detected - monitoring closely', timestamp);
                break;
            default:
                // Do nothing for unknown states
                break;
        }
    }
    
    /**
     * Turn off gas supply
     * @param {Date} timestamp - When the action occurred
     * @param {string} reason - Reason for turning off
     */
    turnOffGasSupply(timestamp, reason) {
        if (this.gasSupplyState === 'OFF') {
            return; // Already off
        }
        
        this.gasSupplyState = 'OFF';
        this.logEvent('GAS_OFF', `Gas supply turned OFF: ${reason}`, timestamp);
        this.notifyCallbacks('onGasSupplyChange', { state: 'OFF', reason, timestamp });
    }
    
    /**
     * Turn on gas supply
     * @param {Date} timestamp - When the action occurred
     * @param {string} reason - Reason for turning on
     */
    turnOnGasSupply(timestamp, reason) {
        if (this.gasSupplyState === 'ON') {
            return; // Already on
        }
        
        this.gasSupplyState = 'ON';
        this.logEvent('GAS_ON', `Gas supply turned ON: ${reason}`, timestamp);
        this.notifyCallbacks('onGasSupplyChange', { state: 'ON', reason, timestamp });
    }
    
    /**
     * Log an event
     * @param {string} type - Event type
     * @param {string} message - Event message
     * @param {Date} timestamp - When the event occurred
     */
    logEvent(type, message, timestamp = new Date()) {
        const event = {
            id: Date.now() + Math.random(),
            type: type,
            message: message,
            timestamp: timestamp,
            formattedTime: this.formatTimestamp(timestamp)
        };
        
        this.eventLog.unshift(event); // Add to beginning
        
        // Keep only last N entries
        if (this.eventLog.length > this.maxLogEntries) {
            this.eventLog.pop();
        }
        
        this.notifyCallbacks('onEventLog', event);
    }
    
    /**
     * Format timestamp for display
     * @param {Date} timestamp - Timestamp to format
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(timestamp) {
        const hours = timestamp.getHours().toString().padStart(2, '0');
        const minutes = timestamp.getMinutes().toString().padStart(2, '0');
        const seconds = timestamp.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Get current gas supply state
     * @returns {string} 'ON' or 'OFF'
     */
    getGasSupplyState() {
        return this.gasSupplyState;
    }
    
    /**
     * Get event log
     * @returns {Array} Array of event objects
     */
    getEventLog() {
        return this.eventLog;
    }
    
    /**
     * Clear event log
     */
    clearEventLog() {
        this.eventLog = [];
        this.logEvent('SYSTEM', 'Event log cleared', new Date());
    }
    
    /**
     * Subscribe to gas supply changes
     * @param {Function} callback - Callback function
     */
    onGasSupplyChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onGasSupplyChange.push(callback);
        }
    }
    
    /**
     * Subscribe to event log updates
     * @param {Function} callback - Callback function
     */
    onEventLog(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onEventLog.push(callback);
        }
    }
    
    /**
     * Unsubscribe from callbacks
     * @param {string} eventType - Event type
     * @param {Function} callback - Callback to remove
     */
    off(eventType, callback) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType] = this.callbacks[eventType].filter(cb => cb !== callback);
        }
    }
    
    /**
     * Notify all callbacks for an event type
     * @param {string} eventType - Event type
     * @param {*} data - Data to pass to callbacks
     */
    notifyCallbacks(eventType, data) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventType} callback:`, error);
                }
            });
        }
    }
}

// Export singleton instance
const actionSimulator = new ActionSimulator();

// Also export class for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ActionSimulator, actionSimulator };
}

