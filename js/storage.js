const STORAGE_KEY = 'growth_map_data';

const defaultRegions = {
    'fear': { id: 'fear', name: 'Fear', color: '#ff3e3e', size: 55, x: 280, y: 200, intensity: 0.5 },
    'shame': { id: 'shame', name: 'Shame', color: '#b056da', size: 45, x: 320, y: 420, intensity: 0.4 },
    'critic': { id: 'critic', name: 'Inner Critic', color: '#6a6a6a', size: 50, x: 120, y: 350, intensity: 0.5 },
    'joy': { id: 'joy', name: 'Joy', color: '#ffcc00', size: 100, x: 480, y: 280, intensity: 0.8 },
    'growth': { id: 'growth', name: 'Growth', color: '#00ff88', size: 85, x: 680, y: 450, intensity: 0.7 },
    'calm': { id: 'calm', name: 'Calm', color: '#00d2ff', size: 70, x: 520, y: 580, intensity: 0.6 },
    'connection': { id: 'connection', name: 'Connection', color: '#ff7e33', size: 60, x: 720, y: 220, intensity: 0.5 },
    'anger': { id: 'anger', name: 'Anger', color: '#ff4b2b', size: 40, x: 100, y: 180, intensity: 0.3 },
    'sadness': { id: 'sadness', name: 'Sadness', color: '#64748b', size: 40, x: 820, y: 550, intensity: 0.3 },
    'courage': { id: 'courage', name: 'Courage', color: '#f9d423', size: 50, x: 560, y: 130, intensity: 0.4 },
    'vulnerability': { id: 'vulnerability', name: 'Vulnerability', color: '#ff75c3', size: 50, x: 380, y: 130, intensity: 0.4 },
    'curiosity': { id: 'curiosity', name: 'Curiosity', color: '#00f2fe', size: 55, x: 780, y: 380, intensity: 0.5 }
};

const defaultHabits = [
    { id: 'journal', name: 'Daily Journal', icon: '📝', streak: 0, lastCompleted: null, color: '#00d2ff' },
    { id: 'meditation', name: 'Meditation', icon: '🧘', streak: 0, lastCompleted: null, color: '#b056da' },
    { id: 'exercise', name: 'Exercise', icon: '💪', streak: 0, lastCompleted: null, color: '#00ff88' },
    { id: 'gratitude', name: 'Gratitude', icon: '🙏', streak: 0, lastCompleted: null, color: '#ffcc00' },
    { id: 'sleep', name: 'Good Sleep', icon: '😴', streak: 0, lastCompleted: null, color: '#64748b' }
];

const defaultData = {
    entries: [],
    regions: defaultRegions,
    habits: defaultHabits,
    reminders: {
        enabled: false,
        journalTime: '09:00',
        eveningTime: '21:00'
    },
    stats: {
        score: 45,
        daysTraveled: 1,
        lastActive: new Date().toISOString(),
        totalEntries: 0
    }
};

export const AppStorage = {
    save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            this.save(defaultData);
            return JSON.parse(JSON.stringify(defaultData));
        }
        const data = JSON.parse(saved);

        // Migrate old data: add habits if missing
        if (!data.habits) {
            data.habits = defaultHabits;
        }
        if (!data.reminders) {
            data.reminders = defaultData.reminders;
        }

        return data;
    },

    addEntry(entry) {
        const data = this.load();
        data.entries.unshift(entry);
        data.stats.totalEntries++;

        // Update regions based on entry analysis
        entry.analysis.parts.forEach(part => {
            const regionId = part.id.toLowerCase().replace(/\s+/g, '-');

            // Check if this is a NEW part that doesn't exist yet
            if (part.isNew && !data.regions[regionId]) {
                console.log(`Creating new region: ${part.id}`);
                data.regions[regionId] = {
                    id: regionId,
                    name: part.id.charAt(0).toUpperCase() + part.id.slice(1),
                    color: part.suggestedColor || '#' + Math.floor(Math.random() * 16777215).toString(16),
                    size: 40,
                    x: part.suggestedPosition?.x || (150 + Math.random() * 700),
                    y: part.suggestedPosition?.y || (150 + Math.random() * 500),
                    intensity: 0.3,
                    createdAt: new Date().toISOString()
                };
            }

            // Now update the region (existing or newly created)
            if (data.regions[regionId]) {
                data.regions[regionId].size += part.strength * 15;
                data.regions[regionId].intensity = Math.min(1, data.regions[regionId].intensity + 0.1);
            }
        });

        // Auto-complete journal habit
        this.completeHabit('journal', data);

        // Update global score
        const positiveParts = ['joy', 'growth', 'calm', 'courage', 'connection', 'curiosity', 'gratitude', 'hope', 'self-compassion', 'wisdom'];
        const positiveCount = entry.analysis.parts.filter(p => positiveParts.includes(p.id.toLowerCase())).length;
        data.stats.score = Math.min(100, data.stats.score + (positiveCount * 3));

        // Update days traveled
        const lastActive = new Date(data.stats.lastActive);
        const today = new Date();
        if (lastActive.toDateString() !== today.toDateString()) {
            data.stats.daysTraveled++;
            data.stats.lastActive = today.toISOString();
        }

        this.save(data);
        return data;
    },

    // Habit tracking methods
    completeHabit(habitId, dataOverride = null) {
        const data = dataOverride || this.load();
        const habit = data.habits.find(h => h.id === habitId);

        if (habit) {
            const today = new Date().toDateString();
            const lastCompleted = habit.lastCompleted ? new Date(habit.lastCompleted).toDateString() : null;

            if (lastCompleted !== today) {
                // Check if streak continues (completed yesterday)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (lastCompleted === yesterday.toDateString()) {
                    habit.streak++;
                } else if (lastCompleted !== today) {
                    habit.streak = 1; // Reset streak
                }

                habit.lastCompleted = new Date().toISOString();
            }
        }

        if (!dataOverride) {
            this.save(data);
        }
        return data;
    },

    addHabit(name, icon = '✨', color = '#00d2ff') {
        const data = this.load();
        const id = name.toLowerCase().replace(/\s+/g, '-');

        if (!data.habits.find(h => h.id === id)) {
            data.habits.push({
                id,
                name,
                icon,
                streak: 0,
                lastCompleted: null,
                color
            });
            this.save(data);
        }
        return data;
    },

    removeHabit(habitId) {
        const data = this.load();
        data.habits = data.habits.filter(h => h.id !== habitId);
        this.save(data);
        return data;
    },

    // Reminder methods
    setReminders(enabled, journalTime = '09:00', eveningTime = '21:00') {
        const data = this.load();
        data.reminders = { enabled, journalTime, eveningTime };
        this.save(data);
        return data;
    },

    getRegions() {
        return this.load().regions;
    },

    getEntries() {
        return this.load().entries;
    },

    getHabits() {
        return this.load().habits;
    },

    getExistingPartNames() {
        const data = this.load();
        return Object.values(data.regions).map(r => r.name);
    }
};
