import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useGameDetection } from '@/hooks/useGameDetection';
import { useEyeBreak } from '@/hooks/useEyeBreak';
import { check } from '@tauri-apps/plugin-updater';
import { Eye } from 'lucide-react';

function formatTime(sec: number) {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Layout() {
	// Run game detection globally
	useGameDetection();

	// Eye break runs globally — always active
	const { eyeBreakEnabled, isInBreak, countdown, progress } = useEyeBreak();

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
				<Outlet context={{ isInBreak, countdown, progress, eyeBreakEnabled }} />
			</main>
			{eyeBreakEnabled && (
				<div
					className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
						isInBreak ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'
					}`}
				>
					<Eye size={14} />
					<span>{isInBreak ? `Przerwa dla oczu — ${formatTime(countdown)}` : `Przerwa za ${formatTime(countdown)}`}</span>
					<div className='ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white/10'>
						<div
							className={`h-full rounded-full transition-all ${isInBreak ? 'bg-blue-400' : 'bg-[var(--color-primary)]'}`}
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			)}
			<Navigation />
		</div>
	);
}
