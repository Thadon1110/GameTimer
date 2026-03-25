import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AlertMode = 'toast' | 'fullscreen';
export type Ringtone = 'gentle' | 'chime' | 'bell' | 'ping' | 'soft-alert';

interface SettingsState {
	// Onboarding
	onboardingCompleted: boolean;
	setOnboardingCompleted: (v: boolean) => void;

	// Daily gaming limit
	dailyLimitEnabled: boolean;
	dailyLimitMinutes: number; // e.g. 120 = 2h
	dailyLimitMode: AlertMode;

	// Eye breaks (e.g. 45 min work → 2 min break)
	eyeBreakEnabled: boolean;
	eyeBreakInterval: number; // minutes between breaks
	eyeBreakDuration: number; // break duration in minutes
	eyeBreakMode: AlertMode;

	// Fullscreen
	fullscreenOpacity: number; // 10-100

	// Sound
	soundEnabled: boolean;
	soundRingtone: Ringtone;

	theme: 'dark' | 'light';

	// Daily limit actions
	setDailyLimitEnabled: (v: boolean) => void;
	setDailyLimitMinutes: (v: number) => void;
	setDailyLimitMode: (v: AlertMode) => void;

	// Eye break actions
	setEyeBreakEnabled: (v: boolean) => void;
	setEyeBreakInterval: (v: number) => void;
	setEyeBreakDuration: (v: number) => void;
	setEyeBreakMode: (v: AlertMode) => void;

	// Fullscreen actions
	setFullscreenOpacity: (v: number) => void;

	// Sound actions
	toggleSound: () => void;
	setSoundRingtone: (v: Ringtone) => void;
	setTheme: (theme: 'dark' | 'light') => void;
}

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			onboardingCompleted: false,
			setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),

			dailyLimitEnabled: true,
			dailyLimitMinutes: 120,
			dailyLimitMode: 'toast',

			eyeBreakEnabled: true,
			eyeBreakInterval: 45,
			eyeBreakDuration: 2,
			eyeBreakMode: 'toast',

			fullscreenOpacity: 96,

			soundEnabled: true,
			soundRingtone: 'gentle',
			theme: 'dark',

			setDailyLimitEnabled: (v) => set({ dailyLimitEnabled: v }),
			setDailyLimitMinutes: (v) => set({ dailyLimitMinutes: v }),
			setDailyLimitMode: (v) => set({ dailyLimitMode: v }),

			setEyeBreakEnabled: (v) => set({ eyeBreakEnabled: v }),
			setEyeBreakInterval: (v) => set({ eyeBreakInterval: v }),
			setEyeBreakDuration: (v) => set({ eyeBreakDuration: v }),
			setEyeBreakMode: (v) => set({ eyeBreakMode: v }),

			setFullscreenOpacity: (v) => set({ fullscreenOpacity: v }),

			toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
			setSoundRingtone: (v) => set({ soundRingtone: v }),
			setTheme: (theme) => set({ theme }),
		}),
		{
			name: 'gametimer-settings',
			version: 6,
			storage: createJSONStorage(() => localStorage),
			migrate: (persisted: unknown, version: number) => {
				const state = persisted as Record<string, unknown>;
				if (version < 6) {
					state.onboardingCompleted = true;
				}
				return state as unknown as SettingsState;
			},
		},
	),
);
