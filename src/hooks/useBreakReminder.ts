import { useEffect, useRef, useCallback } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { useSettingsStore, type AlertMode, type Ringtone } from '@/stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

export function useBreakReminder() {
	const { isRunning, isPaused, elapsed, sessions } = useTimerStore();
	const { dailyLimitEnabled, dailyLimitMinutes, dailyLimitMode, soundEnabled, soundRingtone, fullscreenOpacity } = useSettingsStore();

	const dailyLimitNotified = useRef(false);

	// Calculate today's total gaming time (seconds)
	const todayTotal = (() => {
		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const pastToday = sessions.filter((s) => s.startTime >= startOfDay).reduce((sum, s) => sum + s.duration, 0);
		return pastToday + (isRunning ? elapsed : 0);
	})();

	const dailyLimitSeconds = dailyLimitMinutes * 60;
	const dailyRemaining = Math.max(0, dailyLimitSeconds - todayTotal);

	const playSound = useCallback(
		(overrideRingtone?: Ringtone) => {
			if (!soundEnabled) return;
			const ringtone = overrideRingtone ?? soundRingtone;
			try {
				const ctx = new AudioContext();
				const t = ctx.currentTime;

				const ringtones: Record<Ringtone, () => void> = {
					// Delikatne trzy tony rosnące
					gentle: () => {
						const notes = [392, 523.25, 659.25];
						notes.forEach((freq, i) => {
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
					// Dzwonek — podwójny ping z rezonansem
					chime: () => {
						[0, 0.3].forEach((offset, idx) => {
							const freq = idx === 0 ? 1046.5 : 1318.5; // C6, E6
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
					// Dzwon — głęboki z harmonicznymi
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
					// Podwójny ping — wyrazisty
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
					// Miękkie trzy nuty — ciepły triangle
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

				ringtones[ringtone]();
			} catch {
				// AudioContext not available
			}
		},
		[soundEnabled, soundRingtone],
	);

	const triggerAlert = useCallback(
		async (title: string, body: string, mode: AlertMode, toastType: string, durationSecs?: number) => {
			playSound();
			if (mode === 'toast') {
				try {
					await invoke('show_toast', { title, body, toastType, durationSecs: durationSecs ?? 0 });
				} catch {
					/* ignore */
				}
			} else if (mode === 'fullscreen') {
				try {
					await invoke('show_fullscreen_alert', { title, body, toastType, durationSecs: durationSecs ?? 0, opacity: fullscreenOpacity });
				} catch {
					/* ignore */
				}
			}
		},
		[playSound, fullscreenOpacity],
	);

	const sendTestAlert = useCallback(
		(title: string, body: string, mode: AlertMode) => {
			triggerAlert(title, body, mode, 'info', 10);
		},
		[triggerAlert],
	);

	// Daily limit check
	useEffect(() => {
		if (!isRunning || isPaused || !dailyLimitEnabled) return;
		if (dailyRemaining <= 0 && !dailyLimitNotified.current) {
			dailyLimitNotified.current = true;
			triggerAlert(
				'Limit dzienny wyczerpany',
				`Twój dzienny limit ${dailyLimitMinutes} minut grania dobiegł końca. Czas na odpoczynek!`,
				dailyLimitMode,
				'daily',
			);
		}
	}, [isRunning, isPaused, dailyLimitEnabled, dailyRemaining, dailyLimitMode, dailyLimitMinutes, triggerAlert]);

	// Reset daily limit notification at midnight
	useEffect(() => {
		dailyLimitNotified.current = false;
	}, [new Date().toDateString()]);

	return {
		todayTotal,
		dailyLimitSeconds,
		dailyRemaining,
		sendTestAlert,
		playSound,
	};
}
