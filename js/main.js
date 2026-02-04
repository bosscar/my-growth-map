import { analyzeJournalEntry, transcribeJournalImage } from './llm-analyzer.js';
import { renderMap } from './map.js';
import { AppStorage } from './storage.js';

// --- State ---
let isRecording = false;
let recognition = null;
let currentTranscript = "";
let data = AppStorage.load();

const prompts = [
    "How are you feeling in your body right now?",
    "What's one thing your Inner Critic has been saying today?",
    "Where in your life did you feel a sense of Growth today?",
    "Is there a small Joy you might have overlooked?",
    "What does your Fear want to protect you from today?",
    "How does it feel to be seen and heard in this space?",
    "Describe a moment where you felt Calm or at peace.",
    "Which 'part' of you needs the most love right now?",
    "If your Anger had a voice, what would it be shouting?",
    "Think of a moment you felt Connected to someone or something.",
    "What are you grateful for today?",
    "What habit would support your growth right now?",
    "How did you practice self-compassion today?",
    "What's a small win you can celebrate?"
];

// --- initialization ---
function init() {
    setupRecognition();
    setupEventListeners();
    setupSettingsLogic();
    setupReminders();
    refreshUI();
    setNewPrompt();
}

function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                currentTranscript += event.results[i][0].transcript + " ";
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        document.getElementById('transcription-preview').innerHTML =
            `<strong>${currentTranscript}</strong> <span style="opacity: 0.5">${interimTranscript}</span>`;

        if (currentTranscript.length > 10) {
            updateButtonVisibility();
            // Update the edit textarea if it's visible
            const edit = document.getElementById('transcription-edit');
            if (edit && edit.style.display !== 'none') {
                edit.value = currentTranscript;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        stopRecording();
        document.getElementById('record-status').textContent = "Error: " + event.error + ". Try again.";
    };
}

function setupEventListeners() {
    const micBtn = document.getElementById('mic-btn');
    const scanBtn = document.getElementById('scan-btn');
    const imageInput = document.getElementById('journal-image-input');
    const saveBtn = document.getElementById('save-entry');
    const retryBtn = document.getElementById('retry-entry');
    const clearBtn = document.getElementById('clear-entry');
    const newPromptBtn = document.getElementById('new-prompt');
    const transcriptionPreview = document.getElementById('transcription-preview');
    const transcriptionEdit = document.getElementById('transcription-edit');

    micBtn.addEventListener('click', toggleRecording);

    if (scanBtn && imageInput) {
        scanBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', handleImageScan);
    }

    saveBtn.addEventListener('click', processEntry);
    newPromptBtn.addEventListener('click', setNewPrompt);

    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            retryBtn.style.display = 'none';
            processEntry();
        });
    }

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', clearTranscription);
    }

    // Click to edit - switch to textarea
    if (transcriptionPreview) {
        transcriptionPreview.addEventListener('click', () => {
            switchToEditMode();
        });
    }

    // Sync textarea back to currentTranscript
    if (transcriptionEdit) {
        transcriptionEdit.addEventListener('input', () => {
            currentTranscript = transcriptionEdit.value;
            updateButtonVisibility();
        });

        transcriptionEdit.addEventListener('blur', () => {
            // Keep edit mode if there's content
            if (!currentTranscript.trim()) {
                switchToPreviewMode();
            }
        });
    }
}

async function handleImageScan(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('record-status');
    const previewEl = document.getElementById('transcription-preview');
    const originalStatus = (statusEl && statusEl.textContent) || "Tap to dictate or scan";

    try {
        if (statusEl) statusEl.textContent = "⌛ Reading image...";
        if (previewEl) previewEl.innerHTML = "<em>Capturing your handwriting...</em>";

        // Convert to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;

        if (statusEl) statusEl.textContent = "✨ Transcribing with AI...";
        const transcribedText = await transcribeJournalImage(base64Data, file.type);

        if (transcribedText) {
            currentTranscript = transcribedText;
            switchToEditMode();
            updateButtonVisibility();
            if (statusEl) statusEl.textContent = "✅ Scan complete!";

            // Clear input so same file can be scanned again if needed
            event.target.value = '';
        } else {
            throw new Error("No text found in image");
        }

    } catch (error) {
        console.error("Scan failed:", error);
        if (statusEl) statusEl.textContent = "❌ Scan failed. Try a clearer photo.";
        if (previewEl) previewEl.innerHTML = "Your words will appear here...";
    } finally {
        setTimeout(() => {
            if (statusEl && (statusEl.textContent.includes("✅") || statusEl.textContent.includes("❌"))) {
                statusEl.textContent = originalStatus;
            }
        }, 3000);
    }
}

