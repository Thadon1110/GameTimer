import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import TimerPage from './pages/TimerPage';
import HistoryPage from './pages/HistoryPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';
import { useSettingsStore } from './stores/settingsStore';

function App() {
	const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

	if (!onboardingCompleted) {
		return <OnboardingPage />;
	}

	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path='/' element={<TimerPage />} />
				<Route path='/library' element={<LibraryPage />} />
				<Route path='/history' element={<HistoryPage />} />
				<Route path='/settings' element={<SettingsPage />} />
			</Route>
		</Routes>
	);
}

export default App;
