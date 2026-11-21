import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Navigation } from './components/layout/Navigation';
import { Footer } from './components/layout/Footer';
import { Skeleton } from './components/ui/skeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyPage } from './utils/lazyPage';

// Eager load: Only the home page (most commonly visited)
import SearchPage from './components/SearchPage';

// Lazy load: All other components
const WordTimeline = lazyPage(() => import('./components/WordTimeline'));
const WordComparison = lazyPage(() => import('./components/WordComparison'));
const RecentlyFirstSaid = lazyPage(() => import('./components/pages/RecentlyFirstSaid'));
const PersonRanking = lazyPage(() => import('./components/pages/PersonRanking'));
const PersonPage = lazyPage(() => import('./components/pages/PersonPage'));
const Statistics = lazyPage(() => import('./components/pages/Statistics'));

// Static pages - lazy load
const NotFound = lazyPage(() => import('./components/pages/NotFound'));
const Impressum = lazyPage(() => import('./components/pages/Impressum'));
const Datenschutz = lazyPage(() => import('./components/pages/Datenschutz'));
const FAQ = lazyPage(() => import('./components/pages/FAQ'));
const About = lazyPage(() => import('./components/pages/About'));


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
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
        {/* A new page starts without the error of the previous one. */}
        <ErrorBoundary key={pathname}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/wort/:word" element={<WordTimeline />} />
            <Route path="/vergleich" element={<WordComparison />} />
            <Route path="/neu" element={<RecentlyFirstSaid />} />
            <Route path="/personen" element={<PersonRanking />} />
            <Route path="/person/:id" element={<PersonPage />} />
            <Route path="/statistik" element={<Statistics />} />

            {/* Static Pages */}
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/about" element={<About />} />

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
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppContent />
    </Router>
  );
}

export default App;
