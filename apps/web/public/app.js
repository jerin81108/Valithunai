/**
 * வழித்துணை (Vazhithunai) – Web Guardian & Practice Simulator
 * 100% Client-side, 0 Network Calls, Full Web Audio & Canvas Visualization
 */

// --- 1. Audio Engine Implementation ---
class WebAudioEngine {
  constructor() {
    this.ctx = null;
    this.limiter = null;
    this.masterGain = null;
    this.isMuted = true; // browser requires user gesture to unmute
  }

  async init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-6.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(16.0, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isMuted = false;
  }

  playEarcon(soundType, pitchHz, volumeDb, pan) {
    if (this.isMuted || !this.ctx || !this.limiter) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const duration = 0.080;

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan || 0)), t);
      panner.connect(this.limiter);
    }

    const volumeGain = this.ctx.createGain();
    const gainValue = Math.max(0.1, Math.min(0.9, ((volumeDb || 65) - 50) / 35));
    volumeGain.gain.setValueAtTime(gainValue, t);

    if (panner) {
      volumeGain.connect(panner);
    } else {
      volumeGain.connect(this.limiter);
    }

    const pitch = Math.max(200, Math.min(2200, pitchHz || 600));

    switch (soundType) {
      case 'VEHICLE': {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch * 0.7, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);

        osc.connect(filter);
        filter.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(gainValue, t + 0.015);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration);
        break;
      }
      case 'SKY_GUARD': {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, t + duration);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(gainValue, t + 0.01);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration);
        break;
      }
      case 'DROP_OFF': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch * 1.3, t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + duration);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(gainValue, t + 0.01);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration);
        break;
      }
      case 'CLEAR_CHIME': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.35, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      }
      case 'SETTLING': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.25, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }
      default: {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, t);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(gainValue, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration);
      }
    }
  }

  speak(text, lang = 'ta-IN') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const tamilVoice = voices.find(v => v.lang.startsWith('ta'));
    if (tamilVoice) {
      utterance.voice = tamilVoice;
    }
    window.speechSynthesis.speak(utterance);
  }
}

// --- 2. Haptics Adapter ---
class WebHapticsEngine {
  vibrate(pattern, intensity = 1.0) {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    const patterns = {
      CAUTION: [60, 80, 60],
      HAZARD: [120, 50, 120, 50, 120],
      SKY_GUARD: [30, 40, 60, 40, 100, 30, 150],
      DROP_OFF: [250, 60, 180],
      RECOVERING: [80, 120, 40]
    };
    const seq = patterns[pattern] || [50];
    const scaled = seq.map((v, i) => (i % 2 === 0 ? Math.round(v * intensity) : v));
    try {
      navigator.vibrate(scaled);
    } catch {}
  }
}

// --- 3. Deterministic In-Browser Safety Engine ---
class BrowserSafetyEngine {
  constructor() {
    this.state = 'CLEAR';
    this.recoveryCount = 0;
    this.trackMap = new Map();
    this.lastReason = 'CORRIDOR_CLEAR';
    this.latestExplanationTa = 'பாதை முற்றிலும் பாதுகாப்பாக உள்ளது.';
    this.latestExplanationEn = 'Path is clear ahead.';
  }

