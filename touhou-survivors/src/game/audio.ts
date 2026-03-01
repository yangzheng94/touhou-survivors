export class AudioEngine {
  ctx: AudioContext | null = null;
  bgmInterval: number | null = null;
  isMuted: boolean = false;
  lastHitTime: number = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
    } else if (this.ctx) {
      this.startBGM();
    }
    return this.isMuted;
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1, slideFreq?: number) {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration: number, vol = 0.1) {
    if (!this.ctx || this.isMuted) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  shoot() { 
    this.playTone(800, 'square', 0.1, 0.02, 400); 
  }
  
  hit() { 
    const now = Date.now();
    if (now - this.lastHitTime < 50) return; // Throttle hit sounds to avoid ear rape
    this.lastHitTime = now;
    this.playNoise(0.05, 0.05); 
  }
  
  exp() { 
    this.playTone(1200, 'sine', 0.1, 0.03, 1600); 
  }
  
  levelUp() {
    this.playTone(440, 'square', 0.1, 0.05);
    setTimeout(() => this.playTone(554, 'square', 0.1, 0.05), 100);
    setTimeout(() => this.playTone(659, 'square', 0.2, 0.05), 200);
    setTimeout(() => this.playTone(880, 'square', 0.4, 0.05), 300);
  }

  startBGM() {
    this.stopBGM();
    if (!this.ctx || this.isMuted) return;
    
    // Fast Touhou-esque melody (150 BPM)
    const melody = [
      880, 0, 783, 880, 1046, 0, 880, 0,
      783, 0, 659, 0, 783, 880, 0, 0,
      880, 0, 783, 880, 1046, 0, 1318, 0,
      1046, 0, 880, 0, 783, 880, 0, 0
    ];
    
    const bass = [
      220, 220, 220, 220, 220, 220, 220, 220,
      196, 196, 196, 196, 196, 196, 196, 196,
      174, 174, 174, 174, 174, 174, 174, 174,
      164, 164, 164, 164, 196, 196, 196, 196
    ];
    
    let step = 0;
    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || this.isMuted) return;
      
      const mFreq = melody[step % melody.length];
      if (mFreq > 0) {
        this.playTone(mFreq, 'sawtooth', 0.15, 0.02); // ZUN-pet style
      }
      
      const bFreq = bass[step % bass.length];
      if (bFreq > 0) {
        this.playTone(bFreq, 'square', 0.1, 0.02); // Bass
      }
      
      // Drum (noise)
      if (step % 4 === 0) {
        this.playNoise(0.05, 0.03); // Kick
      } else if (step % 4 === 2) {
        this.playNoise(0.1, 0.02); // Snare
      }
      
      step++;
    }, 100); // 100ms per 16th note = 150 BPM
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audio = new AudioEngine();
