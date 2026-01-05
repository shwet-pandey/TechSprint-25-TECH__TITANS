// Gemini AI Service
// Handles AI-based decision making using Google Gemini API

class GeminiService {
    constructor() {
        this.apiKey = null;
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        this.initialized = false;
        this.lastRequestTime = 0;
        this.requestDelay = 2000; // Minimum 2 seconds between requests to avoid rate limits
    }
    
    /**
     * Initialize Gemini service with API key
     * @param {string} apiKey - Google Gemini API key
     */
    initialize(apiKey) {
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
            console.warn('Gemini API key not provided, AI features disabled');
            this.initialized = false;
            return false;
        }
        
        this.apiKey = apiKey;
        this.initialized = true;
        console.log('Gemini service initialized');
        return true;
    }
    
    /**
     * Check if Gemini is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized && this.apiKey !== null;
    }
    
    /**
     * Analyze gas data using Gemini AI
     * @param {Array<number>} recentValues - Array of recent gas concentration values
     * @param {string} currentMode - Current simulation mode
     * @param {Object} context - Additional context (optional)
     * @returns {Promise<Object|null>} Decision object or null if failed
     */
    async analyzeGasData(recentValues, currentMode, context = {}) {
        if (!this.isInitialized()) {
            return null;
        }
        
        // Rate limiting - don't make requests too frequently
        const now = Date.now();
        if (now - this.lastRequestTime < this.requestDelay) {
            console.log('[Gemini] Rate limiting - skipping request');
            return null;
        }
        this.lastRequestTime = now;
        
        try {
            // Prepare prompt for Gemini
            const prompt = this.buildPrompt(recentValues, currentMode, context);
            
            // Make API request
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Gemini] API error:', response.status, errorData);
                return null;
            }
            
            const data = await response.json();
            const decision = this.parseGeminiResponse(data);
            
            if (decision) {
                console.log('[Gemini] AI decision received:', decision.state);
                return decision;
            }
            
            return null;
        } catch (error) {
            console.error('[Gemini] Error analyzing gas data:', error);
            return null;
        }
    }
    
    /**
     * Build prompt for Gemini
     * @param {Array<number>} recentValues - Recent gas values
     * @param {string} currentMode - Current mode
     * @param {Object} context - Additional context
     * @returns {string} Prompt text
     */
    buildPrompt(recentValues, currentMode, context) {
        const avgValue = recentValues.length > 0 
            ? recentValues.reduce((a, b) => a + b, 0) / recentValues.length 
            : 0;
        const maxValue = recentValues.length > 0 ? Math.max(...recentValues) : 0;
        const minValue = recentValues.length > 0 ? Math.min(...recentValues) : 0;
        const trend = this.calculateTrend(recentValues);
        
        return `You are an AI safety system analyzing gas leak detection data for a smart kitchen safety system.

Recent gas concentration readings (in ppm - parts per million):
${recentValues.slice(-10).map((v, i) => `Reading ${i + 1}: ${v.toFixed(2)} ppm`).join('\n')}

Statistics:
- Current value: ${recentValues[recentValues.length - 1]?.toFixed(2) || 0} ppm
- Average (last 10): ${avgValue.toFixed(2)} ppm
- Maximum: ${maxValue.toFixed(2)} ppm
- Minimum: ${minValue.toFixed(2)} ppm
- Trend: ${trend}
- Simulation mode: ${currentMode}

Safety thresholds:
- Safe: 0-50 ppm (normal cooking)
- Warning: 50-200 ppm (potential leak)
- Critical: 200+ ppm (dangerous leak)

Analyze this data and provide a safety assessment. Respond ONLY with a JSON object in this exact format:
{
  "state": "SAFE" or "WARNING" or "CRITICAL",
  "explanation": "A clear, concise explanation of your assessment (2-3 sentences)",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "recommendation": "A brief recommendation for action"
}

Consider:
1. Current gas concentration level
2. Trend (rising, falling, stable)
3. Volatility and patterns
4. Proximity to safety thresholds
5. Rate of change

Respond with ONLY the JSON object, no additional text.`;
    }
    
    /**
     * Calculate trend from values
     * @param {Array<number>} values - Array of values
     * @returns {string} Trend description
     */
    calculateTrend(values) {
        if (values.length < 3) return 'insufficient data';
        
        const recent = values.slice(-3);
        const older = values.slice(-5, -3);
        
        if (older.length === 0) return 'stable';
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        const diff = recentAvg - olderAvg;
        if (diff > 5) return 'rising';
        if (diff < -5) return 'falling';
        return 'stable';
    }
    
    /**
     * Parse Gemini API response
     * @param {Object} data - API response data
     * @returns {Object|null} Parsed decision or null
     */
    parseGeminiResponse(data) {
        try {
            // Extract text from response
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.error('[Gemini] No text in response');
                return null;
            }
            
            // Try to extract JSON from response (might have markdown code blocks)
            let jsonText = text.trim();
            
            // Remove markdown code blocks if present
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Try to find JSON object in the text
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            
            // Parse JSON
            const parsed = JSON.parse(jsonText);
            
            // Validate and normalize response
            const decision = {
                state: this.normalizeState(parsed.state),
                explanation: parsed.explanation || 'AI analysis completed',
                confidence: parsed.confidence || 'MEDIUM',
                recommendation: parsed.recommendation || '',
                source: 'AI (Gemini)'
            };
            
            // Validate state
            if (!['SAFE', 'WARNING', 'CRITICAL'].includes(decision.state)) {
                console.error('[Gemini] Invalid state in response:', decision.state);
                return null;
            }
            
            return decision;
        } catch (error) {
            console.error('[Gemini] Error parsing response:', error);
            console.log('[Gemini] Raw response:', data);
            return null;
        }
    }
    
    /**
     * Normalize state string
     * @param {string} state - State string from AI
     * @returns {string} Normalized state
     */
    normalizeState(state) {
        if (!state) return 'SAFE';
        
        const upper = state.toUpperCase().trim();
        if (upper.includes('CRITICAL') || upper.includes('DANGER') || upper.includes('EMERGENCY')) {
            return 'CRITICAL';
        }
        if (upper.includes('WARNING') || upper.includes('CAUTION') || upper.includes('ALERT')) {
            return 'WARNING';
        }
        return 'SAFE';
    }
}

// Export singleton instance
const geminiService = new GeminiService();

// Also export class for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeminiService, geminiService };
}

