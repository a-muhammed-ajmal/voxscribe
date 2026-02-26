// ─── VoxScribe — Core Application ────────────────────────────────────────────
import { initDB, saveRecording, getAllRecordings, deleteRecording, pruneOldRecordings } from './db.js';
import { signInWithGoogle, signOutUser, currentUser, onAuthStateChanged } from './firebase.js';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    isPaused: false,
    recordingStart: null,
    timerInterval: null,
    elapsedSeconds: 0,
    apiKey: localStorage.getItem('voxscribe_api_key') || '',
    currentBlob: null,
    currentObjectURL: null,
    recordings: [],
    activePlayer: null,
};

// ── DOM References ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const recordBtn = $('recordBtn');
const recordIcon = $('recordIcon');
const recordLabel = $('recordLabel');
const timerDisplay = $('timerDisplay');
const waveform = $('waveform');
const transcribeBtn = $('transcribeBtn');
const playerSection = $('playerSection');
const audioPlayer = $('audioPlayer');
const downloadBtn = $('downloadBtn');
const durationBadge = $('durationBadge');
const transcriptSection = $('transcriptSection');
const transcriptText = $('transcriptText');
const copyBtn = $('copyBtn');
const copyIcon = $('copyIcon');
const historyList = $('historyList');
const countBadge = $('countBadge');
const emptyState = $('emptyState');
const apiKeyInput = $('apiKeyInput');
const saveApiBtn = $('saveApiBtn');
const apiStatus = $('apiStatus');
const toastContainer = $('toastContainer');
const settingsPanel = $('settingsPanel');
const settingsBtn = $('settingsBtn');
const closeSettings = $('closeSettings');
const settingsOverlay = $('settingsOverlay');
const clearAllBtn = $('clearAllBtn');
const transcribingOverlay = $('transcribingOverlay');

// Auth elements
const signInBtn = $('signInBtn');
const signOutBtn = $('signOutBtn');
const userInfo = $('userInfo');
const signInPrompt = $('signInPrompt');
const userAvatar = $('userAvatar');
const userName = $('userName');
const userEmail = $('userEmail');
const syncStatus = $('syncStatus');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    await initDB();
    
    // Set up auth state listener
    window.addEventListener('authStateChanged', handleAuthStateChange);
    
    // Initial auth state
    updateAuthUI();
    
    // Pre-fill settings field with whatever key is active (stored or default)
    if (state.apiKey) {
        apiKeyInput.value = state.apiKey;
        showApiStatus('API key active ✓', 'success');
    }
    
    // Only load history if user is authenticated
    if (currentUser) {
        await loadHistory();
    }
    
    registerSW();
    setupWaveformBars();
}

function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function setupWaveformBars() {
    waveform.innerHTML = '';
    for (let i = 0; i < 40; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.animationDelay = `${(i * 0.05) % 1}s`;
        waveform.appendChild(bar);
    }
}

function startWaveAnimation() {
    waveform.classList.add('active');
}

function stopWaveAnimation() {
    waveform.classList.remove('active');
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
    state.recordingStart = Date.now() - state.elapsedSeconds * 1000;
    state.timerInterval = setInterval(() => {
        state.elapsedSeconds = Math.floor((Date.now() - state.recordingStart) / 1000);
        timerDisplay.textContent = formatTime(state.elapsedSeconds);
    }, 500);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioChunks = [];
        state.elapsedSeconds = 0;
        timerDisplay.textContent = '00:00';

        const mimeType = getSupportedMimeType();
        state.mediaRecorder = new MediaRecorder(stream, { mimeType });

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) state.audioChunks.push(e.data);
        };

        state.mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            finalizeRecording();
        };

        state.mediaRecorder.start(100);
        state.isRecording = true;

        recordBtn.classList.add('recording');
        recordBtn.setAttribute('aria-pressed', 'true');
        recordBtn.setAttribute('aria-label', 'Stop recording');
        recordIcon.textContent = '⏹';
        recordLabel.textContent = 'Stop Recording';
        timerDisplay.classList.remove('hidden');
        transcribeBtn.classList.add('hidden');
        playerSection.classList.add('hidden');
        transcriptSection.classList.add('hidden');

        startTimer();
        startWaveAnimation();
        showToast('Recording started', 'info');
    } catch (err) {
        showToast('Microphone access denied. Please allow mic access.', 'error');
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
        stopTimer();
        stopWaveAnimation();

        recordBtn.classList.remove('recording');
        recordBtn.setAttribute('aria-pressed', 'false');
        recordBtn.setAttribute('aria-label', 'Start recording');
        recordIcon.textContent = '🎙';
        recordLabel.textContent = 'Start Recording';
    }
}