function switchToEditMode() {
    const preview = document.getElementById('transcription-preview');
    const edit = document.getElementById('transcription-edit');
    const hint = document.getElementById('transcription-hint');

    if (preview && edit) {
        preview.style.display = 'none';
        edit.style.display = 'block';
        edit.value = currentTranscript;
        edit.focus();
        if (hint) hint.style.display = 'none';
    }
}

function switchToPreviewMode() {
    const preview = document.getElementById('transcription-preview');
    const edit = document.getElementById('transcription-edit');
    const hint = document.getElementById('transcription-hint');

    if (preview && edit) {
        edit.style.display = 'none';
        preview.style.display = 'block';
        preview.innerHTML = currentTranscript || 'Your words will appear here...';
        if (hint) hint.style.display = 'block';
    }
}

function updateButtonVisibility() {
    const saveBtn = document.getElementById('save-entry');
    const clearBtn = document.getElementById('clear-entry');

    if (currentTranscript.trim().length > 5) {
        if (saveBtn) saveBtn.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'block';
    } else {
        if (saveBtn) saveBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function clearTranscription() {
    currentTranscript = '';
    const preview = document.getElementById('transcription-preview');
    const edit = document.getElementById('transcription-edit');
    const saveBtn = document.getElementById('save-entry');
    const retryBtn = document.getElementById('retry-entry');
    const clearBtn = document.getElementById('clear-entry');

    if (preview) preview.innerHTML = 'Your words will appear here...';
    if (edit) edit.value = '';
    if (saveBtn) {
        saveBtn.style.display = 'none';
        saveBtn.textContent = 'Process Entry';
        saveBtn.disabled = false;
    }
    if (retryBtn) retryBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';

    switchToPreviewMode();
}

function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function startRecording() {
    if (!recognition) return;
    isRecording = true;
    recognition.start();
    document.getElementById('mic-btn').classList.add('recording');
    document.getElementById('record-status').textContent = "Listening... Tap to stop";
}

function stopRecording() {
    if (!recognition) return;
    isRecording = false;
    recognition.stop();
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('record-status').textContent = "Paused. Tap to continue";
}

async function processEntry() {
    if (currentTranscript.trim().length < 5) return;

    const saveBtn = document.getElementById('save-entry');
    saveBtn.textContent = "Analyzing Landscape...";
    saveBtn.disabled = true;

    try {
        // Pass existing part names to help LLM identify new ones
        const existingParts = AppStorage.getExistingPartNames();
        const analysis = await analyzeJournalEntry(currentTranscript, existingParts);

        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            text: currentTranscript,
            analysis: analysis
        };

        data = AppStorage.addEntry(entry);

        // Clear UI
        clearTranscription();

        // Show notification for new parts
        const newParts = analysis.parts.filter(p => p.isNew);
        if (newParts.length > 0) {
            showNewPartNotification(newParts);
        }

        refreshUI();
        setNewPrompt();

    } catch (error) {
        console.error("Failed to process entry:", error);
        const saveBtn = document.getElementById('save-entry');
        const retryBtn = document.getElementById('retry-entry');

        saveBtn.textContent = "Error occurred";
        saveBtn.style.background = 'rgba(255, 62, 62, 0.2)';
        saveBtn.disabled = true;

        if (retryBtn) {
            retryBtn.style.display = 'block';
        }
        saveBtn.disabled = false;
    }
}

function showNewPartNotification(newParts) {
    const names = newParts.map(p => p.id).join(', ');
    const notification = document.createElement('div');
    notification.className = 'new-part-notification';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">✨</span>
            <div>
                <strong>New part discovered!</strong>
                <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">${names} has been added to your map</p>
            </div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
}

function refreshUI() {
    renderMap(data.regions, data.entries);
    renderEntries();
    renderHabits();
    updateStats();
}

function renderEntries() {
    const list = document.getElementById('entries-list');
    list.innerHTML = '';

    // Sentiment to emoji mapping
    const sentimentEmojis = {
        'positive': '😊',
        'negative': '😔',
        'neutral': '😐'
    };

    // Part category emojis
    const partEmojis = {
        'joy': '☀️', 'fear': '😨', 'anger': '🔥', 'sadness': '💧',
        'growth': '🌱', 'calm': '🌊', 'connection': '🤝', 'shame': '😶',
        'courage': '🦁', 'vulnerability': '💗', 'curiosity': '🔍',
        'critic': '👁️', 'gratitude': '🙏', 'hope': '✨', 'default': '💭'
    };

    data.entries.slice(0, 10).forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card entry-collapsed';
        card.setAttribute('data-entry-id', entry.id);

        const primaryPart = entry.analysis.parts[0];
        let primaryColor = 'var(--clr-calm)';
        let primaryEmoji = partEmojis['default'];

        if (primaryPart) {
            const regionId = primaryPart.id.toLowerCase().replace(/\s+/g, '-');
            primaryColor = data.regions[regionId]?.color || primaryColor;
            primaryEmoji = partEmojis[regionId] || partEmojis['default'];
        }

        card.style.borderLeftColor = primaryColor;

        const date = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sentimentEmoji = sentimentEmojis[entry.analysis.overall_sentiment] || '😐';

        // Use content emojis from LLM analysis (these represent the actual meaning/content)
        // Fall back to part-based emojis if content_emojis not available
        let emojiStrip;
        if (entry.analysis.content_emojis && entry.analysis.content_emojis.length > 0) {
            emojiStrip = entry.analysis.content_emojis.join(' ');
        } else {
            // Fallback: create visual emoji strip from parts
            emojiStrip = entry.analysis.parts.slice(0, 4).map(p => {
                const pid = p.id.toLowerCase().replace(/\s+/g, '-');
                return partEmojis[pid] || '💭';
            }).join(' ');
        }

        card.innerHTML = `
            <div class="entry-collapsed-view">
                <div class="entry-meta">
                    <span>${date}</span>
                    <span class="entry-sentiment">${sentimentEmoji} ${entry.analysis.overall_sentiment}</span>
                </div>
                <div class="entry-emoji-strip" style="font-size: 1.5rem; margin: 8px 0;">
                    ${emojiStrip}
                </div>
                <div class="entry-tags">
                    ${entry.analysis.parts.map(p => {
            const regionId = p.id.toLowerCase().replace(/\s+/g, '-');
            const color = data.regions[regionId]?.color || '#888';
            const isNew = p.isNew ? ' ✨' : '';
            return `<span class="tag" style="color:${color}">${p.id}${isNew}</span>`;
        }).join('')}
                </div>
                <div class="entry-expand-hint">tap to read</div>
            </div>
            <div class="entry-expanded-view" style="display: none;">
                <div class="entry-meta">
                    <span>${date}</span>
                    <button class="entry-close-btn">✕</button>
                </div>
                <div class="entry-flashcard">
                    <p class="entry-full-text">${entry.text}</p>
                </div>
                <div class="entry-summary" style="margin-top: 10px; font-size: 0.8rem; color: var(--clr-joy);">
                    💡 ${entry.analysis.growth_tip || entry.analysis.summary}
                </div>
                <div class="entry-tags" style="margin-top: 10px;">
                    ${entry.analysis.parts.map(p => {
            const regionId = p.id.toLowerCase().replace(/\s+/g, '-');
            const color = data.regions[regionId]?.color || '#888';
            return `<span class="tag" style="color:${color}">${p.id}</span>`;
        }).join('')}
                </div>
            </div>
        `;

        // Click to expand/collapse
        const collapsedView = card.querySelector('.entry-collapsed-view');
        const expandedView = card.querySelector('.entry-expanded-view');
        const closeBtn = card.querySelector('.entry-close-btn');

        collapsedView.onclick = () => {
            collapsedView.style.display = 'none';
            expandedView.style.display = 'block';
            card.classList.remove('entry-collapsed');
            card.classList.add('entry-expanded');
        };

        closeBtn.onclick = (e) => {
            e.stopPropagation();
            expandedView.style.display = 'none';
            collapsedView.style.display = 'block';
            card.classList.add('entry-collapsed');
            card.classList.remove('entry-expanded');
        };

        list.appendChild(card);
    });
}

