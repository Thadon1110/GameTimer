import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Search, Gamepad2, X, MonitorPlay, FolderOpen, Radar, Loader2, HardDriveDownload, Check } from 'lucide-react';
import { useGameLibraryStore, KNOWN_GAMES } from '@/stores/gameLibraryStore';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface RunningProcess {
	name: string;
	exe: string;
}

interface InstalledGame {
	name: string;
	exe_name: string;
	exe_path: string;
	launcher: string;
}

function AddGameModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const [mode, setMode] = useState<'menu' | 'processes' | 'scan'>('menu');
	const [processes, setProcesses] = useState<RunningProcess[]>([]);
	const [processSearch, setProcessSearch] = useState('');
	const [scanning, setScanning] = useState(false);
	const [scannedGames, setScannedGames] = useState<InstalledGame[]>([]);
	const [scanSearch, setScanSearch] = useState('');
	const [addedFromScan, setAddedFromScan] = useState<Set<string>>(new Set());
	const { addGame, games } = useGameLibraryStore();

	const resetAndClose = () => {
		setMode('menu');
		setProcesses([]);
		setProcessSearch('');
		setScannedGames([]);
		setScanSearch('');
		setAddedFromScan(new Set());
		onClose();
	};

	const handleBrowseExe = async () => {
		const selected = await open({
			title: 'Wybierz plik .exe gry',
			filters: [{ name: 'Programy', extensions: ['exe'] }],
			multiple: false,
		});
		if (selected) {
			const path = typeof selected === 'string' ? selected : selected;
			const fileName = path.split('\\').pop()?.split('/').pop() || '';
			const known = KNOWN_GAMES.find((g) => g.processName.toLowerCase() === fileName.toLowerCase());
			const gameName = known ? known.name : fileName.replace(/\.exe$/i, '').replace(/[-_]/g, ' ');
			addGame(gameName, fileName);
			resetAndClose();
		}
	};

	const handleScanProcesses = async () => {
		setScanning(true);
		try {
			const result = await invoke<RunningProcess[]>('get_running_processes');
			const existingNames = new Set(games.map((g) => g.processName.toLowerCase()));

			// Path-based exclusions — these directories never contain games
			const excludedPathSegments = [
				'\\windows\\',
				'\\system32\\',
				'\\syswow64\\',
				'\\systemapps\\',
				'\\windowsapps\\',
				'\\common files\\',
				'\\microsoft shared\\',
				'\\.vscode\\',
				'\\nodejs\\',
				'\\windowspowershell\\',
				'\\eset\\',
				'\\adobe\\',
				'\\microsoft vs code\\',
				'\\xampp\\',
				'\\mysql\\',
				'\\apache\\',
				'\\python',
				'\\git\\',
				'\\discord\\',
				'\\ticktick\\',
				'\\breaktimer\\',
				'\\edgewebview\\',
				'\\clicktorun\\',
				'\\nvidia corporation\\',
				'\\amd\\',
				'\\programs\\ueli\\',
				'\\timecamp',
				'\\filezilla',
			];

			// Name-based blacklist — processes that should never appear
			const systemBlacklist = [
				'svchost',
				'csrss',
				'lsass',
				'wininit',
				'services',
				'smss',
				'winlogon',
				'explorer',
				'dwm',
				'conhost',
				'ctfmon',
				'sihost',
				'dllhost',
				'system',
				'registry',
				'idle',
				'spoolsv',
				'audiodg',
				'wmiprvse',
				'msiexec',
				'smartscreen',
				'steam',
				'steamwebhelper',
				'epicwebhelper',
				'msedgewebview2',
			];

			const filtered = result.filter((p) => {
				const nameLower = p.name.toLowerCase();
				if (existingNames.has(nameLower)) return false;

				// Filter by path first — most effective
				const pathLower = p.exe.toLowerCase().replace(/\//g, '\\');
				if (pathLower && excludedPathSegments.some((seg) => pathLower.includes(seg))) return false;

				const stem = nameLower.replace('.exe', '');
				if (systemBlacklist.includes(stem)) return false;

				// Hide known non-game suffixes
				const nonGameSuffixes = [
					'broker',
					'service',
					'svc',
					'host',
					'agent',
					'daemon',
					'monitor',
					'tray',
					'helper',
					'updater',
					'crashhandler',
					'proxy',
					'provider',
				];
				if (nonGameSuffixes.some((s) => stem.endsWith(s))) return false;

				// Hide known non-game prefixes
				if (stem.startsWith('microsoft') || stem.startsWith('nvidia') || stem.startsWith('amd')) return false;

				return true;
			});

			setProcesses(filtered);
			setMode('processes');
		} finally {
			setScanning(false);
		}
	};

	const handleSelectProcess = (proc: RunningProcess) => {
		const known = KNOWN_GAMES.find((g) => g.processName.toLowerCase() === proc.name.toLowerCase());
		const gameName = known ? known.name : proc.name.replace(/\.exe$/i, '').replace(/[-_]/g, ' ');
		addGame(gameName, proc.name);
		resetAndClose();
	};

	const handleScanSystem = async () => {
		setScanning(true);
		try {
			const result = await invoke<InstalledGame[]>('scan_installed_games');
			const existingNames = new Set(games.map((g) => g.processName.toLowerCase()));
			const filtered = result.filter((g) => !existingNames.has(g.exe_name.toLowerCase()));
			setScannedGames(filtered);
			setMode('scan');
		} finally {
			setScanning(false);
		}
	};

	const handleAddScannedGame = (game: InstalledGame) => {
		const known = KNOWN_GAMES.find((g) => g.processName.toLowerCase() === game.exe_name.toLowerCase());
		const displayName = known ? known.name : game.name;
		addGame(displayName, game.exe_name);
		setAddedFromScan((prev) => new Set(prev).add(game.exe_name.toLowerCase()));
	};

	const filteredProcesses = processes.filter(
		(p) => p.name.toLowerCase().includes(processSearch.toLowerCase()) || p.exe.toLowerCase().includes(processSearch.toLowerCase()),
	);

	const filteredScannedGames = scannedGames.filter(
		(g) => g.name.toLowerCase().includes(scanSearch.toLowerCase()) || g.exe_name.toLowerCase().includes(scanSearch.toLowerCase()),
	);

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
					onClick={resetAndClose}
				>
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						className='w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6'
						onClick={(e) => e.stopPropagation()}
					>
						<div className='mb-5 flex items-center justify-between'>
							<h2 className='text-lg font-bold'>
								{mode === 'menu' && 'Dodaj grę'}
								{mode === 'processes' && 'Uruchomione procesy'}
								{mode === 'scan' && 'Zainstalowane gry'}
							</h2>
							<button onClick={resetAndClose} className='cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]'>
								<X size={20} />
							</button>
						</div>

						{/* Mode: Choose method */}
						{mode === 'menu' && (
							<div className='flex flex-col gap-3'>
								<button
									onClick={handleScanSystem}
									disabled={scanning}
									className='flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left transition-colors hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60'
								>
									{scanning ? (
										<Loader2 size={22} className='animate-spin text-[var(--color-primary)]' />
									) : (
										<HardDriveDownload size={22} className='text-[var(--color-primary)]' />
									)}
									<div>
										<div className='font-medium'>Skanuj zainstalowane gry</div>
										<div className='text-xs text-[var(--color-text-muted)]'>Steam, Epic, GOG i inne</div>
									</div>
								</button>

								<button
									onClick={handleScanProcesses}
									disabled={scanning}
									className='flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left transition-colors hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60'
								>
									{scanning ? (
										<Loader2 size={22} className='animate-spin text-[var(--color-primary)]' />
									) : (
										<Radar size={22} className='text-[var(--color-primary)]' />
									)}
									<div>
										<div className='font-medium'>Skanuj procesy</div>
										<div className='text-xs text-[var(--color-text-muted)]'>Wykryj uruchomione gry</div>
									</div>
								</button>

								<button
									onClick={handleBrowseExe}
									className='flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]'
								>
									<FolderOpen size={22} className='text-[var(--color-primary)]' />
									<div>
										<div className='font-medium'>Wybierz plik .exe</div>
										<div className='text-xs text-[var(--color-text-muted)]'>Znajdź grę na dysku</div>
									</div>
								</button>
							</div>
						)}

						{/* Mode: Process list */}
						{mode === 'processes' && (
							<div className='flex flex-col gap-3'>
								<div className='relative'>
									<Search className='absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]' size={16} />
									<input
										type='text'
										value={processSearch}
										onChange={(e) => setProcessSearch(e.target.value)}
										placeholder='Szukaj procesu...'
										className='w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none'
									/>
								</div>

								<div className='max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)]'>
									{filteredProcesses.length === 0 ? (
										<div className='p-4 text-center text-sm text-[var(--color-text-muted)]'>Brak procesów</div>
									) : (
										filteredProcesses.map((proc) => (
											<button
												key={proc.name}
												onClick={() => handleSelectProcess(proc)}
												className='flex w-full cursor-pointer items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--color-bg-card-hover)]'
											>
												<MonitorPlay size={16} className='shrink-0 text-[var(--color-primary)]' />
												<div className='min-w-0'>
													<div className='truncate text-sm font-medium'>{proc.name}</div>
													<div className='truncate text-xs text-[var(--color-text-muted)]'>{proc.exe}</div>
												</div>
											</button>
										))
									)}
								</div>

								<button
									onClick={() => setMode('menu')}
									className='cursor-pointer rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card)]'
								>
									Wróć
								</button>
							</div>
						)}

						{/* Mode: Scan installed games */}
						{mode === 'scan' && (
							<div className='flex flex-col gap-3'>
								<div className='relative'>
									<Search className='absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]' size={16} />
									<input
										type='text'
										value={scanSearch}
										onChange={(e) => setScanSearch(e.target.value)}
										placeholder='Szukaj gry...'
										className='w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none'
									/>
								</div>

								<div className='text-xs text-[var(--color-text-muted)]'>Znaleziono {scannedGames.length} gier</div>

								<div className='max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)]'>
									{filteredScannedGames.length === 0 ? (
										<div className='p-4 text-center text-sm text-[var(--color-text-muted)]'>Nie znaleziono gier</div>
									) : (
										filteredScannedGames.map((game) => {
											const isAdded = addedFromScan.has(game.exe_name.toLowerCase());
											return (
												<div
													key={game.exe_path}
													className='flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0'
												>
													<div className='min-w-0 flex-1'>
														<div className='truncate text-sm font-medium'>{game.name}</div>
														<div className='truncate text-xs text-[var(--color-text-muted)]'>
															{game.exe_name} · {game.launcher}
														</div>
													</div>
													<button
														onClick={() => handleAddScannedGame(game)}
														disabled={isAdded}
														className='cursor-pointer shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--color-bg-card-hover)] disabled:opacity-40 disabled:cursor-default'
													>
														{isAdded ? <Check size={18} className='text-green-500' /> : <Plus size={18} className='text-[var(--color-primary)]' />}
													</button>
												</div>
											);
										})
									)}
								</div>

								<button
									onClick={() => setMode('menu')}
									className='cursor-pointer rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card)]'
								>
									Wróć
								</button>
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export default function LibraryPage() {
	const { games, removeGame, detectedGame } = useGameLibraryStore();
	const [search, setSearch] = useState('');
	const [showAddModal, setShowAddModal] = useState(false);

	const filtered = games.filter(
		(g) => g.name.toLowerCase().includes(search.toLowerCase()) || g.processName.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className='mx-auto flex h-full max-w-2xl flex-col gap-5 px-1'>
			<div className='flex items-center justify-between gap-3'>
				<h1 className='text-2xl font-bold'>Biblioteka</h1>
				<button
					onClick={() => setShowAddModal(true)}
					className='flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
				>
					<Plus size={16} />
					Dodaj grę
				</button>
			</div>

			{/* Detected game banner */}
			{detectedGame && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className='flex items-center gap-3 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3'
				>
					<MonitorPlay size={20} className='text-[var(--color-success)]' />
					<div>
						<div className='text-sm font-medium text-[var(--color-success)]'>Wykryto grę</div>
						<div className='text-sm text-[var(--color-text)]'>{detectedGame.name}</div>
					</div>
				</motion.div>
			)}

			{/* Search */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]' size={18} />
				<input
					type='text'
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder='Szukaj gry...'
					className='w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none'
				/>
			</div>

			{/* Game count */}
			<p className='text-xs text-[var(--color-text-muted)]'>
				{filtered.length} z {games.length} gier
			</p>

			{/* Game list */}
			<div className='flex flex-1 flex-col gap-2 overflow-y-auto pb-4 pr-2'>
				{filtered.length === 0 ? (
					<div className='flex flex-1 flex-col items-center justify-center gap-4 text-[var(--color-text-muted)]'>
						<Gamepad2 size={48} strokeWidth={1} />
						<p className='text-center'>Brak gier w bibliotece</p>
						<p className='text-center text-sm'>
							Dodaj gry klikając przycisk powyżej —<br />
							wybierz plik .exe lub skanuj uruchomione procesy
						</p>
					</div>
				) : (
					filtered.map((game) => (
						<motion.div
							key={game.id}
							initial={{ opacity: 0, y: 5 }}
							animate={{ opacity: 1, y: 0 }}
							className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
								detectedGame?.processName === game.processName
									? 'border-[var(--color-success)]/40 bg-[var(--color-success)]/5'
									: 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)]'
							}`}
						>
							<div className='flex items-center gap-3'>
								<Gamepad2
									size={18}
									className={detectedGame?.processName === game.processName ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'}
								/>
								<div>
									<div className='text-sm font-medium'>{game.name}</div>
									<div className='text-xs text-[var(--color-text-muted)]'>{game.processName}</div>
								</div>
							</div>

							{detectedGame?.processName === game.processName ? (
								<span className='flex items-center gap-1 text-xs text-[var(--color-success)]'>
									<span className='h-2 w-2 animate-pulse rounded-full bg-[var(--color-success)]' />
									Aktywna
								</span>
							) : (
								<button
									onClick={() => removeGame(game.id)}
									className='cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]'
								>
									<Trash2 size={15} />
								</button>
							)}
						</motion.div>
					))
				)}
			</div>

			<AddGameModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
		</div>
	);
}