function finalizeRecording() {
    const mimeType = getSupportedMimeType();
    const blob = new Blob(state.audioChunks, { type: mimeType });
    state.currentBlob = blob;

    if (state.currentObjectURL) URL.revokeObjectURL(state.currentObjectURL);
    state.currentObjectURL = URL.createObjectURL(blob);

    audioPlayer.src = state.currentObjectURL;
    durationBadge.textContent = formatTime(state.elapsedSeconds);
    playerSection.classList.remove('hidden');

    downloadBtn.onclick = () => downloadAudio(blob, `voxscribe_${Date.now()}`);

    transcribeBtn.classList.remove('hidden');
    transcriptSection.classList.add('hidden');
    transcriptText.value = '';
    showToast('Recording saved. Ready to transcribe!', 'success');
}

function getSupportedMimeType() {
    const types = [ 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4' ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

// ── Download ──────────────────────────────────────────────────────────────────
function downloadAudio(blob, filename) {
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Gemini AI Transcription ───────────────────────────────────────────────────
// Model fallback chain — only models confirmed available on this key
// Order: lightest/newest first (most likely to have free quota)
const GEMINI_MODELS = [
    'gemini-2.5-flash-lite',   // Newest + lightest — separate quota pool
    'gemini-2.0-flash-lite',   // Lighter 2.0 — its own quota limit
    'gemini-2.5-flash',        // Full 2.5 — generous limits
    'gemini-2.0-flash',        // Original — quota hit before, last resort
];

async function callGemini(model, base64Audio, mimeType, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [ {
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Audio } }
                ]
            } ],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
        })
    });

    if (response.status === 429) {
        // Extract retry-after seconds from the error body
        const errBody = await response.json();
        const msg = errBody?.error?.message || '';
        const retryMatch = msg.match(/retry in ([\d.]+)s/i);
        const waitSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[ 1 ])) : 60;
        const err = new Error(`QUOTA_429: ${waitSecs}`);
        err.is429 = true;
        err.waitSecs = waitSecs;
        throw err;
    }

    if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody?.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const transcript = data?.candidates?.[ 0 ]?.content?.parts?.[ 0 ]?.text?.trim();
    if (!transcript) throw new Error('Empty response from Gemini.');
    return transcript;
}