  process(detections, timestamp) {
    // 1.2m wide corridor (|lateral| <= 0.6m)
    const corridorHazards = detections.filter(d => Math.abs(d.lateral_offset_m) <= 0.6);

    const processed = corridorHazards.map(d => {
      const prev = this.trackMap.get(d.id);
      const dt = prev ? Math.max(0.01, (timestamp - prev.time) / 1000) : 0.033;
      const closingVelocity = prev ? (prev.depth - d.depth_m) / dt : 0;
      const isFastCloser = closingVelocity > 1.5;
      const persistence = (prev ? prev.count : 0) + 1;

      this.trackMap.set(d.id, { depth: d.depth_m, time: timestamp, count: persistence });

      const isSkyGuard = d.height_m >= 1.4 || d.class === 'low-hanging object' || d.class === 'scaffolding' || d.class === 'wire';
      const isDropOff = d.class === 'pit/open manhole' || d.class === 'stairs-down' || d.height_m < 0.1;

      const isCritical = d.depth_m <= 1.5 || isFastCloser;
      const isWarn = d.depth_m <= 2.5;

      return {
        ...d,
        closingVelocity,
        isFastCloser,
        isSkyGuard,
        isDropOff,
        isCritical,
        isWarn,
        persistence
      };
    });

    const activeCritical = processed.filter(h => h.isCritical && (h.persistence >= 3 || h.isFastCloser));
    const activeWarn = processed.filter(h => h.isWarn && h.persistence >= 3);
    const corridorClean = processed.length === 0;

    let nextState = this.state;
    let reason = 'CORRIDOR_CLEAR';
    let primary = null;

    if (activeCritical.length > 0) {
      primary = activeCritical[0];
      nextState = 'HAZARD';
      this.recoveryCount = 0;
      if (primary.isSkyGuard) reason = 'SKY_GUARD_HEAD_HAZARD';
      else if (primary.isDropOff) reason = 'DROP_OFF_HAZARD';
      else if (primary.isFastCloser) reason = 'FAST_APPROACHING_HAZARD';
      else reason = 'CRITICAL_PROXIMITY';
    } else if (activeWarn.length > 0) {
      primary = activeWarn[0];
      nextState = 'CAUTION';
      this.recoveryCount = 0;
      reason = 'CAUTION_PROXIMITY';
    } else if (corridorClean) {
      if (this.state === 'HAZARD' || this.state === 'CAUTION') {
        nextState = 'RECOVERING';
        this.recoveryCount = 1;
        reason = 'RECOVERING_HYSTERESIS';
      } else if (this.state === 'RECOVERING') {
        this.recoveryCount++;
        if (this.recoveryCount >= 5) {
          nextState = 'CLEAR';
          this.recoveryCount = 0;
          reason = 'CORRIDOR_CLEAR';
        } else {
          reason = 'RECOVERING_HYSTERESIS';
        }
      } else {
        reason = 'CORRIDOR_CLEAR';
      }
    } else {
      // unpersisted obstacles
      primary = processed[0];
      if (this.state === 'RECOVERING') {
        nextState = 'HAZARD';
        this.recoveryCount = 0;
        reason = 'INSTANT_RELAPSE_DURING_RECOVERY';
      }
    }

    this.state = nextState;
    this.lastReason = reason;

    // Bilingual explainability
    if (reason === 'CORRIDOR_CLEAR') {
      this.latestExplanationTa = 'பாதை முற்றிலும் பாதுகாப்பாக உள்ளது.';
      this.latestExplanationEn = 'Path is clear ahead.';
    } else if (reason === 'RECOVERING_HYSTERESIS') {
      this.latestExplanationTa = `பாதை சீராகிறது (${this.recoveryCount}/5), கவனமாக தொடருங்கள்.`;
      this.latestExplanationEn = `Path stabilizing (${this.recoveryCount}/5), proceed with caution.`;
    } else if (primary) {
      const dirTa = primary.lateral_offset_m > 0.15 ? 'வலப்புறம் இருந்து' : (primary.lateral_offset_m < -0.15 ? 'இடப்புறம் இருந்து' : 'நேராக முன்னால்');
      const dirEn = primary.lateral_offset_m > 0.15 ? 'from the right' : (primary.lateral_offset_m < -0.15 ? 'from the left' : 'directly ahead');
      const dist = primary.depth_m.toFixed(1);

      if (primary.isSkyGuard) {
        this.latestExplanationTa = `தலைக்கு மேலே தாழ்வான பொருள் ${dist} மீட்டரில் உள்ளது. குனியவும்.`;
        this.latestExplanationEn = `Overhead obstacle at ${dist} meters. Watch your head.`;
      } else if (primary.isDropOff) {
        this.latestExplanationTa = `கவனம்! ${dirTa} திறந்த குழி ${dist} மீட்டரில் உள்ளது. நில்லுங்கள்.`;
        this.latestExplanationEn = `Caution! Open pit or drop-off ${dist} meters ${dirEn}. Stop.`;
      } else if (primary.class === 'e-rickshaw') {
        this.latestExplanationTa = `${dirTa} ஆட்டோ ${dist} மீட்டரில் நெருங்குகிறது.`;
        this.latestExplanationEn = `E-rickshaw approaching ${dirEn} at ${dist} meters.`;
      } else if (primary.class === 'cattle') {
        this.latestExplanationTa = `${dirTa} மாடு ${dist} மீட்டரில் உள்ளது.`;
        this.latestExplanationEn = `Cattle detected ${dist} meters ${dirEn}.`;
      } else {
        this.latestExplanationTa = `${dirTa} ${primary.class} ${dist} மீட்டரில் உள்ளது.`;
        this.latestExplanationEn = `${primary.class} detected ${dist} meters ${dirEn}.`;
      }
    }

    return {
      state: this.state,
      reason,
      primary,
      activeHazards: processed,
      recoveryCount: this.recoveryCount,
      explanationTa: this.latestExplanationTa,
      explanationEn: this.latestExplanationEn
    };
  }
}

