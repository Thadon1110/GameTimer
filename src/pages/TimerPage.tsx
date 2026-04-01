import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MonitorPlay, MonitorOff, Library, Timer, Eye } from 'lucide-react';
import { useTimerStore } from '@/stores/timerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGameLibraryStore } from '@/stores/gameLibraryStore';
import { useBreakReminder } from '@/hooks/useBreakReminder';
import { formatTime } from '@/utils/time';
import { useNavigate, useOutletContext } from 'react-router-dom';

type EyeBreakContext = {
	isInBreak: boolean;
	countdown: number;
	progress: number;
	eyeBreakEnabled: boolean;
};

export default function TimerPage() {
	const { isRunning, isPaused, elapsed, gameName, tick, recoverSession } = useTimerStore();
	const { detectedGame, games } = useGameLibraryStore();
	const { dailyLimitEnabled } = useSettingsStore();
	const navigate = useNavigate();

	const { todayTotal, dailyLimitSeconds, dailyRemaining } = useBreakReminder();
	const { isInBreak: isInEyeBreak, countdown: eyeBreakCountdown, progress: eyeBreakProgress, eyeBreakEnabled } = useOutletContext<EyeBreakContext>();

	// Recover session on app startup (handles app/PC restart)
	useEffect(() => {
		recoverSession();
	}, [recoverSession]);

	// Tick every second
	useEffect(() => {
		if (!isRunning || isPaused) return;
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [isRunning, isPaused, tick]);

	// Immediately update elapsed when window regains focus
	useEffect(() => {
		if (!isRunning || isPaused) return;
		const onVisible = () => {
			if (document.visibilityState === 'visible') tick();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	}, [isRunning, isPaused, tick]);

	const dailyProgress = dailyLimitEnabled ? Math.min(100, (todayTotal / dailyLimitSeconds) * 100) : 0;

	// Not playing — idle state
	if (!isRunning) {
		return (
			<div className='flex h-full flex-col items-center justify-center gap-6 px-5'>
				<motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className='flex flex-col items-center gap-6'>
					<div className='flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--color-border)] bg-[var(--color-bg-card)]'>
						<MonitorOff size={40} className='text-[var(--color-text-muted)]' />
					</div>

					<div className='flex flex-col items-center gap-2'>
						<h2 className='text-xl font-semibold text-[var(--color-text)]'>Nie grasz teraz</h2>
						<p className='text-center text-sm text-[var(--color-text-muted)]'>Uruchom grę — czas zostanie zmierzony automatycznie</p>
					</div>

					{games.length === 0 ? (
						<div className='flex flex-col items-center gap-3'>
							<p className='text-center text-xs text-[var(--color-text-muted)]'>
								Nie masz żadnych gier w bibliotece.
								<br />
								Dodaj gry, żeby aplikacja mogła je wykrywać.
							</p>
							<motion.button
								whileHover={{ scale: 1.03 }}
								whileTap={{ scale: 0.97 }}
								onClick={() => navigate('/library')}
								className='flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
							>
								<Library size={18} />
								Przejdź do biblioteki
							</motion.button>
						</div>
					) : (
						<div className='w-full max-w-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3'>
							<p className='text-xs font-medium text-[var(--color-text-muted)]'>Śledzonych gier: {games.length}</p>
						</div>
					)}
				</motion.div>

				<div className='flex items-center gap-2'>
					<span className='h-2 w-2 rounded-full bg-[var(--color-text-muted)]' />
					<span className='text-xs text-[var(--color-text-muted)]'>Oczekiwanie na grę...</span>
				</div>
			</div>
		);
	}

	// Playing — active timer
	return (
		<div className='relative flex h-full flex-col items-center px-5 pt-4'>
			{/* Detected game banner */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className='flex items-center gap-2 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-5 py-2'
			>
				<MonitorPlay size={16} className='text-[var(--color-success)]' />
				<span className='text-sm font-medium text-[var(--color-success)]'>
					Grasz w: <strong>{gameName || detectedGame?.name || 'Grę'}</strong>
				</span>
			</motion.div>

			{/* Timer display with circular progress */}
			<motion.div
				className='relative my-auto flex items-center justify-center'
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
			>
				<svg className='pointer-events-none absolute h-52 w-52' viewBox='0 0 200 200'>
					<circle cx='100' cy='100' r='90' fill='none' stroke='var(--color-border)' strokeWidth='3' />
					{dailyLimitEnabled && (
						<circle
							cx='100'
							cy='100'
							r='90'
							fill='none'
							stroke={dailyRemaining <= 0 ? '#ef4444' : 'var(--color-primary)'}
							strokeWidth='3'
							strokeLinecap='round'
							strokeDasharray={`${2 * Math.PI * 90}`}
							strokeDashoffset={`${2 * Math.PI * 90 * (1 - dailyProgress / 100)}`}
							transform='rotate(-90 100 100)'
							className='transition-all duration-1000'
						/>
					)}
					{eyeBreakEnabled && (
						<circle
							cx='100'
							cy='100'
							r='82'
							fill='none'
							stroke={isInEyeBreak ? '#60a5fa' : 'var(--color-border)'}
							strokeWidth='2'
							strokeLinecap='round'
							strokeDasharray={`${2 * Math.PI * 82}`}
							strokeDashoffset={`${2 * Math.PI * 82 * (1 - Math.min(100, eyeBreakProgress) / 100)}`}
							transform='rotate(-90 100 100)'
							className='transition-all duration-1000'
							opacity={0.6}
						/>
					)}
				</svg>
				<div className='flex flex-col items-center'>
					<span className='font-mono text-5xl font-bold tracking-wider text-[var(--color-text)]'>{formatTime(elapsed)}</span>
				</div>
			</motion.div>

			{/* Info cards */}
			<div className='mb-4 flex w-full max-w-xs flex-col gap-2'>
				{dailyLimitEnabled && (
					<div className='flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5'>
						<div className='flex items-center gap-2'>
							<Timer size={14} className={dailyRemaining <= 0 ? 'text-red-400' : 'text-[var(--color-primary)]'} />
							<span className='text-xs text-[var(--color-text-muted)]'>Dzienny limit</span>
						</div>
						<span className={`font-mono text-sm font-semibold ${dailyRemaining <= 0 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
							{dailyRemaining <= 0 ? 'Przekroczony' : formatTime(dailyRemaining)}
						</span>
					</div>
				)}

				{eyeBreakEnabled && (
					<div className='flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5'>
						<div className='flex items-center gap-2'>
							<Eye size={14} className={isInEyeBreak ? 'text-blue-400' : 'text-[var(--color-primary)]'} />
							<span className='text-xs text-[var(--color-text-muted)]'>{isInEyeBreak ? 'Przerwa dla oczu' : 'Przerwa za'}</span>
						</div>
						<span className={`font-mono text-sm font-semibold ${isInEyeBreak ? 'text-blue-400' : 'text-[var(--color-text)]'}`}>
							{formatTime(eyeBreakCountdown)}
						</span>
					</div>
				)}
			</div>

			{/* Status indicator */}
			<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className='mb-4 flex items-center gap-2'>
				<span className='h-2 w-2 animate-pulse rounded-full bg-[var(--color-success)]' />
				<span className='text-xs text-[var(--color-text-muted)]'>Sesja aktywna — automatyczne śledzenie</span>
			</motion.div>
		</div>
	);
}