function setOverlayStatus(line1, line2 = '') {
    const textEl = transcribingOverlay.querySelector('.transcribing-text');
    const subEl = transcribingOverlay.querySelector('.transcribing-sub');
    if (textEl) textEl.textContent = line1;
    if (subEl) subEl.textContent = line2;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function transcribeAudio() {
    if (!state.apiKey) {
        showToast('Add your Gemini API key in Settings first.', 'error');
        openSettings();
        return;
    }
    if (!state.currentBlob) {
        showToast('No recording found. Record audio first.', 'error');
        return;
    }

    transcribingOverlay.classList.remove('hidden');
    transcribeBtn.disabled = true;

    const prompt = `Act as a professional transcriber and editor. Convert this voice recording into clear, polished written English.

Follow these strict guidelines:
1. Remove all filler words (e.g., "um," "uh," "like," "you know"), stuttering, repetitions, and false starts.
2. Fix all grammatical errors and improve sentence structure to make it flow smoothly.
3. Keep vocabulary simple and easy to understand, but ensure the style is professional.
4. Maintain the original context and intent of the message perfectly; do not change the meaning.
5. Output ONLY the final corrected text. Do not add any introductory phrases, quotes, or concluding remarks.`;

    try {
        const base64Audio = await blobToBase64(state.currentBlob);
        const mimeType = state.currentBlob.type.split(';')[ 0 ] || 'audio/webm';

        let transcript = null;

        for (let i = 0; i < GEMINI_MODELS.length; i++) {
            const model = GEMINI_MODELS[ i ];
            setOverlayStatus(
                `Transcribing with AI…`,
                `Using ${model} (attempt ${i + 1} of ${GEMINI_MODELS.length})`
            );

            try {
                transcript = await callGemini(model, base64Audio, mimeType, prompt);
                break; // Success — exit the loop
            } catch (err) {
                if (err.is429) {
                    const waitSecs = err.waitSecs;
                    const nextModel = GEMINI_MODELS[ i + 1 ];

                    if (nextModel) {
                        // Try next model immediately — no need to wait
                        setOverlayStatus(
                            `Model quota hit — switching…`,
                            `${model} is busy. Trying ${nextModel}…`
                        );
                        await sleep(800); // brief pause so user sees the message
                        continue;
                    } else {
                        // All models exhausted — show countdown then retry first model
                        showToast(`All models busy. Retrying in ${waitSecs}s…`, 'error');
                        for (let s = waitSecs; s > 0; s--) {
                            setOverlayStatus(
                                `Quota limit reached`,
                                `Retrying automatically in ${s}s… (${GEMINI_MODELS[ 0 ]})`
                            );
                            await sleep(1000);
                        }
                        // One final retry with the first model
                        setOverlayStatus('Retrying…', 'Sending request to Gemini…');
                        transcript = await callGemini(GEMINI_MODELS[ 0 ], base64Audio, mimeType, prompt);
                        break;
                    }
                } else {
                    throw err; // Non-quota error — bubble up immediately
                }
            }
        }

        if (!transcript) throw new Error('All Gemini models returned empty responses.');

        transcriptText.value = transcript;
        transcriptSection.classList.remove('hidden');

        await persistRecording(transcript);
        await loadHistory();
        showToast('Transcription complete!', 'success');

    } catch (err) {
        const friendly = err.is429
            ? 'Quota exhausted on all models. Try again in a minute.'
            : err.message;
        showToast(`Error: ${friendly}`, 'error');
        console.error('[VoxScribe]', err);
    } finally {
        setOverlayStatus('Transcribing with AI…', 'Gemini is cleaning up your recording.');
        transcribingOverlay.classList.add('hidden');
        transcribeBtn.disabled = false;
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[ 1 ];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── Persist + History ─────────────────────────────────────────────────────────
async function persistRecording(transcript) {
    if (!currentUser) {
        showToast('Please sign in to save recordings', 'error');
        return;
    }
    
    showSyncStatus('Saving...');
    
    try {
        await pruneOldRecordings();

        // Convert blob to base64 for Firestore storage
        const audioBase64 = await blobToBase64(state.currentBlob);
        const mimeType = state.currentBlob.type;

        const record = {
            id: `rec_${Date.now()}`,
            createdAt: Date.now(),
            duration: state.elapsedSeconds,
            transcript,
            audioBase64,
            mimeType
        };

        await saveRecording(record);
        hideSyncStatus();
        showToast('Recording synced to cloud ✓', 'success');
    } catch (error) {
        hideSyncStatus();
        showToast('Failed to save recording', 'error');
        console.error('Error saving recording:', error);
    }
}

async function loadHistory() {
    if (!currentUser) {
        state.recordings = [];
        renderHistory();
        return;
    }
    
    showSyncStatus('Loading...');
    try {
        state.recordings = await getAllRecordings();
        renderHistory();
        hideSyncStatus();
    } catch (error) {
        hideSyncStatus();
        showToast('Failed to load recordings', 'error');
        console.error('Error loading recordings:', error);
    }
}

function renderHistory() {
    if (countBadge) countBadge.textContent = `${state.recordings.length} / 10`;
    historyList.innerHTML = '';

    if (!state.recordings.length) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    state.recordings.forEach((rec, idx) => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.setAttribute('data-id', rec.id);

        const date = new Date(rec.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const preview = rec.transcript.length > 120 ? rec.transcript.slice(0, 120) + '…' : rec.transcript;

        card.innerHTML = `
      <div class="card-header">
        <div class="card-meta">
          <span class="card-index">#${idx + 1}</span>
          <div class="card-datetime">
            <span class="card-date">${dateStr}</span>
            <span class="card-time">${timeStr}</span>
          </div>
          <span class="card-duration">⏱ ${formatTime(rec.duration)}</span>
        </div>
        <div class="card-actions">
          <button class="card-btn play-btn" title="Play" data-id="${rec.id}">▶</button>
          <button class="card-btn copy-btn-hist" title="Copy text" data-transcript="${encodeURIComponent(rec.transcript)}">⧉</button>
          <button class="card-btn dl-btn" title="Download audio" data-id="${rec.id}">↓</button>
          <button class="card-btn del-btn" title="Delete" data-id="${rec.id}">✕</button>
        </div>
      </div>
      <p class="card-preview">${preview}</p>
      <div class="card-player hidden" id="player_${rec.id}">
        <audio controls src="" style="width:100%;margin-top:8px;"></audio>
      </div>
    `;

        historyList.appendChild(card);
    });

    // Attach events
    historyList.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleHistoryPlayback(e.currentTarget.dataset.id));
    });

    historyList.querySelectorAll('.copy-btn-hist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = decodeURIComponent(e.currentTarget.dataset.transcript);
            navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!', 'success');
        });
    });

    historyList.querySelectorAll('.dl-btn').forEach(btn => {
        btn.addEventListener('click', (e) => downloadHistoryAudio(e.currentTarget.dataset.id));
    });

    historyList.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteHistoryItem(e.currentTarget.dataset.id));
    });
}