// --- 4. Main App Controller & Visualizer ---
const audioEngine = new WebAudioEngine();
const hapticsEngine = new WebHapticsEngine();
const safetyEngine = new BrowserSafetyEngine();

let currentDetections = [];
let lastEarconTick = 0;
let radarAngle = 0;

const corridorCanvas = document.getElementById('corridor-canvas');
const corridorCtx = corridorCanvas.getContext('2d');
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

const stateRing = document.getElementById('state-ring');
const hudStateLabel = document.getElementById('hud-state-label');
const hudRecoveryInfo = document.getElementById('hud-recovery-info');
const hudShapeSvg = document.getElementById('hud-shape-svg');
const ttcLabel = document.getElementById('ttc-label');
const ttcFill = document.getElementById('ttc-fill');
const narrationTa = document.getElementById('narration-ta');
const narrationEn = document.getElementById('narration-en');
const srAnnouncer = document.getElementById('sr-announcer');
const btnAudioToggle = document.getElementById('btn-audio-toggle');

// Audio activation
btnAudioToggle.addEventListener('click', async () => {
  await audioEngine.init();
  btnAudioToggle.textContent = '🔊 ஒலி இயக்கத்தில் உள்ளது (Active)';
  btnAudioToggle.style.borderColor = '#10B981';
  audioEngine.speak('வழித்துணை ஒலி அமைப்பு தயார்');
});

// "ஏன்?" (Why?) button
document.getElementById('btn-why').addEventListener('click', () => {
  audioEngine.init();
  const text = safetyEngine.latestExplanationTa;
  audioEngine.speak(text);
  srAnnouncer.textContent = text;
});

// "சுற்றிப் பார்" (Radar Sweep)
document.getElementById('btn-radar').addEventListener('click', () => {
  audioEngine.init();
  audioEngine.speak('சுற்றிப் பார்க்கிறது');

  // Sweep left to right over 1.2s
  [-0.8, -0.4, 0.0, 0.4, 0.8].forEach((pan, idx) => {
    setTimeout(() => {
      audioEngine.playEarcon('STATIC', 600 + idx * 100, 70, pan);
    }, idx * 220);
  });
});

// Scenario buttons
function setScenario(name) {
  audioEngine.init();
  const now = performance.now();

  switch (name) {
    case 'auto':
      currentDetections = [{
        id: 'auto_fast',
        class: 'e-rickshaw',
        depth_m: 1.4,
        lateral_offset_m: 0.35,
        height_m: 1.2,
        timestamp: now
      }];
      break;
    case 'scaffold':
      currentDetections = [{
        id: 'branch_overhead',
        class: 'low-hanging object',
        depth_m: 1.5,
        lateral_offset_m: 0.0,
        height_m: 1.8,
        timestamp: now
      }];
      break;
    case 'pit':
      currentDetections = [{
        id: 'drain_pit',
        class: 'pit/open manhole',
        depth_m: 1.2,
        lateral_offset_m: -0.15,
        height_m: -0.2,
        timestamp: now
      }];
      break;
    case 'cattle':
      currentDetections = [{
        id: 'cow_path',
        class: 'cattle',
        depth_m: 1.3,
        lateral_offset_m: 0.1,
        height_m: 1.1,
        timestamp: now
      }];
      break;
    case 'person':
      currentDetections = [{
        id: 'walker_1',
        class: 'person',
        depth_m: 2.1,
        lateral_offset_m: 0.0,
        height_m: 1.6,
        timestamp: now
      }];
      break;
    case 'clear':
    default:
      currentDetections = [];
      break;
  }
}

