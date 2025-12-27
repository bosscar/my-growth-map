const API_KEY = import.meta?.env?.VITE_GEMINI_API_KEY || "";
if (!API_KEY) {
    console.warn("⚠️ VITE_GEMINI_API_KEY not found in environment. LLM features will be disabled. Run 'npm run dev' locally or set up GitHub Secrets for hosting.");
}
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// Color palette for dynamically created parts
const dynamicColors = [
    '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
    '#5f27cd', '#00d2d3', '#ff6b81', '#7bed9f', '#eccc68',
    '#a29bfe', '#fd79a8', '#00cec9', '#fab1a0', '#81ecec'
];

function getRandomColor() {
    return dynamicColors[Math.floor(Math.random() * dynamicColors.length)];
}

function getRandomPosition() {
    return {
        x: 150 + Math.random() * 700,
        y: 150 + Math.random() * 500
    };
}

export async function analyzeJournalEntry(text, existingParts = []) {
    const existingPartsList = existingParts.join(', ');

    const prompt = `
        Analyze the following journal entry for therapeutic parts (Internal Family Systems style) and personal growth themes.
        
        EXISTING PARTS in the user's map: ${existingPartsList || 'Fear, Shame, Inner Critic, Joy, Growth, Calm, Connection, Anger, Sadness, Courage, Vulnerability, Curiosity'}
        
        Instructions:
        1. Identify which existing parts are active in this entry
        2. If you detect a NEW theme/part not in the existing list (e.g., "Gratitude", "Perfectionism", "Hope", "Protector", "Exile", "Firefighter", "Self-Compassion", "Wisdom", etc.), include it as a new part
        3. For new parts, suggest a color that feels emotionally appropriate
        4. Generate 3-5 emojis that represent the MEANING and CONTENT of what the person wrote (not just the emotions, but the topics/themes/activities mentioned). For example:
           - If they mention work → 💼 or 🏢
           - If they mention family → 👨‍👩‍👧 or 🏠
           - If they mention exercise/body → 🏃 or 💪
           - If they mention nature → 🌳 or 🌅
           - If they mention food → 🍽️
           - If they mention sleep → 😴
           - If they mention music → 🎵
           - If they mention reading/learning → 📚
           - Use creative emojis that capture the story/meaning!
        
        Return ONLY a JSON object with this structure:
        {
          "summary": "one sentence summary",
          "content_emojis": ["💆", "🧘", "✨", "🌿"],
          "parts": [
            { "id": "fear", "strength": 0.8, "reason": "why", "isNew": false },
            { "id": "gratitude", "strength": 0.6, "reason": "expressed thankfulness", "isNew": true, "suggestedColor": "#ffd93d" }
          ],
          "overall_sentiment": "positive/neutral/negative",
          "growth_tip": "a short encouraging prompt based on the content",
          "detected_habits": ["meditation", "exercise"] 
        }

        Entry: "${text}"
    `;

    try {
        console.log("Calling Gemini API with text:", text.substring(0, 50) + "...");
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Response Error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        console.log("API Response received:", data);

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini API");
        }

        const resultText = data.candidates[0].content.parts[0].text;

        // Extract JSON from markdown code blocks if present
        const jsonString = resultText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonString);

        // Process new parts with colors and positions
        result.parts = result.parts.map(part => {
            if (part.isNew) {
                return {
                    ...part,
                    suggestedColor: part.suggestedColor || getRandomColor(),
                    suggestedPosition: getRandomPosition()
                };
            }
            return part;
        });

        return result;
    } catch (error) {
        console.error("LLM Analysis failed:", error);
        // Fallback analysis if API fails
        return {
            summary: "Analysis unavailable, but entry recorded.",
            content_emojis: ["💭", "📝", "✨"],
            parts: [{ id: "growth", strength: 0.1, reason: "Self-expression", isNew: false }],
            overall_sentiment: "neutral",
            growth_tip: "Continue exploring your inner landscape. (Check Console for API error)",
            detected_habits: []
        };
    }
}