function toggleHistoryPlayback(id) {
    const rec = state.recordings.find(r => r.id === id);
    if (!rec) return;

    const playerDiv = document.getElementById(`player_${id}`);
    const btn = historyList.querySelector(`.play-btn[data-id="${id}"]`);

    if (playerDiv.classList.contains('hidden')) {
        // Close any other open player
        historyList.querySelectorAll('.card-player').forEach(p => p.classList.add('hidden'));
        historyList.querySelectorAll('.play-btn').forEach(b => b.textContent = '▶');

        // Build blob URL from base64
        const byteString = atob(rec.audioBase64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[ i ] = byteString.charCodeAt(i);
        const blob = new Blob([ ab ], { type: rec.mimeType });
        const url = URL.createObjectURL(blob);

        const audio = playerDiv.querySelector('audio');
        audio.src = url;
        playerDiv.classList.remove('hidden');
        btn.textContent = '⏸';
        audio.play();
    } else {
        playerDiv.classList.add('hidden');
        btn.textContent = '▶';
        const audio = playerDiv.querySelector('audio');
        audio.pause();
        audio.src = '';
    }
}

function downloadHistoryAudio(id) {
    const rec = state.recordings.find(r => r.id === id);
    if (!rec) return;
    const byteString = atob(rec.audioBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[ i ] = byteString.charCodeAt(i);
    const blob = new Blob([ ab ], { type: rec.mimeType });
    downloadAudio(blob, `voxscribe_${id}`);
}

async function deleteHistoryItem(id) {
    showSyncStatus('Deleting...');
    try {
        await deleteRecording(id);
        hideSyncStatus();
        showToast('Recording deleted.', 'info');
        await loadHistory();
    } catch (error) {
        hideSyncStatus();
        showToast('Failed to delete recording', 'error');
        console.error('Error deleting recording:', error);
    }
}

// ── Copy Transcript ───────────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
    const text = transcriptText.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        copyIcon.textContent = '✓';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyIcon.textContent = '⧉';
            copyBtn.classList.remove('copied');
        }, 2000);
    });
});

// ── Authentication ───────────────────────────────────────────────────────────
function handleAuthStateChange(event) {
    updateAuthUI();
    if (event.detail.user) {
        loadHistory();
        showToast('Signed in successfully!', 'success');
    } else {
        state.recordings = [];
        renderHistory();
        showToast('Signed out', 'info');
    }
}

function updateAuthUI() {
    if (currentUser) {
        // Show user info
        userInfo.classList.remove('hidden');
        signInPrompt.classList.add('hidden');
        
        // Update user details
        userAvatar.textContent = currentUser.displayName?.charAt(0).toUpperCase() || 'U';
        userName.textContent = currentUser.displayName || 'User';
        userEmail.textContent = currentUser.email || '';
    } else {
        // Show sign in prompt
        userInfo.classList.add('hidden');
        signInPrompt.classList.remove('hidden');
    }
}

function showSyncStatus(text = 'Syncing...') {
    syncStatus.classList.remove('hidden');
    syncStatus.querySelector('.sync-text').textContent = text;
}

function hideSyncStatus() {
    syncStatus.classList.add('hidden');
}

// Auth event listeners
signInBtn.addEventListener('click', async () => {
    try {
        showSyncStatus('Signing in...');
        await signInWithGoogle();
        hideSyncStatus();
    } catch (error) {
        hideSyncStatus();
        showToast('Failed to sign in', 'error');
        console.error('Sign in error:', error);
    }
});

signOutBtn.addEventListener('click', async () => {
    try {
        await signOutUser();
    } catch (error) {
        showToast('Failed to sign out', 'error');
        console.error('Sign out error:', error);
    }
});

// ── Settings Panel ────────────────────────────────────────────────────────────
function openSettings() {
    settingsPanel.classList.add('open');
    settingsOverlay.classList.add('open');
}

function closeSettingsPanel() {
    settingsPanel.classList.remove('open');
    settingsOverlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsPanel);
settingsOverlay.addEventListener('click', closeSettingsPanel);

saveApiBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showApiStatus('Please enter a valid API key', 'error');
        return;
    }
    state.apiKey = key;
    localStorage.setItem('voxscribe_api_key', key);
    showApiStatus('Key saved successfully ✓', 'success');
    showToast('API key saved!', 'success');
});

apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiBtn.click();
});

function showApiStatus(msg, type) {
    apiStatus.textContent = msg;
    apiStatus.className = `api-status ${type}`;
    apiStatus.classList.remove('hidden');
}

// ── Clear All ─────────────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Delete all recordings? This cannot be undone.')) return;
    for (const rec of state.recordings) {
        await deleteRecording(rec.id);
    }
    await loadHistory();
    showToast('All recordings cleared.', 'info');
});

// ── Record Button ─────────────────────────────────────────────────────────────
recordBtn.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Please sign in to record', 'error');
        openSettings();
        return;
    }
    
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// ── Transcribe Button ─────────────────────────────────────────────────────────
transcribeBtn.addEventListener('click', transcribeAudio);

// ── Toast Notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
