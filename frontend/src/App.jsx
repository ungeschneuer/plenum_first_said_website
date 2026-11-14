import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Navigation } from './components/layout/Navigation';
import { Footer } from './components/layout/Footer';
import { Skeleton } from './components/ui/skeleton';
import { ErrorBoundary } from './components/ErrorBoundary';

// Eager load: Only the home page (most commonly visited)
import SearchPage from './components/SearchPage';

// Lazy load: All other components
const WordTimeline = lazy(() => import('./components/WordTimeline'));
const WordComparison = lazy(() => import('./components/WordComparison'));
const WordOfTheDay = lazy(() => import('./components/WordOfTheDay'));
const SpeakerList = lazy(() => import('./components/SpeakerList'));
const SpeakerDetail = lazy(() => import('./components/SpeakerDetail'));
const PartyList = lazy(() => import('./components/PartyList'));
const PartyDetail = lazy(() => import('./components/PartyDetail'));
const ProtocolDetail = lazy(() => import('./components/ProtocolDetail'));
const WahlperiodeList = lazy(() => import('./components/WahlperiodeList'));
const WahlperiodeDetail = lazy(() => import('./components/WahlperiodeDetail'));

// Static pages - lazy load
const NotFound = lazy(() => import('./components/pages/NotFound'));
const Impressum = lazy(() => import('./components/pages/Impressum'));
const Datenschutz = lazy(() => import('./components/pages/Datenschutz'));
const FAQ = lazy(() => import('./components/pages/FAQ'));
const APIDocs = lazy(() => import('./components/pages/APIDocs'));
const About = lazy(() => import('./components/pages/About'));

// Admin components - lazy load (rarely used)
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminDatabase = lazy(() => import('./components/admin/AdminDatabase'));
const AdminLogs = lazy(() => import('./components/admin/AdminLogs'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  </div>
);

function AppContent() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(
    () => !!localStorage.getItem('admin_token')
  );
  const navigate = useNavigate();

  const handleAdminLogin = (token) => {
    setIsAdminAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAdminAuthenticated(false);
    navigate('/');
  };

  const handleSearch = (query) => {
    navigate(`/wort/${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Zum Hauptinhalt springen
      </a>
      <Navigation />
      <main id="main-content" className="flex-1">
        <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/wort/:word" element={<WordTimeline />} />
            <Route path="/vergleich" element={<WordComparison />} />
            <Route path="/wort-des-tages" element={<WordOfTheDay />} />
            <Route path="/redner" element={<SpeakerList />} />
            <Route path="/redner/:speakerId" element={<SpeakerDetail />} />
            <Route path="/parteien" element={<PartyList />} />
            <Route path="/parteien/:partyId" element={<PartyDetail />} />
            <Route path="/protokoll/:protocolId" element={<ProtocolDetail />} />
            <Route path="/wahlperioden" element={<WahlperiodeList />} />
            <Route path="/wahlperiode/:wpNumber" element={<WahlperiodeDetail />} />

            {/* Static Pages */}
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/docs" element={<APIDocs />} />
            <Route path="/about" element={<About />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin onLogin={handleAdminLogin} />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/database" element={<AdminDatabase />} />
            <Route path="/admin/logs" element={<AdminLogs />} />

            {/* Catch-all: 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
