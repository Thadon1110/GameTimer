import { create } from 'zustand';

export interface Toast {
	id: string;
	title: string;
	body: string;
	type: 'daily' | 'eyebreak' | 'info';
}

let nextId = 0;

interface ToastState {
	toasts: Toast[];
	addToast: (title: string, body: string, type: Toast['type']) => void;
	dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	addToast: (title, body, type) => {
		const id = String(++nextId);
		set((s) => ({ toasts: [...s.toasts, { id, title, body, type }] }));
	},
	dismissToast: (id) => {
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
	},
}));
