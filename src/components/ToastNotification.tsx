import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Eye } from 'lucide-react';
import { useToastStore, type Toast } from '@/stores/toastStore';

export default function ToastNotification() {
	const { toasts, dismissToast } = useToastStore();

	return (
		<div className='pointer-events-none fixed right-4 bottom-4 z-[9999] flex flex-col gap-2'>
			<AnimatePresence>
				{toasts.map((toast) => (
					<ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
				))}
			</AnimatePresence>
		</div>
	);
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
	useEffect(() => {
		const timer = setTimeout(() => onDismiss(toast.id), 8000);
		return () => clearTimeout(timer);
	}, [toast.id, onDismiss]);

	const Icon = toast.type === 'eyebreak' ? Eye : AlertTriangle;
	const accentColor = toast.type === 'eyebreak' ? 'text-blue-400' : 'text-amber-400';
	const borderColor = toast.type === 'eyebreak' ? 'border-blue-500/30' : 'border-amber-500/30';

	return (
		<motion.div
			initial={{ opacity: 0, x: 80, scale: 0.95 }}
			animate={{ opacity: 1, x: 0, scale: 1 }}
			exit={{ opacity: 0, x: 80, scale: 0.95 }}
			transition={{ type: 'spring', damping: 25, stiffness: 300 }}
			className={`pointer-events-auto flex w-72 gap-3 rounded-xl border ${borderColor} bg-[var(--color-bg-card)] p-4 shadow-2xl shadow-black/40 backdrop-blur-sm`}
		>
			<Icon size={20} className={`mt-0.5 shrink-0 ${accentColor}`} />
			<div className='flex-1'>
				<div className='text-sm font-semibold text-[var(--color-text)]'>{toast.title}</div>
				<div className='mt-0.5 text-xs text-[var(--color-text-muted)]'>{toast.body}</div>
			</div>
			<button
				onClick={() => onDismiss(toast.id)}
				className='shrink-0 cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]'
			>
				<X size={14} />
			</button>
		</motion.div>
	);
}
