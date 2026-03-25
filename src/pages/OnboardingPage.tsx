import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Timer, Eye, Volume2, ChevronRight, ChevronLeft, Check, Radar, Loader2, Plus, Sparkles } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGameLibraryStore } from '@/stores/gameLibraryStore';
import { invoke } from '@tauri-apps/api/core';

interface InstalledGame {
	name: string;
	exe_name: string;
	exe_path: string;
	launcher: string;
}

const STEPS = ['welcome', 'settings', 'games', 'done'] as const;
function StepIndicator({ current, total }: { current: number; total: number }) {
	return (
		<div className='flex items-center gap-2'>
			{Array.from({ length: total }, (_, i) => (
				<div
					key={i}
					className={`h-2 rounded-full transition-all duration-300 ${
						i === current
							? 'w-8 bg-[var(--color-primary)]'
							: i < current
								? 'w-2 bg-[var(--color-primary)] opacity-50'
								: 'w-2 bg-[var(--color-border)]'
					}`}
				/>
			))}
		</div>
	);
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
	return (
		<button
			onClick={onToggle}
			className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
		>
			<div
				className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-[1.25rem]' : 'translate-x-0.5'}`}
			/>
		</button>
	);
}

function WelcomeStep() {
	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-6 text-center'>
			<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }}>
				<div className='flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--color-primary)]/20'>
					<Gamepad2 size={48} className='text-[var(--color-primary)]' />
				</div>
			</motion.div>

			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
				<h1 className='text-3xl font-bold'>Witaj w GameTimer!</h1>
				<p className='mt-3 text-[var(--color-text-muted)]'>Śledź czas grania, ustawiaj limity i dbaj o zdrowie oczu.</p>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.4 }}
				className='mt-4 flex flex-col gap-3 text-left'
			>
				{[
					{ icon: Timer, text: 'Automatyczne śledzenie czasu gry' },
					{ icon: Eye, text: 'Przypomnienia o przerwach dla oczu' },
					{ icon: Volume2, text: 'Powiadomienia dźwiękowe i wizualne' },
				].map(({ icon: Icon, text }, i) => (
					<div key={i} className='flex items-center gap-3 text-sm'>
						<Icon size={18} className='text-[var(--color-primary)]' />
						<span>{text}</span>
					</div>
				))}
			</motion.div>
		</div>
	);
}