function renderHabits() {
    const container = document.getElementById('habits-container');
    if (!container) return;

    container.innerHTML = '';

    data.habits.forEach(habit => {
        const today = new Date().toDateString();
        const completed = habit.lastCompleted && new Date(habit.lastCompleted).toDateString() === today;

        const habitEl = document.createElement('div');
        habitEl.className = `habit-item ${completed ? 'completed' : ''}`;
        habitEl.style.borderColor = habit.color;
        habitEl.innerHTML = `
            <span class="habit-icon">${habit.icon}</span>
            <div class="habit-info">
                <span class="habit-name">${habit.name}</span>
                <span class="habit-streak">${habit.streak} day streak 🔥</span>
            </div>
            <button class="habit-check ${completed ? 'checked' : ''}" data-id="${habit.id}" style="background: ${completed ? habit.color : 'transparent'}; border-color: ${habit.color};">
                ${completed ? '✓' : ''}
            </button>
        `;

        habitEl.querySelector('.habit-check').onclick = (e) => {
            e.stopPropagation();
            if (!completed) {
                data = AppStorage.completeHabit(habit.id);
                renderHabits();
            }
        };

        container.appendChild(habitEl);
    });
}

function updateStats() {
    document.getElementById('growth-score').textContent = `${data.stats.score}%`;
    document.getElementById('score-fill').style.width = `${data.stats.score}%`;
    document.getElementById('days-traveled').textContent = `${data.stats.daysTraveled} Day${data.stats.daysTraveled > 1 ? 's' : ''}`;

    if (data.entries.length > 0) {
        document.getElementById('growth-insight').textContent = data.entries[0].analysis.growth_tip;
    }

    const partsDist = document.getElementById('parts-distribution');
    partsDist.innerHTML = '';

    // Show top 5 parts
    const sortedParts = Object.values(data.regions)
        .sort((a, b) => b.size - a.size)
        .slice(0, 5);

    sortedParts.forEach(part => {
        const dot = document.createElement('div');
        dot.className = 'tag';
        dot.style.background = `${part.color}33`;
        dot.style.color = part.color;
        dot.textContent = part.name;
        partsDist.appendChild(dot);
    });

    // Update total parts count
    const partsCount = Object.keys(data.regions).length;
    const partsLabel = document.getElementById('parts-count');
    if (partsLabel) {
        partsLabel.textContent = `${partsCount} parts discovered`;
    }
}

