/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synthesizes a high-frequency alternating emergency evacuation siren using Web Audio API
export function playSiren(): { stop: () => void } | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported in this browser context.");
      return null;
    }

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch((e) => console.warn('AudioContext auto-resume deferred until click gesture:', e));
    }
    const duration = 6; // Alarm sounds for 6 seconds as requested
    const startTime = audioCtx.currentTime;

    // Siren sweeps up and down continuously
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    
    // Frequency sweep between 750Hz and 1250Hz for alternating high-urgency tone
    osc.frequency.setValueAtTime(750, startTime);
    const interval = 0.4; // 400ms speed for alternating siren
    for (let t = 0; t < duration; t += interval) {
      osc.frequency.exponentialRampToValueAtTime(1250, startTime + t + interval / 2);
      osc.frequency.exponentialRampToValueAtTime(750, startTime + t + interval);
    }

    // Volume configuration: ramp up / flat / ramp down to zero smoothly
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.15); // fade in
    gainNode.gain.setValueAtTime(0.25, startTime + duration - 0.4);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // fade out

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    return {
      stop: () => {
        try {
          osc.stop();
          audioCtx.close();
        } catch (e) {
          // ignore already stopped state
        }
      }
    };
  } catch (error) {
    console.error("Web Audio API siren activation failed:", error);
    return null;
  }
}
