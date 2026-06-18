/**
 * AudioEngine.js
 * Web Audio API 8D spatial audio processor.
 *
 * Audio graph:
 *   <audio> element
 *     → MediaElementAudioSourceNode
 *     → AnalyserNode (for visualizer FFT)
 *     → PannerNode (HRTF — true 3D head-related transfer function)
 *     → [dry path] DryGainNode ─────────────────────────┐
 *     → [wet path] ConvolverNode (reverb) → WetGainNode ─┤
 *                                                         → MasterGainNode
 *                                                              → AudioContext.destination
 *
 * The PannerNode position oscillates in a circle (sin/cos), creating
 * the characteristic 8D audio "sound rotating around your head" effect.
 */

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.audio = null;
    this.source = null;
    this.analyser = null;
    this.panner = null;
    this.dryGain = null;
    this.wetGain = null;
    this.convolver = null;
    this.masterGain = null;

    this._animFrameId = null;
    this._angle = 0;
    this._initialized = false;

    // Controllable 8D parameters
    this._rotationSpeed = 0.5;  // Hz — oscillations per second
    this._reverbAmount = 0.35;  // 0–1 wet/dry mix
    this._radius = 3;           // meters — how far sound "orbits"
    this._volume = 0.85;

    // Event callbacks
    this.onTimeUpdate = null;
    this.onDurationChange = null;
    this.onEnded = null;
    this.onPlay = null;
    this.onPause = null;
    this.onError = null;
    this.onLoadStart = null;
    this.onCanPlay = null;
  }

  // ─── Initialization ─────────────────────────────────────────

  _createAudio() {
    if (this.audio) return;
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'metadata';

    this.audio.addEventListener('timeupdate', () => {
      this.onTimeUpdate?.(this.audio.currentTime);
    });
    this.audio.addEventListener('durationchange', () => {
      this.onDurationChange?.(this.audio.duration);
    });
    this.audio.addEventListener('ended', () => {
      this.onEnded?.();
    });
    this.audio.addEventListener('play', () => {
      this.audioContext?.resume();
      this.onPlay?.();
    });
    this.audio.addEventListener('pause', () => {
      this.onPause?.();
    });
    this.audio.addEventListener('error', (e) => {
      this.onError?.(e);
    });
    this.audio.addEventListener('loadstart', () => {
      this.onLoadStart?.();
    });
    this.audio.addEventListener('canplay', () => {
      this.onCanPlay?.();
    });
  }

  async _initAudioContext() {
    if (this._initialized) return;

    this._createAudio();

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Source node — taps the <audio> element into the Web Audio graph
    this.source = this.audioContext.createMediaElementSource(this.audio);

    // Analyser — for real-time frequency visualizer (FFT)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.8;

    // PannerNode — 3D HRTF spatial positioning
    this.panner = this.audioContext.createPanner();
    this.panner.panningModel = 'HRTF';     // Head-Related Transfer Function
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 10000;
    this.panner.rolloffFactor = 1;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 0;
    this.panner.coneOuterGain = 0;

    // Set initial position
    this.panner.positionX.value = 0;
    this.panner.positionY.value = 0;
    this.panner.positionZ.value = this._radius;

    // Listener position (the listener is the user with headphones)
    if (this.audioContext.listener.forwardX) {
      this.audioContext.listener.forwardX.value = 0;
      this.audioContext.listener.forwardY.value = 0;
      this.audioContext.listener.forwardZ.value = -1;
      this.audioContext.listener.upX.value = 0;
      this.audioContext.listener.upY.value = 1;
      this.audioContext.listener.upZ.value = 0;
    }

    // Reverb nodes — dry/wet signal mix
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    this.convolver = this.audioContext.createConvolver();
    this.masterGain = this.audioContext.createGain();

    this.dryGain.gain.value = 1 - this._reverbAmount;
    this.wetGain.gain.value = this._reverbAmount;
    this.masterGain.gain.value = this._volume;

    // Generate synthetic hall reverb impulse response
    this._generateReverb(2.5, 2.0);

    // ── Wire up the audio graph ──
    this.source.connect(this.analyser);
    this.analyser.connect(this.panner);

    // Dry path (no reverb)
    this.panner.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    // Wet path (through reverb)
    this.panner.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.masterGain);

    // Output
    this.masterGain.connect(this.audioContext.destination);

    this._initialized = true;

    // Start the 8D oscillation loop
    this._startOscillation();
  }

  /**
   * Generate a synthetic hall reverb impulse response.
   * No external file needed — computed algorithmically.
   */
  _generateReverb(duration = 2.5, decay = 2.0) {
    if (!this.audioContext || !this.convolver) return;

    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay noise = reverb tail
        const noise = (Math.random() * 2 - 1);
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = noise * envelope;
      }
    }

    this.convolver.buffer = impulse;
  }

  // ─── 8D Oscillation ─────────────────────────────────────────

  _startOscillation() {
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // seconds, capped
      lastTime = now;

      // Advance angle based on rotation speed
      this._angle += this._rotationSpeed * dt * Math.PI * 2;

      if (this.panner && this.audioContext) {
        const t = this.audioContext.currentTime;
        const r = this._radius;

        // Horizontal circle around the listener (XZ plane)
        const x = Math.sin(this._angle) * r;
        const z = Math.cos(this._angle) * r;
        // Slight vertical oscillation for extra depth
        const y = Math.sin(this._angle * 0.35) * r * 0.25;

        this.panner.positionX.setTargetAtTime(x, t, 0.05);
        this.panner.positionY.setTargetAtTime(y, t, 0.05);
        this.panner.positionZ.setTargetAtTime(z, t, 0.05);
      }

      this._animFrameId = requestAnimationFrame(tick);
    };

    this._animFrameId = requestAnimationFrame(tick);
  }

  _stopOscillation() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Load and prepare a new audio URL.
   * Must be called before play().
   */
  async loadUrl(audioUrl) {
    if (!this._initialized) {
      await this._initAudioContext();
    }
    this.audio.src = audioUrl;
    this.audio.load();
  }

  async play() {
    if (!this.audio) return;
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audio.play();
  }

  pause() {
    this.audio?.pause();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  seek(time) {
    if (this.audio && isFinite(time)) {
      this.audio.currentTime = time;
    }
  }

  get currentTime() { return this.audio?.currentTime ?? 0; }
  get duration() { return this.audio?.duration ?? 0; }
  get paused() { return this.audio?.paused ?? true; }

  // ─── Controls ───────────────────────────────────────────────

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.audioContext.currentTime, 0.01);
    }
  }

  setMuted(muted) {
    if (this.audio) this.audio.muted = muted;
  }

  /** Rotation speed in Hz (cycles per second) */
  setRotationSpeed(hz) {
    this._rotationSpeed = Math.max(0.05, Math.min(5, hz));
  }

  /** Reverb wet amount 0–1 */
  setReverbAmount(amount) {
    this._reverbAmount = Math.max(0, Math.min(1, amount));
    if (this.dryGain && this.wetGain && this.audioContext) {
      const t = this.audioContext.currentTime;
      this.dryGain.gain.setTargetAtTime(1 - this._reverbAmount, t, 0.05);
      this.wetGain.gain.setTargetAtTime(this._reverbAmount, t, 0.05);
    }
  }

  /** Spatial orbit radius in meters */
  setSpatialRadius(r) {
    this._radius = Math.max(0.5, Math.min(10, r));
  }

  // ─── Visualizer Data ────────────────────────────────────────

  /**
   * Returns frequency data array for visualizer rendering.
   * Returns null if not initialized.
   */
  getFrequencyData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * Current 8D angle (0–2π) for the spatial orb UI
   */
  get currentAngle() { return this._angle % (Math.PI * 2); }
  get rotationSpeed() { return this._rotationSpeed; }
  get reverbAmount() { return this._reverbAmount; }
  get spatialRadius() { return this._radius; }

  destroy() {
    this._stopOscillation();
    this.audio?.pause();
    this.audioContext?.close();
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
