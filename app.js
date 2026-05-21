const WORK_SECONDS = 25 * 60;
const BREAK_DURATION = 5 * 60;
const ONE_SECOND = 1000;
const STORAGE_KEY = 'pomodoroSessionCount';

const sessionLabel = document.getElementById('sessionLabel');
const timerDisplay = document.getElementById('timerDisplay');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const resetButton = document.getElementById('resetButton');
const sessionCountElem = document.getElementById('sessionCount');
const sessionSound = document.getElementById('sessionSound');
const progressCircle = document.querySelector('.progress-ring__circle');

let totalSeconds = WORK_SECONDS;
let remainingSeconds = totalSeconds;
let timerId = null;
const state = {
  isRunning: false,
  isPaused: false,
  phase: 'work',
};
let sessionCount = 0;
let audioContext = null;
let allowSound = false;

const circleRadius = Number(progressCircle.getAttribute('r'));
const circleCircumference = 2 * Math.PI * circleRadius;
progressCircle.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
// Start with a full ring visible (offset 0) so it empties as time elapses
progressCircle.style.strokeDashoffset = String(0);

function initApp() {
  bindEventListeners();
  loadSessionCount();
  resetTimer();
}

function bindEventListeners() {
  startButton.addEventListener('click', startWorkSession);
  pauseButton.addEventListener('click', pauseTimer);
  resumeButton.addEventListener('click', resumeTimer);
  resetButton.addEventListener('click', resetTimer);
}

function startWorkSession() {
  enableAudio();
  switchSession('work', true);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(handleTick, ONE_SECOND);
  state.isRunning = true;
  state.isPaused = false;
  updateControlStates();
}

function handleTick() {
  remainingSeconds -= 1;

  if (remainingSeconds <= 0) {
    // Count completed work session
    if (state.phase === 'work') {
      incrementSessionCount();
    }

    // Switch phase
    state.phase = state.phase === 'work' ? 'break' : 'work';

    // Load new duration
    totalSeconds = state.phase === 'work' ? WORK_SECONDS : BREAK_DURATION;
    remainingSeconds = totalSeconds;

    // Update display for new phase
    updateSessionLabel();
    // Play a short transition tone (only if user started the timer)
    playTransitionSound();
  }

  updateTimerDisplay(remainingSeconds);
  updateProgressCircle(remainingSeconds, totalSeconds);
}

function pauseTimer() {
  if (!timerId || state.isPaused) {
    return;
  }

  clearInterval(timerId);
  timerId = null;
  state.isRunning = false;
  state.isPaused = true;
  updateControlStates();
}

function resumeTimer() {
  if (!state.isPaused || remainingSeconds <= 0) {
    return;
  }

  // Resume audio permission (user gesture) and start
  enableAudio();
  startTimer();
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  state.isRunning = false;
  state.isPaused = false;
  state.phase = 'work';
  totalSeconds = WORK_SECONDS;
  remainingSeconds = totalSeconds;
  updateSessionLabel();
  updateTimerDisplay(remainingSeconds);
  updateProgressCircle(remainingSeconds, totalSeconds);
  updateControlStates();
}

function updateTimerDisplay(seconds) {
  timerDisplay.textContent = formatTime(seconds);
}

function updateProgressCircle(remainingSecondsValue, totalSecondsValue) {
  if (totalSecondsValue <= 0) {
    progressCircle.style.strokeDashoffset = String(circleCircumference);
    return;
  }

  // Calculate offset so the ring empties as remainingSeconds decreases.
  // When remaining === total -> offset = 0 (full ring). When remaining === 0 -> offset = circumference (empty).
  const fraction = remainingSecondsValue / totalSecondsValue;
  const offset = circleCircumference * (1 - fraction);
  progressCircle.style.strokeDashoffset = String(Math.max(0, Math.min(circleCircumference, offset)));
}

function switchSession(sessionType, autoStart = false) {
  clearInterval(timerId);
  timerId = null;
  state.isPaused = false;
  state.isRunning = false;
  state.phase = sessionType;
  totalSeconds = WORK_SECONDS;
  remainingSeconds = totalSeconds;

  updateSessionLabel();
  updateTimerDisplay(remainingSeconds);
  updateProgressCircle(remainingSeconds, totalSeconds);
  updateControlStates();

  if (autoStart) {
    startTimer();
  }
}

function updateSessionLabel() {
  sessionLabel.textContent = state.phase === 'work' ? 'Work' : 'Break';
  progressCircle.style.stroke = state.phase === 'work' ? '#4f46e5' : '#f97316';
}

function updateControlStates() {
  startButton.disabled = Boolean(timerId) && !state.isPaused;
  pauseButton.disabled = !timerId || state.isPaused;
  resumeButton.disabled = !state.isPaused || remainingSeconds <= 0;
}

function loadSessionCount() {
  const stored = localStorage.getItem(STORAGE_KEY);
  sessionCount = stored && !Number.isNaN(Number(stored)) ? Number(stored) : 0;
  sessionCountElem.textContent = sessionCount;
}

function saveSessionCount() {
  localStorage.setItem(STORAGE_KEY, String(sessionCount));
}

function incrementSessionCount() {
  sessionCount += 1;
  saveSessionCount();
  sessionCountElem.textContent = sessionCount;
}

function playTransitionSound() {
  // Only play if user has initiated the timer (otherwise browsers block playback)
  if (!allowSound) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(state.phase === 'work' ? 880 : 660, now);
    gain.gain.setValueAtTime(0.12, now);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.16);

    // Clean up connections after sound finishes
    oscillator.onended = () => {
      try {
        oscillator.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
  } catch (error) {
    if (sessionSound && typeof sessionSound.play === 'function') {
      sessionSound.play().catch(() => {});
    }
  }
}

function enableAudio() {
  try {
    allowSound = true;
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
      audioContext.resume().catch(() => {});
    }
  } catch (e) {
    allowSound = false;
  }
}

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

initApp();
