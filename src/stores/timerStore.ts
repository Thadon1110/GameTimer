import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GameSession {
	id: string;
	gameName: string;
	startTime: number;
	endTime: number | null;
	duration: number;
	breaks: Break[];
}

export interface Break {
	startTime: number;
	endTime: number | null;
	duration: number;
}

interface TimerState {
	isRunning: boolean;
	isPaused: boolean;
	currentSession: GameSession | null;
	elapsed: number;
	gameName: string;
	sessions: GameSession[];
	/** Timestamp of last tick — used to recover elapsed on restart */
	lastTickAt: number | null;

	setGameName: (name: string) => void;
	startTimer: () => void;
	pauseTimer: () => void;
	resumeTimer: () => void;
	stopTimer: () => void;
	tick: () => void;
	clearSessions: () => void;
	/** Recover session state after app restart */
	recoverSession: () => void;
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export const useTimerStore = create<TimerState>()(
	persist(
		(set, get) => ({
			isRunning: false,
			isPaused: false,
			currentSession: null,
			elapsed: 0,
			gameName: '',
			sessions: [],
			lastTickAt: null,

			setGameName: (name: string) => set({ gameName: name }),

			startTimer: () => {
				const { gameName } = get();
				const session: GameSession = {
					id: generateId(),
					gameName: gameName || 'Bez nazwy',
					startTime: Date.now(),
					endTime: null,
					duration: 0,
					breaks: [],
				};
				set({ isRunning: true, isPaused: false, currentSession: session, elapsed: 0, lastTickAt: Date.now() });
			},

			pauseTimer: () => {
				const { currentSession, elapsed } = get();
				if (!currentSession) return;

				const breakEntry: Break = {
					startTime: Date.now(),
					endTime: null,
					duration: 0,
				};

				set({
					isPaused: true,
					currentSession: {
						...currentSession,
						duration: elapsed,
						breaks: [...currentSession.breaks, breakEntry],
					},
				});
			},

			resumeTimer: () => {
				const { currentSession } = get();
				if (!currentSession) return;

				const breaks = [...currentSession.breaks];
				const lastBreak = breaks[breaks.length - 1];
				if (lastBreak && !lastBreak.endTime) {
					lastBreak.endTime = Date.now();
					lastBreak.duration = lastBreak.endTime - lastBreak.startTime;
				}

				set({
					isPaused: false,
					currentSession: { ...currentSession, breaks },
				});
			},

			stopTimer: () => {
				const { currentSession, elapsed, sessions } = get();
				if (!currentSession) return;

				const finishedSession: GameSession = {
					...currentSession,
					endTime: Date.now(),
					duration: elapsed,
					breaks: currentSession.breaks.map((b) => (b.endTime ? b : { ...b, endTime: Date.now(), duration: Date.now() - b.startTime })),
				};

				set({
					isRunning: false,
					isPaused: false,
					currentSession: null,
					elapsed: 0,
					sessions: [finishedSession, ...sessions],
				});
			},

			tick: () => {
				const { isRunning, isPaused, elapsed } = get();
				if (isRunning && !isPaused) {
					set({ elapsed: elapsed + 1, lastTickAt: Date.now() });
				}
			},

			clearSessions: () => set({ sessions: [] }),

			recoverSession: () => {
				const { isRunning, isPaused, currentSession, elapsed, lastTickAt } = get();
				if (!isRunning || !currentSession) return;

				if (isPaused) {
					// Was paused — keep as is, no time to add
					return;
				}

				// Calculate how many seconds passed since last tick
				if (lastTickAt) {
					const missedSeconds = Math.floor((Date.now() - lastTickAt) / 1000);
					if (missedSeconds > 0) {
						set({ elapsed: elapsed + missedSeconds, lastTickAt: Date.now() });
					}
				} else {
					// No lastTickAt — estimate from startTime
					const totalBreakMs = currentSession.breaks.reduce((sum, b) => {
						const end = b.endTime ?? Date.now();
						return sum + (end - b.startTime);
					}, 0);
					const activeMs = Date.now() - currentSession.startTime - totalBreakMs;
					const recoveredElapsed = Math.max(elapsed, Math.floor(activeMs / 1000));
					set({ elapsed: recoveredElapsed, lastTickAt: Date.now() });
				}
			},
		}),
		{
			name: 'gametimer-storage',
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				sessions: state.sessions,
				gameName: state.gameName,
				isRunning: state.isRunning,
				isPaused: state.isPaused,
				currentSession: state.currentSession,
				elapsed: state.elapsed,
				lastTickAt: state.lastTickAt,
			}),
		},
	),
);
