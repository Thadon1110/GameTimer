import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useGameDetection } from '@/hooks/useGameDetection';
import { check } from '@tauri-apps/plugin-updater';

export default function Layout() {
	// Run game detection globally
	useGameDetection();

	// Silent update check on app start
	useEffect(() => {
		check()
			.then((update) => {
				if (update) {
					console.log(`Update available: ${update.version}`);
				}
			})
			.catch(() => {});
	}, []);

	return (
		<div className='flex h-screen flex-col'>
			<main className='flex-1 overflow-y-auto px-5 pt-6 pb-4'>
				<Outlet />
			</main>
			<Navigation />
		</div>
	);
}
