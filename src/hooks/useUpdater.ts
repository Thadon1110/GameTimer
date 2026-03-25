import { useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error';

interface UpdateInfo {
	version: string;
	body: string;
}

export function useUpdater() {
	const [status, setStatus] = useState<UpdateStatus>('idle');
	const [progress, setProgress] = useState(0);
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	const checkForUpdates = useCallback(async (silent = false) => {
		try {
			setStatus('checking');
			setError(null);

			const update = await check();

			if (update) {
				setUpdateInfo({ version: update.version, body: update.body || '' });
				setStatus('available');
				return true;
			} else {
				setStatus('up-to-date');
				return false;
			}
		} catch (e) {
			if (!silent) {
				setError(e instanceof Error ? e.message : 'Błąd sprawdzania aktualizacji');
				setStatus('error');
			} else {
				setStatus('idle');
			}
			return false;
		}
	}, []);

	const downloadAndInstall = useCallback(async () => {
		try {
			setStatus('downloading');
			setProgress(0);

			const update = await check();
			if (!update) return;

			let totalLength = 0;
			let downloaded = 0;

			await update.downloadAndInstall((event) => {
				if (event.event === 'Started' && event.data.contentLength) {
					totalLength = event.data.contentLength;
				} else if (event.event === 'Progress') {
					downloaded += event.data.chunkLength;
					if (totalLength > 0) {
						setProgress(Math.round((downloaded / totalLength) * 100));
					}
				} else if (event.event === 'Finished') {
					setProgress(100);
				}
			});

			setStatus('ready');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Błąd pobierania aktualizacji');
			setStatus('error');
		}
	}, []);

	const restartApp = useCallback(async () => {
		await relaunch();
	}, []);

	return { status, progress, updateInfo, error, checkForUpdates, downloadAndInstall, restartApp };
}
