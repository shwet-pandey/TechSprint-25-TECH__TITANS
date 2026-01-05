// Main application entry point
// AI-Enabled Smart Kitchen Safety System
//
// ARCHITECTURE OVERVIEW:
// =====================
// This is a software-first MVP for hackathon demonstration.
// The system is designed to be easily extensible to real hardware.
//
// Current Flow:
// 1. Gas Sensor Simulator → generates fake gas readings
// 2. Decision Engine (Local) → analyzes readings with trend logic
// 3. Gemini AI Service → provides AI-powered analysis (optional)
// 4. Action Simulator → triggers gas valve control (simulated)
// 5. Firebase Service → stores all data for history/analytics
//
// Hardware Integration Path:
// --------------------------
// 1. Replace gasSensorSimulator.js with MQTT/HTTP client
//    - Connect to physical gas sensor (MQ-2, MQ-9)
//    - Receive readings via MQTT broker or REST API
//
// 2. Replace actionSimulator.js gas control with IoT commands
//    - Send commands to smart gas valve via MQTT/HTTP
//    - Control relay module connected to solenoid valve
//
// 3. Add physical alert system
//    - Connect buzzer/alarm to GPIO pins
//    - Integrate with smart home platforms
//
// 4. Enhance with additional sensors
//    - Temperature sensors for context
//    - Motion sensors to detect kitchen activity
//    - Smoke detectors for multi-factor detection
//
// Production Considerations:
// - Add authentication/authorization
// - Implement rate limiting for API calls
// - Add data encryption for sensitive operations
// - Set up monitoring and alerting for system health
// - Consider edge computing for faster response times

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Smart Kitchen Safety System initialized');
    
    // Initialize system status
    const statusElement = document.getElementById('system-status');
    if (statusElement) {
        statusElement.textContent = 'Initializing...';
    }
    
    // Initialize Firebase
    let firebaseServiceInstance = null;
    if (typeof firebaseService !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
        if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
            const initialized = await firebaseService.initialize(FIREBASE_CONFIG);
            if (initialized) {
                firebaseServiceInstance = firebaseService;
                console.log('Firebase connected successfully');
                if (statusElement) {
                    statusElement.textContent = 'Ready (Firebase Connected)';
                }
            } else {
                console.warn('Firebase initialization failed, continuing without Firebase');
                if (statusElement) {
                    statusElement.textContent = 'Ready (Offline Mode)';
                }
            }
        } else {
            console.warn('Firebase config not set, continuing without Firebase');
            if (statusElement) {
                statusElement.textContent = 'Ready (Offline Mode)';
            }
        }
    } else {
        console.warn('Firebase service or config not available');
        if (statusElement) {
            statusElement.textContent = 'Ready';
        }
    }
    
    // Initialize chart manager
    let chartManager = null;
    if (typeof ChartManager !== 'undefined') {
        chartManager = new ChartManager('gasChart');
        console.log('Chart manager initialized');
    } else {
        console.error('ChartManager not loaded');
    }
    
    // Initialize decision engine (fallback)
    let decisionEngineInstance = null;
    if (typeof decisionEngine !== 'undefined') {
        decisionEngineInstance = decisionEngine;
        console.log('Decision engine initialized (fallback)');
    } else {
        console.error('Decision engine not loaded');
    }
    
    // Initialize Gemini AI service
    let geminiServiceInstance = null;
    if (typeof geminiService !== 'undefined' && typeof GEMINI_API_KEY !== 'undefined') {
        const initialized = geminiService.initialize(GEMINI_API_KEY);
        if (initialized) {
            geminiServiceInstance = geminiService;
            console.log('Gemini AI service initialized');
        } else {
            console.log('Gemini AI service not available (using local decision engine)');
        }
    } else {
        console.log('Gemini service or config not available (using local decision engine)');
    }
    
    // Store recent gas values for AI analysis
    let recentGasValues = [];
    const maxRecentValues = 15;
    
    // Initialize action simulator
    let actionSimulatorInstance = null;
    if (typeof actionSimulator !== 'undefined') {
        actionSimulatorInstance = actionSimulator;
        console.log('Action simulator initialized');
        
        // Subscribe to gas supply changes
        actionSimulatorInstance.onGasSupplyChange((data) => {
            updateGasSupplyUI(data.state);
            console.log(`[Action Simulator] Gas supply: ${data.state} - ${data.reason}`);
            
            // Store system state update in Firebase
            if (firebaseServiceInstance) {
                const currentValue = gasSensor ? gasSensor.getValue() : 0;
                // Get current decision state from UI (works for both AI and local decisions)
                const decisionStateElement = document.getElementById('decision-state');
                const currentDecision = decisionStateElement ? decisionStateElement.textContent : 'UNKNOWN';
                const explanationElement = document.getElementById('decision-explanation');
                const currentExplanation = explanationElement ? explanationElement.textContent : '';
                
                firebaseServiceInstance.updateSystemState({
                    decisionState: currentDecision,
                    gasSupplyState: data.state,
                    currentValue: currentValue,
                    explanation: currentExplanation
                });
            }
        });
        
        // Subscribe to event log updates
        actionSimulatorInstance.onEventLog((event) => {
            addEventToLog(event);
            
            // Store event log in Firebase
            if (firebaseServiceInstance) {
                firebaseServiceInstance.storeEventLog(event);
            }
        });
    } else {
        console.error('Action simulator not loaded');
    }
    
    // Initialize gas sensor simulator
    if (typeof gasSensor !== 'undefined') {
        // Subscribe to gas sensor updates
        gasSensor.onUpdate(async (data) => {
            const logMessage = `[Gas Sensor] Mode: ${data.mode} | Value: ${data.value.toFixed(2)} ppm | Time: ${data.timestamp}`;
            console.log(logMessage);
            
            // Store gas reading in Firebase
            if (firebaseServiceInstance) {
                firebaseServiceInstance.storeGasReading({
                    value: data.value,
                    mode: data.mode,
                    timestamp: data.timestamp
                });
            }
            
            // Update chart with new data point
            if (chartManager) {
                chartManager.addDataPoint(data.value);
            }
            
            // Store recent values for AI analysis
            recentGasValues.push(data.value);
            if (recentGasValues.length > maxRecentValues) {
                recentGasValues.shift();
            }
            
            // Analyze with AI (Gemini) or fallback to local decision engine
            let decision = null;
            
            // Try Gemini AI first (if available and enough data)
            if (geminiServiceInstance && recentGasValues.length >= 5) {
                try {
                    decision = await geminiServiceInstance.analyzeGasData(
                        recentGasValues,
                        data.mode,
                        { currentValue: data.value }
                    );
                    
                    if (decision) {
                        console.log(`[Gemini AI] State: ${decision.state} | ${decision.explanation}`);
                    }
                } catch (error) {
                    console.error('[Gemini] Error during analysis:', error);
                    decision = null;
                }
            }
            
            // Fallback to local decision engine if AI failed or unavailable
            if (!decision && decisionEngineInstance) {
                decision = decisionEngineInstance.analyze(data.value);
                decision.source = 'Local Logic';
                console.log(`[Local Decision Engine] State: ${decision.state} | ${decision.explanation}`);
            }
            
            // Update UI with decision
            if (decision) {
                updateDecisionUI(decision);
                
                // Store system state in Firebase
                if (firebaseServiceInstance && actionSimulatorInstance) {
                    firebaseServiceInstance.updateSystemState({
                        decisionState: decision.state,
                        gasSupplyState: actionSimulatorInstance.getGasSupplyState(),
                        currentValue: data.value,
                        explanation: decision.explanation,
                        source: decision.source || 'Local Logic'
                    });
                }
                
                // Trigger actions based on decision
                if (actionSimulatorInstance) {
                    actionSimulatorInstance.handleDecision(decision.state, decision.explanation);
                }
            }
        });
        
        // Start simulation in normal mode
        gasSensor.start('normal');
        
        // Initialize mode controls
        initModeControls();
        
        // Expose gasSensor to window for console testing
        window.gasSensor = gasSensor;
        console.log('\nGas sensor simulator ready!');
    } else {
        console.error('Gas sensor simulator not loaded');
    }
    
    /**
     * Initialize mode control buttons
     */
    function initModeControls() {
        const modeButtons = document.querySelectorAll('.mode-btn');
        const currentModeDisplay = document.getElementById('current-mode-display');
        let lastMode = 'normal';
        
        // Mode display labels
        const modeLabels = {
            'normal': 'Normal Cooking',
            'minorLeak': 'Minor Leak',
            'criticalLeak': 'Critical Leak'
        };
        
        // Update UI to reflect current mode
        function updateModeUI(mode) {
            // Only update if mode actually changed
            if (mode === lastMode) return;
            lastMode = mode;
            
            // Remove active class from all buttons
            modeButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to selected button
            const activeButton = document.getElementById(`mode-${mode}`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
            
            // Update current mode display
            if (currentModeDisplay) {
                currentModeDisplay.textContent = modeLabels[mode] || mode;
            }
        }
        
        // Set initial mode UI
        updateModeUI('normal');
        
        // Add click handlers to mode buttons
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-mode');
                if (mode && gasSensor) {
                    console.log(`\n--- Switching to ${modeLabels[mode]} Mode ---\n`);
                    gasSensor.setMode(mode);
                    updateModeUI(mode);
                    
                    // Reset decision engine when mode changes
                    if (decisionEngineInstance) {
                        decisionEngineInstance.reset();
                        updateDecisionUI({
                            state: 'ANALYZING',
                            explanation: 'Mode changed. Re-analyzing with new data...'
                        });
                    }
                }
            });
        });
        
        // Listen to mode changes from gas sensor
        // This ensures UI stays in sync if mode changes programmatically
        if (gasSensor) {
            // Subscribe to updates to sync UI with actual mode
            gasSensor.onUpdate((data) => {
                if (data.mode && data.mode !== lastMode) {
                    updateModeUI(data.mode);
                }
            });
        }
    }
    
    /**
     * Update decision UI with current state and explanation
     * @param {Object} decision - Decision result from engine or AI
     */
    function updateDecisionUI(decision) {
        const stateElement = document.getElementById('decision-state');
        const explanationElement = document.getElementById('decision-explanation');
        const sourceElement = document.getElementById('decision-source');
        const cardElement = document.getElementById('decision-card');
        
        if (!stateElement || !explanationElement || !cardElement) {
            return;
        }
        
        // Update state text
        stateElement.textContent = decision.state;
        
        // Update explanation
        let explanationText = decision.explanation;
        if (decision.recommendation) {
            explanationText += ` ${decision.recommendation}`;
        }
        explanationElement.textContent = explanationText;
        
        // Update source indicator
        if (sourceElement) {
            if (decision.source === 'AI (Gemini)') {
                sourceElement.textContent = '🤖 AI-Powered Analysis';
                sourceElement.className = 'decision-source source-ai';
            } else {
                sourceElement.textContent = '⚙️ Local Logic';
                sourceElement.className = 'decision-source source-local';
            }
        }
        
        // Update card styling based on state
        cardElement.className = 'decision-card';
        stateElement.className = 'decision-state';
        
        switch (decision.state) {
            case 'SAFE':
                cardElement.classList.add('decision-safe');
                stateElement.classList.add('state-safe');
                break;
            case 'WARNING':
                cardElement.classList.add('decision-warning');
                stateElement.classList.add('state-warning');
                break;
            case 'CRITICAL':
                cardElement.classList.add('decision-critical');
                stateElement.classList.add('state-critical');
                break;
            default:
                cardElement.classList.add('decision-safe');
                stateElement.classList.add('state-safe');
        }
        
        // Show/hide alert overlay for CRITICAL state
        const alertOverlay = document.getElementById('alert-overlay');
        if (alertOverlay) {
            if (decision.state === 'CRITICAL') {
                alertOverlay.classList.add('show');
            } else {
                alertOverlay.classList.remove('show');
            }
        }
    }
    
    /**
     * Update gas supply UI
     * @param {string} state - 'ON' or 'OFF'
     */
    function updateGasSupplyUI(state) {
        const statusIndicator = document.getElementById('gas-status-indicator');
        const statusText = document.getElementById('gas-status-text');
        const statusContainer = document.getElementById('gas-supply-status');
        
        if (!statusIndicator || !statusText || !statusContainer) {
            return;
        }
        
        statusText.textContent = state;
        statusContainer.className = 'gas-supply-status';
        
        if (state === 'ON') {
            statusContainer.classList.add('gas-on');
            statusIndicator.classList.remove('indicator-off');
            statusIndicator.classList.add('indicator-on');
        } else {
            statusContainer.classList.add('gas-off');
            statusIndicator.classList.remove('indicator-on');
            statusIndicator.classList.add('indicator-off');
        }
    }
    
    /**
     * Add event to event log UI
     * @param {Object} event - Event object
     */
    function addEventToLog(event) {
        const logContainer = document.getElementById('event-log-container');
        if (!logContainer) {
            return;
        }
        
        // Remove empty message if present
        const emptyMessage = logContainer.querySelector('.event-log-empty');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        // Create event log entry
        const eventElement = document.createElement('div');
        eventElement.className = 'event-log-entry';
        
        // Add type-specific styling
        if (event.type === 'GAS_OFF') {
            eventElement.classList.add('event-critical');
        } else if (event.type === 'GAS_ON') {
            eventElement.classList.add('event-safe');
        } else if (event.type === 'WARNING') {
            eventElement.classList.add('event-warning');
        }
        
        eventElement.innerHTML = `
            <div class="event-time">${event.formattedTime}</div>
            <div class="event-message">${event.message}</div>
        `;
        
        // Add to top of log
        logContainer.insertBefore(eventElement, logContainer.firstChild);
        
        // Limit visible entries (keep last 20 visible)
        const entries = logContainer.querySelectorAll('.event-log-entry');
        if (entries.length > 20) {
            entries[entries.length - 1].remove();
        }
    }
    
    // Initialize gas supply UI
    if (actionSimulatorInstance) {
        updateGasSupplyUI(actionSimulatorInstance.getGasSupplyState());
    }
    
    // Set up Firebase real-time subscriptions (optional - for multi-device sync)
    if (firebaseServiceInstance) {
        // Subscribe to system state changes (for multi-device sync)
        firebaseServiceInstance.subscribeToSystemState((state) => {
            if (state) {
                console.log('[Firebase] System state updated from cloud:', state);
                // Optionally sync UI with cloud state
                // This allows multiple devices to stay in sync
            }
        });
        
        // Subscribe to event logs (for multi-device sync)
        firebaseServiceInstance.subscribeToEventLogs((events) => {
            console.log('[Firebase] Event logs synced from cloud:', events.length, 'events');
            // Optionally merge cloud events with local events
        });
        
        // Load initial data from Firebase
        loadInitialFirebaseData();
        
        // Load alert history
        loadAlertHistory();
        
        // Set up refresh button
        const refreshBtn = document.getElementById('refresh-history-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadAlertHistory();
            });
        }
        
        // Set up demo controls
        setupDemoControls();
    }
    
    /**
     * Setup demo mode controls
     */
    function setupDemoControls() {
        // Reset data button
        const resetBtn = document.getElementById('reset-data-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to reset all demo data? This will clear Firebase collections.')) {
                    await resetDemoData();
                }
            });
        }
        
        // Demo help modal
        const helpBtn = document.getElementById('demo-help-btn');
        const modal = document.getElementById('demo-modal');
        const closeBtn = document.getElementById('close-modal-btn');
        
        if (helpBtn && modal) {
            helpBtn.addEventListener('click', () => {
                modal.classList.add('show');
            });
        }
        
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }
        
        // Close modal on overlay click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        }
    }
    
    /**
     * Reset demo data in Firebase
     */
    async function resetDemoData() {
        if (!firebaseServiceInstance) {
            alert('Firebase not connected. Cannot reset data.');
            return;
        }
        
        const resetBtn = document.getElementById('reset-data-btn');
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.textContent = '🔄 Resetting...';
        }
        
        try {
            // Get Firebase db instance
            const db = firebaseServiceInstance.getDb();
            
            if (!db) {
                throw new Error('Firebase database not accessible');
            }
            
            // Clear gas readings
            const gasReadings = await firebaseServiceInstance.getRecentGasReadings(1000);
            const deletePromises = gasReadings.map(reading => {
                return db.collection('gasReadings').doc(reading.id).delete();
            });
            await Promise.all(deletePromises);
            console.log('[Reset] Cleared', gasReadings.length, 'gas readings');
            
            // Clear event logs
            const eventLogs = await firebaseServiceInstance.getRecentEventLogs(1000);
            const deleteEventPromises = eventLogs.map(event => {
                return db.collection('eventLogs').doc(event.id).delete();
            });
            await Promise.all(deleteEventPromises);
            console.log('[Reset] Cleared', eventLogs.length, 'event logs');
            
            // Clear system state
            await db.collection('systemState').doc('current').delete();
            console.log('[Reset] Cleared system state');
            
            // Reset local components
            if (decisionEngineInstance) {
                decisionEngineInstance.reset();
            }
            if (actionSimulatorInstance) {
                actionSimulatorInstance.clearEventLog();
            }
            if (chartManager) {
                chartManager.clear();
            }
            
            // Clear UI
            const eventLogContainer = document.getElementById('event-log-container');
            if (eventLogContainer) {
                eventLogContainer.innerHTML = '<div class="event-log-empty">No events yet...</div>';
            }
            
            // Reload alert history
            await loadAlertHistory();
            
            alert('Demo data reset successfully!');
        } catch (error) {
            console.error('[Reset] Error resetting data:', error);
            alert('Error resetting data. Please check console for details.');
        } finally {
            if (resetBtn) {
                resetBtn.disabled = false;
                resetBtn.textContent = '🗑️ Reset Demo Data';
            }
        }
    }
    
    /**
     * Load initial data from Firebase
     */
    async function loadInitialFirebaseData() {
        if (!firebaseServiceInstance) return;
        
        try {
            // Load current system state
            const systemState = await firebaseServiceInstance.getCurrentSystemState();
            if (systemState) {
                console.log('[Firebase] Loaded system state:', systemState);
                // Optionally restore system state from Firebase
            }
            
            // Load recent event logs
            const eventLogs = await firebaseServiceInstance.getRecentEventLogs(10);
            if (eventLogs.length > 0) {
                console.log('[Firebase] Loaded', eventLogs.length, 'recent event logs');
                // Optionally display historical events
            }
        } catch (error) {
            console.error('[Firebase] Error loading initial data:', error);
        }
    }
    
    /**
     * Load and display alert history from Firebase
     */
    async function loadAlertHistory() {
        const tableBody = document.getElementById('history-table-body');
        const historyCount = document.querySelector('.history-count');
        
        if (!tableBody) return;
        
        // Show loading state
        tableBody.innerHTML = '<tr><td colspan="4" class="history-loading">Loading history...</td></tr>';
        if (historyCount) {
            historyCount.textContent = 'Loading...';
        }
        
        if (!firebaseServiceInstance) {
            tableBody.innerHTML = '<tr><td colspan="4" class="history-empty">Firebase not connected. Enable Firebase to view history.</td></tr>';
            if (historyCount) {
                historyCount.textContent = 'Not available';
            }
            return;
        }
        
        try {
            const alerts = await firebaseServiceInstance.getAlertHistory(50);
            
            if (alerts.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="history-empty">No alert history found.</td></tr>';
                if (historyCount) {
                    historyCount.textContent = '0 alerts';
                }
                return;
            }
            
            // Clear table
            tableBody.innerHTML = '';
            
            // Add each alert as a table row
            alerts.forEach((alert) => {
                const row = document.createElement('tr');
                row.className = `history-row history-${alert.decision.toLowerCase()}`;
                
                // Format gas level
                const gasLevel = alert.gasLevel !== null && alert.gasLevel !== undefined
                    ? `${alert.gasLevel.toFixed(2)} ppm`
                    : 'N/A';
                
                // Format decision with badge
                const decisionBadge = getDecisionBadge(alert.decision);
                
                row.innerHTML = `
                    <td class="history-time">${alert.formattedTime}</td>
                    <td class="history-gas">${gasLevel}</td>
                    <td class="history-decision">${decisionBadge}</td>
                    <td class="history-action">${alert.action}</td>
                `;
                
                tableBody.appendChild(row);
            });
            
            if (historyCount) {
                historyCount.textContent = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;
            }
            
            console.log('[Alert History] Loaded', alerts.length, 'alerts');
        } catch (error) {
            console.error('[Alert History] Error loading history:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="history-error">Error loading history. Please try again.</td></tr>';
            if (historyCount) {
                historyCount.textContent = 'Error';
            }
        }
    }
    
    /**
     * Get decision badge HTML
     * @param {string} decision - Decision state
     * @returns {string} Badge HTML
     */
    function getDecisionBadge(decision) {
        const badges = {
            'SAFE': '<span class="decision-badge badge-safe">SAFE</span>',
            'WARNING': '<span class="decision-badge badge-warning">WARNING</span>',
            'CRITICAL': '<span class="decision-badge badge-critical">CRITICAL</span>',
            'UNKNOWN': '<span class="decision-badge badge-unknown">UNKNOWN</span>'
        };
        return badges[decision] || badges['UNKNOWN'];
    }
});

