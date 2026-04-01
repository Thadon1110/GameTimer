import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore, type AlertMode, type Ringtone } from '@/stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

export function useEyeBreak() {
	const { eyeBreakEnabled, eyeBreakInterval, eyeBreakDuration, eyeBreakMode, soundEnabled, soundRingtone, fullscreenOpacity } = useSettingsStore();

	const eyeBreakIntervalSec = eyeBreakInterval * 60;
	const eyeBreakDurationSec = eyeBreakDuration * 60;

	const [secondsSinceBreak, setSecondsSinceBreak] = useState(0);
	const [isInBreak, setIsInBreak] = useState(false);
	const [breakRemaining, setBreakRemaining] = useState(0);
	const notifiedThisCycle = useRef(false);

	// Countdown to next break (or remaining break time)
	const countdown = isInBreak ? breakRemaining : Math.max(0, eyeBreakIntervalSec - secondsSinceBreak);
	const progress = isInBreak ? 100 : eyeBreakIntervalSec > 0 ? (secondsSinceBreak / eyeBreakIntervalSec) * 100 : 0;

	const playSound = useCallback(() => {
		if (!soundEnabled) return;
		try {
			const ctx = new AudioContext();
			const t = ctx.currentTime;
			const ringtones: Record<Ringtone, () => void> = {
				gentle: () => {
					[392, 523.25, 659.25].forEach((freq, i) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.value = freq;
						osc.connect(gain);
						gain.connect(ctx.destination);
						const s = t + i * 0.2;
						gain.gain.setValueAtTime(0, s);
						gain.gain.linearRampToValueAtTime(0.2, s + 0.06);
						gain.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
						osc.start(s);
						osc.stop(s + 0.5);
					});
				},
				chime: () => {
					[0, 0.3].forEach((offset, idx) => {
						const freq = idx === 0 ? 1046.5 : 1318.5;
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.value = freq;
						osc.connect(gain);
						gain.connect(ctx.destination);
						gain.gain.setValueAtTime(0, t + offset);
						gain.gain.linearRampToValueAtTime(0.15, t + offset + 0.02);
						gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.8);
						osc.start(t + offset);
						osc.stop(t + offset + 0.8);
					});
				},
				bell: () => {
					[220, 440, 660, 880].forEach((freq, i) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.value = freq;
						osc.connect(gain);
						gain.connect(ctx.destination);
						const vol = 0.18 / (i + 1);
						gain.gain.setValueAtTime(0, t);
						gain.gain.linearRampToValueAtTime(vol, t + 0.005);
						gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
						osc.start(t);
						osc.stop(t + 1.5);
					});
				},
				ping: () => {
					[0, 0.12].forEach((offset) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.setValueAtTime(1760, t + offset);
						osc.frequency.exponentialRampToValueAtTime(880, t + offset + 0.08);
						osc.connect(gain);
						gain.connect(ctx.destination);
						gain.gain.setValueAtTime(0, t + offset);
						gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.005);
						gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.25);
						osc.start(t + offset);
						osc.stop(t + offset + 0.25);
					});
				},
				'soft-alert': () => {
					const melody: [number, number][] = [
						[440, 0],
						[554.37, 0.18],
						[659.25, 0.36],
					];
					melody.forEach(([freq, offset]) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'triangle';
						osc.frequency.value = freq;
						osc.connect(gain);
						gain.connect(ctx.destination);
						const s = t + offset;
						gain.gain.setValueAtTime(0, s);
						gain.gain.linearRampToValueAtTime(0.18, s + 0.04);
						gain.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
						osc.start(s);
						osc.stop(s + 0.55);
					});
				},
			};
			ringtones[soundRingtone]();
		} catch {
			/* ignore */
		}
	}, [soundEnabled, soundRingtone]);

	const triggerAlert = useCallback(
		async (title: string, body: string, mode: AlertMode, toastType: string, durationSecs: number) => {
			playSound();
			if (mode === 'toast') {
				try {
					await invoke('show_toast', { title, body, toastType, durationSecs });
				} catch {
					/* ignore */
				}
			} else if (mode === 'fullscreen') {
				try {
					await invoke('show_fullscreen_alert', { title, body, toastType, durationSecs, opacity: fullscreenOpacity });
				} catch {
					/* ignore */
				}
			}
		},
		[playSound, fullscreenOpacity],
	);

	// Main tick — runs every second when enabled
	useEffect(() => {
		if (!eyeBreakEnabled) return;

		const iv = setInterval(() => {
			if (isInBreak) {
				setBreakRemaining((prev) => {
					if (prev <= 1) {
						setIsInBreak(false);
						setSecondsSinceBreak(0);
						notifiedThisCycle.current = false;
						return 0;
					}
					return prev - 1;
				});
			} else {
				setSecondsSinceBreak((prev) => prev + 1);
			}
		}, 1000);

		return () => clearInterval(iv);
	}, [eyeBreakEnabled, isInBreak]);

	// Trigger notification when interval reached
	useEffect(() => {
		if (!eyeBreakEnabled || isInBreak || notifiedThisCycle.current) return;
		if (secondsSinceBreak >= eyeBreakIntervalSec) {
			notifiedThisCycle.current = true;
			setIsInBreak(true);
			setBreakRemaining(eyeBreakDurationSec);
			triggerAlert(
				'Czas na przerwę dla oczu',
				`Siedzisz już od ${eyeBreakInterval} minut. Oderwij wzrok od ekranu na ${eyeBreakDuration} min.`,
				eyeBreakMode,
				'eyebreak',
				eyeBreakDurationSec,
			);
		}
	}, [
		secondsSinceBreak,
		eyeBreakEnabled,
		eyeBreakIntervalSec,
		eyeBreakDurationSec,
		eyeBreakInterval,
		eyeBreakDuration,
		eyeBreakMode,
		isInBreak,
		triggerAlert,
	]);

	// Reset when settings change
	useEffect(() => {
		setSecondsSinceBreak(0);
		setIsInBreak(false);
		setBreakRemaining(0);
		notifiedThisCycle.current = false;
	}, [eyeBreakInterval, eyeBreakDuration]);

	return {
		eyeBreakEnabled,
		isInBreak,
		countdown,
		progress: Math.min(100, progress),
	};
}
