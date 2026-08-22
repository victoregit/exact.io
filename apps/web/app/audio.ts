export type SoundCue = 'countdown' | 'go' | 'result' | 'perfect';

const soundPatterns: Record<
  SoundCue,
  Array<{ frequency: number; offset: number }>
> = {
  countdown: [{ frequency: 440, offset: 0 }],
  go: [{ frequency: 660, offset: 0 }],
  result: [{ frequency: 330, offset: 0 }],
  perfect: [
    { frequency: 660, offset: 0 },
    { frequency: 880, offset: 0.08 },
    { frequency: 1_100, offset: 0.16 },
  ],
};

export function playSound(context: AudioContext, cue: SoundCue): void {
  const startAt = context.currentTime;

  soundPatterns[cue].forEach(({ frequency, offset }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + offset;
    const noteEnd = noteStart + 0.09;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.1, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });
}
