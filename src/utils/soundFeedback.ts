const TONE_DURATION_MS = 80;
const TONE_GAIN = 0.12;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function playTonePair(frequencies: [number, number]): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const duration = TONE_DURATION_MS / 1000;

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.04;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(TONE_GAIN, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

export function playStartTone(): void {
  playTonePair([880, 1174]);
}

export function playStopTone(): void {
  playTonePair([1174, 880]);
}
