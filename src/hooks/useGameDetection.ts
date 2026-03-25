import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGameLibraryStore } from '@/stores/gameLibraryStore';
import { useTimerStore } from '@/stores/timerStore';

interface RunningProcess {
	name: string;
	exe: string;
}

export function useGameDetection() {
	const { games, detectedGame, setDetectedGame } = useGameLibraryStore();
	const { isRunning, startTimer, stopTimer, setGameName } = useTimerStore();
	const prevDetected = useRef<string | null>(null);

	useEffect(() => {
		let active = true;

		async function detectGames() {
			try {
				const processes: RunningProcess[] = await invoke('get_running_processes');
				const processNames = processes.map((p) => p.name.toLowerCase());

				// Find first matching game from library
				// Also check for BattlEye variants (GameName_BE.exe)
				const found = games.find((game) => {
					const name = game.processName.toLowerCase();
					if (processNames.includes(name)) return true;
					// BattlEye anti-cheat wraps the exe as Name_BE.exe
					const beName = name.replace('.exe', '_be.exe');
					return processNames.includes(beName);
				});

				if (!active) return;

				if (found) {
					if (prevDetected.current !== found.processName) {
						prevDetected.current = found.processName;
						setDetectedGame(found);

						// Auto-start timer if not already running
						if (!isRunning) {
							setGameName(found.name);
							startTimer();
						}
					}
				} else {
					if (prevDetected.current !== null) {
						prevDetected.current = null;
						setDetectedGame(null);

						// Auto-stop timer if running
						if (isRunning) {
							stopTimer();
						}
					}
				}
			} catch {
				// Tauri API not available (running in browser) — skip
			}
		}

		detectGames();
		const interval = setInterval(detectGames, 5000); // Check every 5s

		return () => {
			active = false;
			clearInterval(interval);
		};
	}, [games, isRunning, setDetectedGame, setGameName, startTimer, stopTimer]);

	return { detectedGame };
}
