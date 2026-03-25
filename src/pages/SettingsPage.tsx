import { useState, useEffect } from 'react';
import {
	Volume2,
	Clock,
	Moon,
	Eye,
	Timer,
	Shield,
	Send,
	Hourglass,
	SunDim,
	Music,
	Power,
	Download,
	RefreshCw,
	Loader2,
	CheckCircle,
	AlertTriangle,
} from 'lucide-react';
import { useSettingsStore, type AlertMode, type Ringtone } from '@/stores/settingsStore';
import { useBreakReminder } from '@/hooks/useBreakReminder';
import { useUpdater } from '@/hooks/useUpdater';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

function SettingRow({
	icon: Icon,
	label,
	description,
	children,
}: {
	icon: React.ElementType;
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className='flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 transition-colors hover:bg-[var(--color-bg-card-hover)]'>
			<div className='flex items-center gap-3'>
				<Icon size={20} className='text-[var(--color-primary)]' />
				<div>
					<div className='text-sm font-medium'>{label}</div>
					{description && <div className='text-xs text-[var(--color-text-muted)]'>{description}</div>}
				</div>
			</div>
			{children}
		</div>
	);
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
	return (
		<button
			onClick={onToggle}
			className={`relative h-7 w-12 cursor-pointer rounded-full transition-colors duration-200 ${enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
		>
			<div
				className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-[1.25rem]' : 'translate-x-0.5'}`}
			/>
		</button>
	);
}

function NumberInput({
	value,
	onChange,
	min,
	max,
	step = 5,
	unit,
}: {
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
	step?: number;
	unit: string;
}) {
	return (
		<div className='flex items-center gap-2'>
			<button
				onClick={() => onChange(Math.max(min, value - step))}
				className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
			>
				−
			</button>
			<span className='w-16 text-center font-mono text-lg'>
				{value}
				<span className='ml-1 text-xs text-[var(--color-text-muted)]'>{unit}</span>
			</span>
			<button
				onClick={() => onChange(Math.min(max, value + step))}
				className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
			>
				+
			</button>
		</div>
	);
}