function setNewPrompt() {
    const promptEl = document.getElementById('journal-prompt');
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    promptEl.textContent = randomPrompt;
}

function setupReminders() {
    // Request notification permission
    if ('Notification' in window && data.reminders?.enabled) {
        Notification.requestPermission();
    }

    // Check every minute for reminder times
    setInterval(checkReminders, 60000);
}

function checkReminders() {
    if (!data.reminders?.enabled) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (currentTime === data.reminders.journalTime) {
        showReminder('🌅 Morning Reflection', 'Take a moment to check in with yourself. How are you feeling today?');
    }

    if (currentTime === data.reminders.eveningTime) {
        showReminder('🌙 Evening Check-in', 'Reflect on your day. What are you grateful for?');
    }
}

function showReminder(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🌱' });
    }
}

function setupSettingsLogic() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const exportBtn = document.getElementById('export-data');
    const resetBtn = document.getElementById('reset-data');
    const reminderToggle = document.getElementById('reminder-toggle');
    const addHabitBtn = document.getElementById('add-habit-btn');

    settingsBtn.onclick = () => {
        settingsModal.style.display = 'flex';
        if (reminderToggle) {
            reminderToggle.checked = data.reminders?.enabled || false;
        }
    };
    closeSettings.onclick = () => settingsModal.style.display = 'none';

    // Click outside to close
    window.onclick = (event) => {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
    };

    // Reminder toggle
    if (reminderToggle) {
        reminderToggle.onchange = () => {
            if (reminderToggle.checked && 'Notification' in window) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        data = AppStorage.setReminders(true);
                    } else {
                        reminderToggle.checked = false;
                    }
                });
            } else {
                data = AppStorage.setReminders(false);
            }
        };
    }

    // Add habit
    if (addHabitBtn) {
        addHabitBtn.onclick = () => {
            const name = prompt("Enter habit name:");
            if (name) {
                const icon = prompt("Enter an emoji icon:", "✨");
                data = AppStorage.addHabit(name, icon || "✨");
                renderHabits();
            }
        };
    }

    exportBtn.onclick = () => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `growth-map-journey-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    resetBtn.onclick = () => {
        if (confirm("Are you absolutely sure? This will delete your entire map and all past entries. This cannot be undone.")) {
            localStorage.clear();
            location.reload();
        }
    };
}

// Start the app
init();
