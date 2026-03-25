import { motion } from 'framer-motion';
import { Trash2, Clock, Gamepad2, Coffee, Calendar } from 'lucide-react';
import { useTimerStore, type GameSession } from '@/stores/timerStore';
import { formatDuration, formatDate } from '@/utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useMemo, useState, useRef, useEffect } from 'react';

function SessionCard({ session }: { session: GameSession }) {
	const totalBreakTime = session.breaks.reduce((sum, b) => sum + b.duration, 0);

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 transition-colors hover:bg-[var(--color-bg-card-hover)]'
		>
			<div className='flex items-start justify-between'>
				<div className='flex items-center gap-2'>
					<Gamepad2 size={18} className='text-[var(--color-primary)]' />
					<span className='font-semibold'>{session.gameName}</span>
				</div>
				<div className='flex items-center gap-1 text-xs text-[var(--color-text-muted)]'>
					<Calendar size={12} />
					{formatDate(session.startTime)}
				</div>
			</div>

			<div className='mt-3 flex gap-4 text-sm text-[var(--color-text-muted)]'>
				<div className='flex items-center gap-1'>
					<Clock size={14} />
					<span>{formatDuration(session.duration)}</span>
				</div>
				<div className='flex items-center gap-1'>
					<Coffee size={14} />
					<span>
						{session.breaks.length} przerw{session.breaks.length === 1 ? 'a' : ''}
						{totalBreakTime > 0 && ` (${formatDuration(Math.floor(totalBreakTime / 1000))})`}
					</span>
				</div>
			</div>
		</motion.div>
	);
}

function WeeklyChart({ sessions }: { sessions: GameSession[] }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [chartWidth, setChartWidth] = useState(300);

	useEffect(() => {
		if (!containerRef.current) return;
		const obs = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w && w > 0) setChartWidth(w);
		});
		obs.observe(containerRef.current);
		return () => obs.disconnect();
	}, []);

	const chartData = useMemo(() => {
		const days = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
		const now = new Date();
		const data = days.map((name, i) => {
			const date = new Date(now);
			const currentDay = date.getDay();
			const diff = currentDay === 0 ? 6 : currentDay - 1;
			date.setDate(date.getDate() - diff + i);
			date.setHours(0, 0, 0, 0);

			const nextDay = new Date(date);
			nextDay.setDate(nextDay.getDate() + 1);

			const dayMinutes = sessions
				.filter((s) => s.startTime >= date.getTime() && s.startTime < nextDay.getTime())
				.reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);

			return { name, minuty: dayMinutes };
		});
		return data;
	}, [sessions]);

	const hasData = chartData.some((d) => d.minuty > 0);

	return (
		<div ref={containerRef} className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4'>
			<h3 className='mb-4 text-sm font-medium text-[var(--color-text-muted)]'>Ten tydzień</h3>
			{hasData ? (
				<BarChart width={chartWidth - 32} height={180} data={chartData}>
					<CartesianGrid strokeDasharray='3 3' stroke='#334155' />
					<XAxis dataKey='name' stroke='#94a3b8' fontSize={12} />
					<YAxis stroke='#94a3b8' fontSize={12} unit='min' />
					<Tooltip
						contentStyle={{
							backgroundColor: '#1e293b',
							border: '1px solid #334155',
							borderRadius: '8px',
							color: '#f8fafc',
						}}
					/>
					<Bar dataKey='minuty' fill='#6366f1' radius={[4, 4, 0, 0]} />
				</BarChart>
			) : (
				<div className='flex h-[180px] items-center justify-center text-sm text-[var(--color-text-muted)]'>Brak danych z tego tygodnia</div>
			)}
		</div>
	);
}

export default function HistoryPage() {
	const { sessions, clearSessions } = useTimerStore();

	const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
	const totalSessions = sessions.length;

	return (
		<div className='mx-auto flex h-full max-w-2xl flex-col gap-5 px-1'>
			<div className='flex items-center justify-between'>
				<h1 className='text-2xl font-bold'>Historia</h1>
				{sessions.length > 0 && (
					<button
						onClick={clearSessions}
						className='flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-bg-card)]'
					>
						<Trash2 size={14} />
						Wyczyść
					</button>
				)}
			</div>

			{/* Stats summary */}
			{sessions.length > 0 && (
				<div className='grid grid-cols-2 gap-3'>
					<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center'>
						<div className='text-2xl font-bold text-[var(--color-primary)]'>{formatDuration(totalTime)}</div>
						<div className='text-xs text-[var(--color-text-muted)]'>Łączny czas</div>
					</div>
					<div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center'>
						<div className='text-2xl font-bold text-[var(--color-primary)]'>{totalSessions}</div>
						<div className='text-xs text-[var(--color-text-muted)]'>Sesji</div>
					</div>
				</div>
			)}

			{/* Weekly chart */}
			<WeeklyChart sessions={sessions} />

			{/* Session list */}
			<div className='flex flex-1 flex-col gap-3 overflow-y-auto pb-4'>
				{sessions.length === 0 ? (
					<div className='flex flex-1 flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]'>
						<Gamepad2 size={48} strokeWidth={1} />
						<p>Brak zapisanych sesji</p>
						<p className='text-sm'>Rozpocznij grę, aby śledzić czas</p>
					</div>
				) : (
					sessions.map((session) => <SessionCard key={session.id} session={session} />)
				)}
			</div>
		</div>
	);
}