document.getElementById('scen-auto').onclick = () => setScenario('auto');
document.getElementById('scen-scaffold').onclick = () => setScenario('scaffold');
document.getElementById('scen-pit').onclick = () => setScenario('pit');
document.getElementById('scen-cattle').onclick = () => setScenario('cattle');
document.getElementById('scen-person').onclick = () => setScenario('person');
document.getElementById('scen-clear').onclick = () => setScenario('clear');

// Keyboard shortcuts (Accessible controls)
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setScenario('auto');
  if (e.key === '2') setScenario('scaffold');
  if (e.key === '3') setScenario('pit');
  if (e.key === '4') setScenario('cattle');
  if (e.key === '5') setScenario('person');
  if (e.key === '0' || e.key === 'c') setScenario('clear');
  if (e.key === 'w' || e.key === 'W') document.getElementById('btn-why').click();
  if (e.key === 'r' || e.key === 'R') document.getElementById('btn-radar').click();
});

// Render 3D Perspective Walking Corridor
function renderCorridor(hazards, state) {
  const w = corridorCanvas.width;
  const h = corridorCanvas.height;
  corridorCtx.clearRect(0, 0, w, h);

  // Background street sky & ground
  const horizonY = h * 0.42;

  // Sky
  corridorCtx.fillStyle = '#060F22';
  corridorCtx.fillRect(0, 0, w, horizonY);

  // Ground
  corridorCtx.fillStyle = '#0B1B3A';
  corridorCtx.fillRect(0, horizonY, w, h - horizonY);

  // Horizon line
  corridorCtx.strokeStyle = '#233868';
  corridorCtx.lineWidth = 2;
  corridorCtx.beginPath();
  corridorCtx.moveTo(0, horizonY);
  corridorCtx.lineTo(w, horizonY);
  corridorCtx.stroke();

  // Perspective Corridor (1.2m virtual width)
  const centerX = w / 2;
  const topCorridorW = 40;
  const bottomCorridorW = w * 0.65;

  corridorCtx.fillStyle = state === 'HAZARD'
    ? 'rgba(229, 50, 45, 0.15)'
    : (state === 'CAUTION' ? 'rgba(255, 179, 0, 0.12)' : 'rgba(31, 164, 91, 0.12)');
  corridorCtx.strokeStyle = state === 'HAZARD'
    ? '#E5322D'
    : (state === 'CAUTION' ? '#FFB300' : '#1FA45B');
  corridorCtx.lineWidth = 4;

  // Glowing path polygon
  corridorCtx.beginPath();
  corridorCtx.moveTo(centerX - bottomCorridorW / 2, h);
  corridorCtx.lineTo(centerX - topCorridorW / 2, horizonY);
  corridorCtx.lineTo(centerX + topCorridorW / 2, horizonY);
  corridorCtx.lineTo(centerX + bottomCorridorW / 2, h);
  corridorCtx.closePath();
  corridorCtx.fill();
  corridorCtx.stroke();

  // Walking corridor perspective rungs
  corridorCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  corridorCtx.lineWidth = 2;
  for (let z = 1; z <= 5; z++) {
    const ratio = Math.pow(z / 5, 1.8);
    const y = horizonY + (h - horizonY) * ratio;
    const curW = topCorridorW + (bottomCorridorW - topCorridorW) * ratio;
    corridorCtx.beginPath();
    corridorCtx.moveTo(centerX - curW / 2, y);
    corridorCtx.lineTo(centerX + curW / 2, y);
    corridorCtx.stroke();
  }

  // Draw Hazards
  hazards.forEach(hz => {
    // Distance mapped along perspective
    const depthRatio = Math.max(0, Math.min(1.0, (3.5 - hz.depth_m) / 3.0));
    const objY = horizonY + (h - horizonY) * depthRatio;
    const curWidth = topCorridorW + (bottomCorridorW - topCorridorW) * depthRatio;
    const objX = centerX + (hz.lateral_offset_m / 0.6) * (curWidth / 2);

    const objSize = 40 + depthRatio * 60;

    // Hazard Bounding Box & Card
    corridorCtx.fillStyle = hz.isCritical ? 'rgba(229, 50, 45, 0.85)' : 'rgba(255, 179, 0, 0.85)';
    corridorCtx.strokeStyle = '#FFFFFF';
    corridorCtx.lineWidth = 3;

    corridorCtx.beginPath();
    corridorCtx.roundRect(objX - objSize / 2, objY - objSize / 2, objSize, objSize, 12);
    corridorCtx.fill();
    corridorCtx.stroke();

    // Icon & Label
    corridorCtx.fillStyle = '#FFFFFF';
    corridorCtx.font = 'bold 15px system-ui';
    corridorCtx.textAlign = 'center';

    let icon = '⚠️';
    if (hz.class === 'e-rickshaw') icon = '🛺';
    if (hz.isSkyGuard) icon = '🌳';
    if (hz.isDropOff) icon = '🕳️';
    if (hz.class === 'cattle') icon = '🐂';
    if (hz.class === 'person') icon = '🚶';

    corridorCtx.fillText(`${icon} ${hz.depth_m.toFixed(1)}m`, objX, objY + 5);

    // Overhead Sky Guard visual halo
    if (hz.isSkyGuard) {
      corridorCtx.strokeStyle = '#FFB300';
      corridorCtx.lineWidth = 3;
      corridorCtx.setLineDash([6, 6]);
      corridorCtx.strokeRect(objX - objSize * 0.7, objY - objSize * 1.2, objSize * 1.4, objSize * 0.8);
      corridorCtx.setLineDash([]);
      corridorCtx.font = '12px system-ui';
      corridorCtx.fillText('தலைக்கு மேல் (SKY GUARD)', objX, objY - objSize);
    }
  });
}