function SettingsStep() {
	const {
		dailyLimitEnabled,
		dailyLimitMinutes,
		setDailyLimitEnabled,
		setDailyLimitMinutes,
		eyeBreakEnabled,
		eyeBreakInterval,
		setEyeBreakEnabled,
		setEyeBreakInterval,
		soundEnabled,
		toggleSound,
	} = useSettingsStore();

	return (
		<div className='flex flex-1 flex-col gap-5'>
			<div className='text-center'>
				<h2 className='text-2xl font-bold'>Dostosuj ustawienia</h2>
				<p className='mt-1 text-sm text-[var(--color-text-muted)]'>Możesz to zmienić później w ustawieniach</p>
			</div>

			<div className='flex flex-col gap-3'>
				{/* Daily limit */}
				<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<Timer size={20} className='text-[var(--color-primary)]' />
							<div>
								<div className='text-sm font-medium'>Dzienny limit grania</div>
								<div className='text-xs text-[var(--color-text-muted)]'>Ogranicz czas grania na dzień</div>
							</div>
						</div>
						<Toggle enabled={dailyLimitEnabled} onToggle={() => setDailyLimitEnabled(!dailyLimitEnabled)} />
					</div>
					{dailyLimitEnabled && (
						<div className='mt-3 flex items-center gap-3 border-t border-[var(--color-border)] pt-3'>
							<span className='text-xs text-[var(--color-text-muted)]'>Limit:</span>
							<div className='flex items-center gap-2'>
								{[60, 120, 180, 240].map((mins) => (
									<button
										key={mins}
										onClick={() => setDailyLimitMinutes(mins)}
										className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
											dailyLimitMinutes === mins
												? 'bg-[var(--color-primary)] text-white'
												: 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
										}`}
									>
										{mins / 60}h
									</button>
								))}
								<input
									type='number'
									min={15}
									max={720}
									value={dailyLimitMinutes}
									onChange={(e) => {
										const v = parseInt(e.target.value);
										if (!isNaN(v) && v >= 15 && v <= 720) setDailyLimitMinutes(v);
									}}
									className='w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-center text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]'
									placeholder='min'
								/>
							</div>
						</div>
					)}
				</div>

				{/* Eye breaks */}
				<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<Eye size={20} className='text-[var(--color-primary)]' />
							<div>
								<div className='text-sm font-medium'>Przerwy dla oczu</div>
								<div className='text-xs text-[var(--color-text-muted)]'>Regularne przerwy od ekranu</div>
							</div>
						</div>
						<Toggle enabled={eyeBreakEnabled} onToggle={() => setEyeBreakEnabled(!eyeBreakEnabled)} />
					</div>
					{eyeBreakEnabled && (
						<div className='mt-3 flex items-center gap-3 border-t border-[var(--color-border)] pt-3'>
							<span className='text-xs text-[var(--color-text-muted)]'>Co:</span>
							<div className='flex items-center gap-2'>
								{[20, 30, 45, 60].map((mins) => (
									<button
										key={mins}
										onClick={() => setEyeBreakInterval(mins)}
										className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
											eyeBreakInterval === mins
												? 'bg-[var(--color-primary)] text-white'
												: 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
										}`}
									>
										{mins} min
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Sound */}
				<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<Volume2 size={20} className='text-[var(--color-primary)]' />
							<div>
								<div className='text-sm font-medium'>Dźwięki powiadomień</div>
								<div className='text-xs text-[var(--color-text-muted)]'>Sygnał dźwiękowy przy alertach</div>
							</div>
						</div>
						<Toggle enabled={soundEnabled} onToggle={toggleSound} />
					</div>
				</div>
			</div>
		</div>
	);
}

function GamesStep() {
	const [scanning, setScanning] = useState(false);
	const [scannedGames, setScannedGames] = useState<InstalledGame[]>([]);
	const [hasScanned, setHasScanned] = useState(false);
	const { addGame, removeGame, games } = useGameLibraryStore();

	const handleScan = async () => {
		setScanning(true);
		try {
			const result = await invoke<InstalledGame[]>('scan_installed_games');
			setScannedGames(result);
		} catch {
			setScannedGames([]);
		}
		setScanning(false);
		setHasScanned(true);
	};

	const isAdded = (exe: string) => games.some((g) => g.processName.toLowerCase() === exe.toLowerCase());

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-5'>
			<div className='shrink-0 text-center'>
				<h2 className='text-2xl font-bold'>Dodaj swoje gry</h2>
				<p className='mt-1 text-sm text-[var(--color-text-muted)]'>Zeskanuj zainstalowane gry lub dodaj je później</p>
			</div>

			{!hasScanned ? (
				<div className='flex flex-1 flex-col items-center justify-center gap-4'>
					<motion.button
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
						onClick={handleScan}
						disabled={scanning}
						className='flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--color-primary)] px-6 py-4 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50'
					>
						{scanning ? <Loader2 size={20} className='animate-spin' /> : <Radar size={20} />}
						{scanning ? 'Skanowanie...' : 'Skanuj zainstalowane gry'}
					</motion.button>
					<p className='text-xs text-[var(--color-text-muted)]'>Sprawdzi Steam, Epic, GOG, EA, Ubisoft, Riot i inne</p>
				</div>
			) : (
				<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
					{scannedGames.length === 0 ? (
						<div className='flex flex-1 flex-col items-center justify-center gap-2 text-center'>
							<Gamepad2 size={32} className='text-[var(--color-text-muted)]' />
							<p className='text-sm text-[var(--color-text-muted)]'>Nie znaleziono gier</p>
							<p className='text-xs text-[var(--color-text-muted)]'>Możesz dodać gry ręcznie w bibliotece</p>
						</div>
					) : (
						<>
							<div className='text-xs text-[var(--color-text-muted)]'>Znaleziono {scannedGames.length} gier — kliknij aby dodać</div>
							<div className='flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1'>
								{scannedGames.map((game) => {
									const added = isAdded(game.exe_name);
									return (
										<button
											key={game.exe_path}
											onClick={() => {
												if (added) {
													const existing = games.find((g) => g.processName.toLowerCase() === game.exe_name.toLowerCase());
													if (existing) removeGame(existing.id);
												} else {
													addGame(game.name, game.exe_name);
												}
											}}
											className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
												added
													? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10'
													: 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)]'
											}`}
										>
											<Gamepad2 size={16} className={added ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
											<div className='flex-1 overflow-hidden'>
												<div className='truncate text-sm font-medium'>{game.name}</div>
												<div className='truncate text-xs text-[var(--color-text-muted)]'>{game.launcher}</div>
											</div>
											{added ? (
												<Check size={16} className='text-[var(--color-success)]' />
											) : (
												<Plus size={16} className='text-[var(--color-text-muted)]' />
											)}
										</button>
									);
								})}
							</div>
						</>
					)}

					{games.length > 0 && (
						<div className='shrink-0 rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-center text-xs text-[var(--color-primary)]'>
							Dodano {games.length} {games.length === 1 ? 'grę' : games.length < 5 ? 'gry' : 'gier'}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function DoneStep() {
	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-6 text-center'>
			<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }}>
				<div className='flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--color-success)]/20'>
					<Sparkles size={48} className='text-[var(--color-success)]' />
				</div>
			</motion.div>

			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
				<h1 className='text-3xl font-bold'>Gotowe!</h1>
				<p className='mt-3 text-[var(--color-text-muted)]'>Wszystko skonfigurowane. GameTimer będzie automatycznie wykrywał gry i śledzić czas.</p>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5 }}
				className='mt-2 text-xs text-[var(--color-text-muted)]'
			>
				Ustawienia możesz zmienić w dowolnym momencie
			</motion.div>
		</div>
	);
}

export default function OnboardingPage() {
	const [stepIndex, setStepIndex] = useState(0);
	const { setOnboardingCompleted } = useSettingsStore();
	const step = STEPS[stepIndex];

	const next = () => {
		if (stepIndex === STEPS.length - 1) {
			setOnboardingCompleted(true);
		} else {
			setStepIndex((i) => i + 1);
		}
	};

	const prev = () => setStepIndex((i) => Math.max(0, i - 1));

	const canGoBack = stepIndex > 0 && step !== 'done';

	return (
		<div className='flex h-screen flex-col px-6 py-8'>
			{/* Progress */}
			<div className='flex justify-center'>
				<StepIndicator current={stepIndex} total={STEPS.length} />
			</div>

			{/* Content */}
			<div className='flex flex-1 overflow-hidden'>
				<AnimatePresence mode='wait'>
					<motion.div
						key={step}
						initial={{ opacity: 0, x: 40 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -40 }}
						transition={{ duration: 0.25 }}
						className='flex flex-1 flex-col py-6'
					>
						{step === 'welcome' && <WelcomeStep />}
						{step === 'settings' && <SettingsStep />}
						{step === 'games' && <GamesStep />}
						{step === 'done' && <DoneStep />}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Navigation */}
			<div className='flex items-center justify-between pt-4'>
				{canGoBack ? (
					<button
						onClick={prev}
						className='flex cursor-pointer items-center gap-1 rounded-xl px-4 py-3 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
					>
						<ChevronLeft size={16} />
						Wstecz
					</button>
				) : (
					<div />
				)}

				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					onClick={next}
					className='flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]'
				>
					{step === 'done' ? (
						<>
							Zaczynamy!
							<Check size={16} />
						</>
					) : step === 'welcome' ? (
						<>
							Zaczynajmy
							<ChevronRight size={16} />
						</>
					) : (
						<>
							Dalej
							<ChevronRight size={16} />
						</>
					)}
				</motion.button>
			</div>

			{/* Skip */}
			{step !== 'done' && (
				<button
					onClick={() => setOnboardingCompleted(true)}
					className='mt-2 cursor-pointer text-center text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
				>
					Pomiń konfigurację
				</button>
			)}
		</div>
	);
}