function ModeSelector({ value, onChange }: { value: AlertMode; onChange: (v: AlertMode) => void }) {
	const modes: { key: AlertMode; label: string }[] = [
		{ key: 'toast', label: 'Powiadomienie' },
		{ key: 'fullscreen', label: 'Pełny ekran' },
	];
	return (
		<div className='flex gap-1 rounded-lg bg-[var(--color-bg)] p-0.5'>
			{modes.map((m) => (
				<button
					key={m.key}
					onClick={() => onChange(m.key)}
					className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${value === m.key ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
				>
					{m.label}
				</button>
			))}
		</div>
	);
}

function UpdateSection() {
	const { status, progress, updateInfo, error, checkForUpdates, downloadAndInstall, restartApp } = useUpdater();

	return (
		<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
			{status === 'idle' && (
				<button
					onClick={() => checkForUpdates()}
					className='flex w-full cursor-pointer items-center justify-center gap-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
				>
					<RefreshCw size={16} />
					Sprawdź aktualizacje
				</button>
			)}

			{status === 'checking' && (
				<div className='flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]'>
					<Loader2 size={16} className='animate-spin' />
					Sprawdzanie...
				</div>
			)}

			{status === 'up-to-date' && (
				<div className='flex items-center justify-center gap-2 text-sm text-[var(--color-success)]'>
					<CheckCircle size={16} />
					Masz najnowszą wersję
				</div>
			)}

			{status === 'available' && updateInfo && (
				<div className='flex flex-col gap-3'>
					<div className='flex items-center gap-2 text-sm'>
						<Download size={16} className='text-[var(--color-primary)]' />
						<span>
							Dostępna wersja <strong>{updateInfo.version}</strong>
						</span>
					</div>
					{updateInfo.body && <div className='rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)]'>{updateInfo.body}</div>}
					<button
						onClick={downloadAndInstall}
						className='flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]'
					>
						<Download size={16} />
						Pobierz i zainstaluj
					</button>
				</div>
			)}

			{status === 'downloading' && (
				<div className='flex flex-col gap-2'>
					<div className='flex items-center justify-between text-sm'>
						<div className='flex items-center gap-2 text-[var(--color-text-muted)]'>
							<Loader2 size={16} className='animate-spin' />
							Pobieranie...
						</div>
						<span className='font-mono text-xs text-[var(--color-text-muted)]'>{progress}%</span>
					</div>
					<div className='h-2 overflow-hidden rounded-full bg-[var(--color-bg)]'>
						<div className='h-full rounded-full bg-[var(--color-primary)] transition-all duration-300' style={{ width: `${progress}%` }} />
					</div>
				</div>
			)}

			{status === 'ready' && (
				<div className='flex flex-col gap-3'>
					<div className='flex items-center justify-center gap-2 text-sm text-[var(--color-success)]'>
						<CheckCircle size={16} />
						Aktualizacja gotowa!
					</div>
					<button
						onClick={restartApp}
						className='flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90'
					>
						<RefreshCw size={16} />
						Uruchom ponownie
					</button>
				</div>
			)}

			{status === 'error' && (
				<div className='flex flex-col gap-2'>
					<div className='flex items-center justify-center gap-2 text-sm text-[var(--color-danger)]'>
						<AlertTriangle size={16} />
						{error}
					</div>
					<button
						onClick={() => checkForUpdates()}
						className='cursor-pointer text-center text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
					>
						Spróbuj ponownie
					</button>
				</div>
			)}
		</div>
	);
}

export default function SettingsPage() {
	const {
		dailyLimitEnabled,
		dailyLimitMinutes,
		dailyLimitMode,
		fullscreenOpacity,
		setDailyLimitEnabled,
		setDailyLimitMinutes,
		setDailyLimitMode,
		eyeBreakEnabled,
		eyeBreakInterval,
		eyeBreakDuration,
		eyeBreakMode,
		setEyeBreakEnabled,
		setEyeBreakInterval,
		setEyeBreakDuration,
		setEyeBreakMode,
		setFullscreenOpacity,
		soundEnabled,
		soundRingtone,
		toggleSound,
		setSoundRingtone,
	} = useSettingsStore();

	const { sendTestAlert, playSound } = useBreakReminder();

	const [autostart, setAutostart] = useState(false);
	useEffect(() => {
		isEnabled()
			.then(setAutostart)
			.catch(() => {});
	}, []);
	const toggleAutostart = async () => {
		try {
			if (autostart) {
				await disable();
			} else {
				await enable();
			}
			setAutostart(!autostart);
		} catch {
			// ignore
		}
	};

	return (
		<div className='mx-auto flex max-w-2xl flex-col gap-4 px-1 pb-6'>
			<h1 className='text-2xl font-bold'>Ustawienia</h1>

			<div className='flex flex-col gap-3'>
				{/* Autostart */}
				<h2 className='mt-2 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Ogólne</h2>

				<SettingRow icon={Power} label='Uruchom przy starcie' description='Automatycznie uruchamiaj z systemem'>
					<Toggle enabled={autostart} onToggle={toggleAutostart} />
				</SettingRow>

				{/* Daily limit */}
				<h2 className='mt-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Dzienny limit grania</h2>

				<SettingRow icon={Timer} label='Limit dzienny' description='Ogranicz czas grania na dzień'>
					<Toggle enabled={dailyLimitEnabled} onToggle={() => setDailyLimitEnabled(!dailyLimitEnabled)} />
				</SettingRow>

				{dailyLimitEnabled && (
					<>
						<SettingRow icon={Hourglass} label='Czas limitu' description='Ile minut dziennie możesz grać'>
							<NumberInput value={dailyLimitMinutes} onChange={setDailyLimitMinutes} min={15} max={720} step={15} unit='min' />
						</SettingRow>

						<SettingRow icon={Shield} label='Tryb alertu' description='Co się stanie po przekroczeniu'>
							<ModeSelector value={dailyLimitMode} onChange={setDailyLimitMode} />
						</SettingRow>

						{dailyLimitMode === 'fullscreen' && (
							<SettingRow icon={SunDim} label='Przezroczystość' description={`Tło blokady: ${fullscreenOpacity}%`}>
								<input
									type='range'
									min={10}
									max={100}
									step={5}
									value={fullscreenOpacity}
									onChange={(e) => setFullscreenOpacity(Number(e.target.value))}
									className='w-28 accent-[var(--color-primary)]'
								/>
							</SettingRow>
						)}
					</>
				)}

				{/* Eye breaks */}
				<h2 className='mt-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Przerwy dla oczu</h2>

				<SettingRow icon={Eye} label='Przerwy dla oczu' description='Regularne przerwy od ekranu'>
					<Toggle enabled={eyeBreakEnabled} onToggle={() => setEyeBreakEnabled(!eyeBreakEnabled)} />
				</SettingRow>

				{eyeBreakEnabled && (
					<>
						<SettingRow icon={Clock} label='Interwał' description='Co ile minut przerwa'>
							<NumberInput value={eyeBreakInterval} onChange={setEyeBreakInterval} min={5} max={120} step={5} unit='min' />
						</SettingRow>

						<SettingRow icon={Clock} label='Czas przerwy' description='Jak długa przerwa'>
							<NumberInput value={eyeBreakDuration} onChange={setEyeBreakDuration} min={1} max={15} step={1} unit='min' />
						</SettingRow>

						<SettingRow icon={Shield} label='Tryb przerwy' description='Powiadomienie czy blokada ekranu'>
							<ModeSelector value={eyeBreakMode} onChange={setEyeBreakMode} />
						</SettingRow>

						{eyeBreakMode === 'fullscreen' && (
							<SettingRow icon={SunDim} label='Przezroczystość' description={`Tło blokady: ${fullscreenOpacity}%`}>
								<input
									type='range'
									min={10}
									max={100}
									step={5}
									value={fullscreenOpacity}
									onChange={(e) => setFullscreenOpacity(Number(e.target.value))}
									className='w-28 accent-[var(--color-primary)]'
								/>
							</SettingRow>
						)}
					</>
				)}

				{/* Sound */}
				<h2 className='mt-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Dźwięk</h2>

				<SettingRow icon={Volume2} label='Dźwięk' description='Sygnał dźwiękowy przy alertach'>
					<Toggle enabled={soundEnabled} onToggle={toggleSound} />
				</SettingRow>

				{soundEnabled && (
					<SettingRow icon={Music} label='Dzwonek' description='Wybierz dźwięk powiadomienia'>
						<select
							value={soundRingtone}
							onChange={(e) => {
								const val = e.target.value as Ringtone;
								setSoundRingtone(val);
								playSound(val);
							}}
							className='cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] outline-none'
						>
							<option value='gentle'>Delikatny</option>
							<option value='chime'>Dzwonek</option>
							<option value='bell'>Dzwon</option>
							<option value='ping'>Ping</option>
							<option value='soft-alert'>Miękki alert</option>
						</select>
					</SettingRow>
				)}

				{/* Test buttons */}
				<h2 className='mt-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Testowanie</h2>

				<div className='flex flex-col gap-2'>
					<button
						onClick={() => sendTestAlert('Limit dzienny wyczerpany', 'Twój dzienny limit grania dobiegł końca. Czas na odpoczynek!', dailyLimitMode)}
						className='flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-bg-card-hover)]'
					>
						<Send size={16} className='text-[var(--color-primary)]' />
						Testuj alert limitu
					</button>
					<button
						onClick={() => sendTestAlert('Czas na przerwę dla oczu', 'Oderwij wzrok od ekranu i daj oczom odpocząć.', eyeBreakMode)}
						className='flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-bg-card-hover)]'
					>
						<Send size={16} className='text-[var(--color-primary)]' />
						Testuj alert przerwy
					</button>
					<button
						onClick={() => playSound()}
						className='flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-bg-card-hover)]'
					>
						<Volume2 size={16} className='text-[var(--color-primary)]' />
						Testuj dźwięk
					</button>
				</div>

				{/* Info & Updates */}
				<h2 className='mt-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted)]'>Informacje</h2>

				<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
					<div className='flex items-center gap-3'>
						<Moon size={20} className='text-[var(--color-primary)]' />
						<div>
							<div className='font-medium'>GameTimer</div>
							<div className='text-xs text-[var(--color-text-muted)]'>v0.1.0</div>
						</div>
					</div>
				</div>

				<UpdateSection />
			</div>
		</div>
	);
}