// Render Top-Down Radar Sonar HUD
function renderRadar(hazards) {
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 4;

  radarCtx.clearRect(0, 0, w, h);

  // Background sonar rings
  radarCtx.fillStyle = 'rgba(6, 15, 34, 0.9)';
  radarCtx.fillRect(0, 0, w, h);

  radarCtx.strokeStyle = 'rgba(255, 179, 0, 0.25)';
  radarCtx.lineWidth = 1;
  [0.3, 0.6, 0.9].forEach(factor => {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r * factor, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  // Center user dot
  radarCtx.fillStyle = '#FFB300';
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 4, 0, Math.PI * 2);
  radarCtx.fill();

  // Sonar sweep beam
  radarAngle = (radarAngle + 0.05) % (Math.PI * 2);
  radarCtx.strokeStyle = 'rgba(255, 179, 0, 0.8)';
  radarCtx.lineWidth = 2;
  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.lineTo(cx + Math.cos(radarAngle) * r, cy + Math.sin(radarAngle) * r);
  radarCtx.stroke();

  // Hazard pings on radar
  hazards.forEach(hz => {
    const distFactor = Math.min(1.0, hz.depth_m / 3.0);
    const px = cx + (hz.lateral_offset_m / 0.8) * (r * 0.7);
    const py = cy - distFactor * (r * 0.8);

    radarCtx.fillStyle = hz.isCritical ? '#E5322D' : '#FFB300';
    radarCtx.beginPath();
    radarCtx.arc(px, py, 5, 0, Math.PI * 2);
    radarCtx.fill();
    radarCtx.strokeStyle = '#FFFFFF';
    radarCtx.stroke();
  });
}

// Main 30 FPS Animation & Engine Loop
let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = performance.now();

function mainLoop(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  // Process safety window
  const out = safetyEngine.process(currentDetections, now);

  // Update UI State Edge Ring
  stateRing.className = `state-${out.state}`;

  // Update HUD text & shapes
  const stateLabels = {
    CLEAR: { ta: 'தெளிவு (CLEAR)', color: '#1FA45B', svg: '<circle cx="50" cy="50" r="40" fill="#1FA45B" />' },
    CAUTION: { ta: 'எச்சரிக்கை (CAUTION)', color: '#FFB300', svg: '<polygon points="50,15 90,85 10,85" fill="#FFB300" />' },
    HAZARD: { ta: 'ஆபத்து (HAZARD)', color: '#E5322D', svg: '<polygon points="30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30" fill="#E5322D" />' },
    RECOVERING: { ta: 'சீராகிறது (RECOVERING)', color: '#00A6A6', svg: '<circle cx="50" cy="50" r="35" stroke="#00A6A6" stroke-width="12" fill="none" />' }
  };

  const currConfig = stateLabels[out.state] || stateLabels.CLEAR;
  hudStateLabel.textContent = currConfig.ta;
  hudStateLabel.style.color = currConfig.color;
  hudShapeSvg.innerHTML = currConfig.svg;

  if (out.state === 'RECOVERING') {
    hudRecoveryInfo.textContent = `மீட்டெடுப்பு: ${out.recoveryCount} / 5 சீரான படிகள்`;
  } else {
    hudRecoveryInfo.textContent = out.explanationEn;
  }

  narrationTa.textContent = out.explanationTa;
  narrationEn.textContent = out.explanationEn;

  // Update TTC Bar
  if (out.primary) {
    const dist = out.primary.depth_m;
    const ttc = Math.max(0.2, dist / 1.5).toFixed(1);
    ttcLabel.textContent = `TTC: ${ttc} வினாடி (${dist.toFixed(1)} மீ)`;
    const percent = Math.min(100, Math.max(10, (dist / 2.5) * 100));
    ttcFill.style.width = `${percent}%`;
    ttcFill.style.backgroundColor = out.state === 'HAZARD' ? '#E5322D' : '#FFB300';
  } else {
    ttcLabel.textContent = 'TTC: > 3.0 வினாடி (பாதுகாப்பு)';
    ttcFill.style.width = '100%';
    ttcFill.style.backgroundColor = '#1FA45B';
  }

  // Audio Earcon & Haptic Pulse Rhythm
  const pulseInterval = out.state === 'HAZARD' ? 166 : (out.state === 'CAUTION' ? 500 : 1500);
  if (now - lastEarconTick >= pulseInterval) {
    lastEarconTick = now;

    if (out.state === 'HAZARD') {
      const isSky = out.primary?.isSkyGuard;
      const isDrop = out.primary?.isDropOff;
      const type = isSky ? 'SKY_GUARD' : (isDrop ? 'DROP_OFF' : 'VEHICLE');
      audioEngine.playEarcon(type, 880, 75, out.primary?.lateral_offset_m || 0);
      hapticsEngine.vibrate(isSky ? 'SKY_GUARD' : (isDrop ? 'DROP_OFF' : 'HAZARD'), 1.0);
    } else if (out.state === 'CAUTION') {
      audioEngine.playEarcon('STATIC', 550, 65, out.primary?.lateral_offset_m || 0);
      hapticsEngine.vibrate('CAUTION', 0.6);
    } else if (out.state === 'RECOVERING') {
      audioEngine.playEarcon('SETTLING', 440, 60, 0);
      hapticsEngine.vibrate('RECOVERING', 0.3);
    }
  }

  // Render Visuals
  renderCorridor(out.activeHazards, out.state);
  renderRadar(out.activeHazards);

  // FPS Counter
  frameCount++;
  if (now - lastFpsUpdate >= 1000) {
    document.getElementById('badge-fps').textContent = `${frameCount} FPS`;
    document.getElementById('badge-latency').textContent = `${dt.toFixed(0)} ms`;
    frameCount = 0;
    lastFpsUpdate = now;
  }

  requestAnimationFrame(mainLoop);
}

// Register Offline Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Start visual engine loop
requestAnimationFrame(mainLoop);

