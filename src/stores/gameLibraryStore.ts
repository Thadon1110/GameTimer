import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Game {
	id: string;
	name: string;
	processName: string; // e.g. "cs2.exe"
	icon?: string;
	addedAt: number;
}

// Common games with their process names
export const KNOWN_GAMES: Omit<Game, 'id' | 'addedAt'>[] = [
	{ name: 'Counter-Strike 2', processName: 'cs2.exe' },
	{ name: 'Valorant', processName: 'VALORANT-Win64-Shipping.exe' },
	{ name: 'League of Legends', processName: 'League of Legends.exe' },
	{ name: 'Dota 2', processName: 'dota2.exe' },
	{ name: 'Fortnite', processName: 'FortniteClient-Win64-Shipping.exe' },
	{ name: 'Apex Legends', processName: 'r5apex.exe' },
	{ name: 'Overwatch 2', processName: 'Overwatch.exe' },
	{ name: 'Minecraft', processName: 'javaw.exe' },
	{ name: 'GTA V', processName: 'GTA5.exe' },
	{ name: 'Rust', processName: 'RustClient.exe' },
	{ name: 'ARK: Survival Evolved', processName: 'ShooterGame.exe' },
	{ name: 'Rocket League', processName: 'RocketLeague.exe' },
	{ name: 'The Witcher 3', processName: 'witcher3.exe' },
	{ name: 'Cyberpunk 2077', processName: 'Cyberpunk2077.exe' },
	{ name: 'Elden Ring', processName: 'eldenring.exe' },
	{ name: "Baldur's Gate 3", processName: 'bg3.exe' },
	{ name: 'Hogwarts Legacy', processName: 'HogwartsLegacy.exe' },
	{ name: 'Palworld', processName: 'Palworld-Win64-Shipping.exe' },
	{ name: 'Dead by Daylight', processName: 'DeadByDaylight-Win64-Shipping.exe' },
	{ name: 'Terraria', processName: 'Terraria.exe' },
	{ name: 'Stardew Valley', processName: 'Stardew Valley.exe' },
	{ name: 'Among Us', processName: 'Among Us.exe' },
	{ name: 'Fall Guys', processName: 'FallGuys_client_game.exe' },
	{ name: 'Rainbow Six Siege', processName: 'RainbowSix.exe' },
	{ name: 'Warzone', processName: 'cod.exe' },
	{ name: 'FIFA / EA FC', processName: 'FC25.exe' },
	{ name: 'Diablo IV', processName: 'Diablo IV.exe' },
	{ name: 'Path of Exile', processName: 'PathOfExile.exe' },
	{ name: 'World of Warcraft', processName: 'Wow.exe' },
	{ name: 'Hearthstone', processName: 'Hearthstone.exe' },
	{ name: 'Destiny 2', processName: 'destiny2.exe' },
	{ name: 'Escape from Tarkov', processName: 'EscapeFromTarkov.exe' },
	{ name: 'Arena Breakout: Infinite', processName: 'ArenaBreakoutInfinite.exe' },
	{ name: 'War Thunder', processName: 'aces.exe' },
	{ name: 'Roblox', processName: 'RobloxPlayerBeta.exe' },
	{ name: 'Satisfactory', processName: 'FactoryGame-Win64-Shipping.exe' },
];

interface GameLibraryState {
	games: Game[];
	detectedGame: Game | null;

	addGame: (name: string, processName: string) => void;
	removeGame: (id: string) => void;
	setDetectedGame: (game: Game | null) => void;
	getGameByProcess: (processName: string) => Game | undefined;
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export const useGameLibraryStore = create<GameLibraryState>()(
	persist(
		(set, get) => ({
			games: [],
			detectedGame: null,

			addGame: (name, processName) => {
				const { games } = get();
				// Don't add duplicates
				if (games.some((g) => g.processName.toLowerCase() === processName.toLowerCase())) return;
				set({
					games: [...games, { id: generateId(), name, processName, addedAt: Date.now() }],
				});
			},

			removeGame: (id) => {
				set({ games: get().games.filter((g) => g.id !== id) });
			},

			setDetectedGame: (game) => set({ detectedGame: game }),

			getGameByProcess: (processName) => {
				return get().games.find((g) => g.processName.toLowerCase() === processName.toLowerCase());
			},
		}),
		{
			name: 'gametimer-library',
			version: 2,
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ games: state.games }),
		},
	),
);
