import { NavLink } from 'react-router-dom';
import { Timer, Library, History, Settings } from 'lucide-react';

const navItems = [
	{ to: '/', icon: Timer, label: 'Timer' },
	{ to: '/library', icon: Library, label: 'Biblioteka' },
	{ to: '/history', icon: History, label: 'Historia' },
	{ to: '/settings', icon: Settings, label: 'Ustawienia' },
];

export default function Navigation() {
	return (
		<nav className='flex items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4'>
			{navItems.map(({ to, icon: Icon, label }) => (
				<NavLink
					key={to}
					to={to}
					end={to === '/'}
					className={({ isActive }) =>
						`flex cursor-pointer flex-col items-center gap-1 text-xs transition-colors ${
							isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
						}`
					}
				>
					<Icon size={22} />
					<span>{label}</span>
				</NavLink>
			))}
		</nav>
	);
}
