// Firebase Service
// Handles all Firebase operations for the Smart Kitchen Safety System

class FirebaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.config = null;
    }
    
    /**
     * Initialize Firebase with configuration
     * @param {Object} config - Firebase configuration object
     */
    async initialize(config) {
        if (!config || !config.apiKey) {
            console.error('Firebase configuration is required');
            return false;
        }
        
        this.config = config;
        
        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }
            
            // Initialize Firestore
            this.db = firebase.firestore();
            this.initialized = true;
            
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            this.initialized = false;
            return false;
        }
    }
    
    /**
     * Check if Firebase is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized && this.db !== null;
    }
    
    /**
     * Get Firestore database instance (for reset operations)
     * @returns {Object} Firestore database instance
     */
    getDb() {
        return this.db;
    }
    
    /**
     * Store a gas reading
     * @param {Object} reading - Gas reading data
     * @returns {Promise<string>} Document ID
     */
    async storeGasReading(reading) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized, skipping gas reading storage');
            return null;
        }
        
        try {
            const docRef = await this.db.collection('gasReadings').add({
                value: reading.value,
                mode: reading.mode,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                localTimestamp: reading.timestamp || new Date().toISOString()
            });
            
            return docRef.id;
        } catch (error) {
            console.error('Error storing gas reading:', error);
            return null;
        }
    }
    
    /**
     * Store system state update
     * @param {Object} state - System state data
     * @returns {Promise<void>}
     */
    async updateSystemState(state) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized, skipping system state update');
            return;
        }
        
        try {
            await this.db.collection('systemState').doc('current').set({
                decisionState: state.decisionState,
                gasSupplyState: state.gasSupplyState,
                currentValue: state.currentValue,
                explanation: state.explanation,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                localTimestamp: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error updating system state:', error);
        }
    }
    
    /**
     * Store event log entry
     * @param {Object} event - Event data
     * @returns {Promise<string>} Document ID
     */
    async storeEventLog(event) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized, skipping event log storage');
            return null;
        }
        
        try {
            const docRef = await this.db.collection('eventLogs').add({
                type: event.type,
                message: event.message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                localTimestamp: event.timestamp || new Date().toISOString(),
                formattedTime: event.formattedTime
            });
            
            return docRef.id;
        } catch (error) {
            console.error('Error storing event log:', error);
            return null;
        }
    }
    
    /**
     * Subscribe to real-time gas readings
     * @param {Function} callback - Callback function
     * @param {number} limit - Number of recent readings to fetch (default: 10)
     * @returns {Function} Unsubscribe function
     */
    subscribeToGasReadings(callback, limit = 10) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized');
            return () => {};
        }
        
        return this.db.collection('gasReadings')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .onSnapshot((snapshot) => {
                const readings = [];
                snapshot.forEach((doc) => {
                    readings.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(readings);
            }, (error) => {
                console.error('Error subscribing to gas readings:', error);
            });
    }
    
    /**
     * Subscribe to real-time system state
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToSystemState(callback) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized');
            return () => {};
        }
        
        return this.db.collection('systemState').doc('current')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    callback({
                        id: doc.id,
                        ...doc.data()
                    });
                } else {
                    callback(null);
                }
            }, (error) => {
                console.error('Error subscribing to system state:', error);
            });
    }
    
    /**
     * Subscribe to real-time event logs
     * @param {Function} callback - Callback function
     * @param {number} limit - Number of recent events to fetch (default: 20)
     * @returns {Function} Unsubscribe function
     */
    subscribeToEventLogs(callback, limit = 20) {
        if (!this.isInitialized()) {
            console.warn('Firebase not initialized');
            return () => {};
        }
        
        return this.db.collection('eventLogs')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .onSnapshot((snapshot) => {
                const events = [];
                snapshot.forEach((doc) => {
                    events.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(events);
            }, (error) => {
                console.error('Error subscribing to event logs:', error);
            });
    }
    
    /**
     * Get recent gas readings
     * @param {number} limit - Number of readings to fetch
     * @returns {Promise<Array>}
     */
    async getRecentGasReadings(limit = 10) {
        if (!this.isInitialized()) {
            return [];
        }
        
        try {
            const snapshot = await this.db.collection('gasReadings')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const readings = [];
            snapshot.forEach((doc) => {
                readings.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return readings;
        } catch (error) {
            console.error('Error getting recent gas readings:', error);
            return [];
        }
    }
    
    /**
     * Get current system state
     * @returns {Promise<Object|null>}
     */
    async getCurrentSystemState() {
        if (!this.isInitialized()) {
            return null;
        }
        
        try {
            const doc = await this.db.collection('systemState').doc('current').get();
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting current system state:', error);
            return null;
        }
    }
    
    /**
     * Get recent event logs
     * @param {number} limit - Number of events to fetch
     * @returns {Promise<Array>}
     */
    async getRecentEventLogs(limit = 20) {
        if (!this.isInitialized()) {
            return [];
        }
        
        try {
            const snapshot = await this.db.collection('eventLogs')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const events = [];
            snapshot.forEach((doc) => {
                events.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return events;
        } catch (error) {
            console.error('Error getting recent event logs:', error);
            return [];
        }
    }
    
    /**
     * Get alert history combining event logs with gas readings and system state
     * @param {number} limit - Number of alerts to fetch
     * @returns {Promise<Array>} Array of alert history entries
     */
    async getAlertHistory(limit = 50) {
        if (!this.isInitialized()) {
            return [];
        }
        
        try {
            // Get significant events (GAS_OFF, GAS_ON, WARNING)
            const eventSnapshot = await this.db.collection('eventLogs')
                .where('type', 'in', ['GAS_OFF', 'GAS_ON', 'WARNING'])
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const alerts = [];
            const eventPromises = [];
            
            eventSnapshot.forEach((doc) => {
                const event = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // For each event, try to find corresponding gas reading and system state
                const eventTime = event.timestamp?.toDate() || new Date(event.localTimestamp);
                
                // Get gas reading around the event time (within 10 seconds)
                // Use a simpler approach: get the closest reading by timestamp
                const gasReadingPromise = this.db.collection('gasReadings')
                    .orderBy('timestamp', 'desc')
                    .limit(20)
                    .get()
                    .then((snapshot) => {
                        if (snapshot.empty) return null;
                        
                        // Find the closest reading to event time
                        let closestReading = null;
                        let minDiff = Infinity;
                        
                        snapshot.forEach((doc) => {
                            const reading = doc.data();
                            const readingTime = reading.timestamp?.toDate() || new Date(reading.localTimestamp);
                            const diff = Math.abs(readingTime.getTime() - eventTime.getTime());
                            
                            // If within 10 seconds, consider it
                            if (diff < 10000 && diff < minDiff) {
                                minDiff = diff;
                                closestReading = reading.value;
                            }
                        });
                        
                        return closestReading;
                    })
                    .catch((error) => {
                        console.warn('[Firebase] Could not fetch gas reading for event:', error);
                        return null;
                    });
                
                eventPromises.push(
                    gasReadingPromise.then((gasValue) => {
                        alerts.push({
                            timestamp: event.timestamp?.toDate() || new Date(event.localTimestamp),
                            formattedTime: event.formattedTime || this.formatTimestamp(eventTime),
                            gasLevel: gasValue,
                            decision: this.extractDecisionFromEvent(event),
                            action: this.formatAction(event.type, event.message),
                            eventType: event.type
                        });
                    })
                );
            });
            
            await Promise.all(eventPromises);
            
            // Sort by timestamp (newest first)
            alerts.sort((a, b) => b.timestamp - a.timestamp);
            
            return alerts;
        } catch (error) {
            console.error('Error getting alert history:', error);
            return [];
        }
    }
    
    /**
     * Extract decision state from event message
     * @param {Object} event - Event object
     * @returns {string} Decision state
     */
    extractDecisionFromEvent(event) {
        const message = event.message || '';
        if (message.includes('CRITICAL') || event.type === 'GAS_OFF') {
            return 'CRITICAL';
        }
        if (message.includes('WARNING') || event.type === 'WARNING') {
            return 'WARNING';
        }
        if (message.includes('SAFE') || event.type === 'GAS_ON') {
            return 'SAFE';
        }
        return 'UNKNOWN';
    }
    
    /**
     * Format action text
     * @param {string} type - Event type
     * @param {string} message - Event message
     * @returns {string} Formatted action
     */
    formatAction(type, message) {
        if (type === 'GAS_OFF') {
            return 'Gas Supply Turned OFF';
        }
        if (type === 'GAS_ON') {
            return 'Gas Supply Turned ON';
        }
        if (type === 'WARNING') {
            return 'Warning Issued';
        }
        return message || 'No action';
    }
    
    /**
     * Format timestamp for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(date) {
        const d = date instanceof Date ? date : new Date(date);
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Clear old gas readings (keep last N)
     * @param {number} keepCount - Number of readings to keep
     * @returns {Promise<void>}
     */
    async clearOldGasReadings(keepCount = 100) {
        if (!this.isInitialized()) {
            return;
        }
        
        try {
            const snapshot = await this.db.collection('gasReadings')
                .orderBy('timestamp', 'desc')
                .get();
            
            const toDelete = [];
            snapshot.forEach((doc, index) => {
                if (index >= keepCount) {
                    toDelete.push(doc.ref.delete());
                }
            });
            
            await Promise.all(toDelete);
            console.log(`Cleared ${toDelete.length} old gas readings`);
        } catch (error) {
            console.error('Error clearing old gas readings:', error);
        }
    }
}

// Export singleton instance
const firebaseService = new FirebaseService();

// Also export class for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FirebaseService, firebaseService };
}

