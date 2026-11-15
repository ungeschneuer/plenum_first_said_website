import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { searchWords, getStatus, MINIMUM_QUERY_LENGTH } from '../utils/staticData';
import { formatGermanDate, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchStatus() {
      try {
        const statusData = await getStatus();
        setStatus(statusData);
      } catch (err) {
        console.error('Error fetching status:', err);
      }
    }
    fetchStatus();
  }, []);

  useEffect(() => {
    if (query.trim().length < MINIMUM_QUERY_LENGTH) {
      setResults([]);
      setTotalResults(0);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const searchResponse = await searchWords(query);

        if (searchResponse.items) {
          setResults(searchResponse.items);
          setTotalResults(searchResponse.pagination?.total || searchResponse.items.length);
        } else {
          setResults(searchResponse);
          setTotalResults(searchResponse.length);
        }
      } catch (err) {
        setError(err.message);
        setResults([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleWordClick = (word) => {
    navigate(`/wort/${encodeURIComponent(word)}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Wie oft sagt der Bundestag …?
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Jedes Wort aus den Plenarsitzungen seit 1949, Sitzung für Sitzung gezählt, mit seinem ersten Vorkommen.
            </p>

            {status && (
              <p className="text-sm text-muted-foreground">
                {germanPlurals.protokoll(status.total_protocols)} vom {formatGermanDate(status.first_date)} bis zum {formatGermanDate(status.last_date)}
              </p>
            )}

            {/* Search Input */}
            <form
              className="max-w-2xl mx-auto mt-8"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim()) handleWordClick(query.trim().toLowerCase());
              }}
            >
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="text"
                  placeholder="Wort eingeben, zum Beispiel Klimawandel"
                  className="pl-12 pr-12 h-12 text-lg"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  aria-label="Wortsuche"
                  aria-busy={loading}
                />
                {loading && (
                  <Loader2
                    className="absolute right-4 top-3.5 h-5 w-5 text-muted-foreground animate-spin"
                    aria-hidden="true"
                  />
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <span className="sr-only">Suchergebnisse werden geladen...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Suchergebnisse
              </h2>
              <Badge variant="secondary">
                {results.length} von {totalResults}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {results.map((result) => (
                <Card
                  key={result.word_id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary"
                  onClick={() => handleWordClick(result.word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleWordClick(result.word);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${result.word} anzeigen, ${germanPlurals.vorkommen(result.occurrence_count)}`}
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold text-lg">{result.word}</span>
                      {result.matched_form && (
                        <span className="block text-sm text-muted-foreground">gefunden über {result.matched_form}</span>
                      )}
                    </span>
                    <Badge className="shrink-0">{germanPlurals.vorkommen(result.occurrence_count)}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalResults > results.length && (
              <p className="text-sm text-muted-foreground text-center">
                + {totalResults - results.length} weitere Ergebnisse. Verfeinern Sie Ihre Suche für spezifischere Ergebnisse.
              </p>
            )}
          </div>
        )}

        {/* No Results */}
        {query.trim().length >= MINIMUM_QUERY_LENGTH && !loading && results.length === 0 && (
          <Alert role="status">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Keine Ergebnisse für &quot;{query}&quot; gefunden
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text / Quick Links */}
        {query.length === 0 && !loading && (
          <div className="space-y-12">
            <p className="text-muted-foreground">
              Geben Sie ein Wort ein, zum Beispiel <Link to="/wort/Klimawandel" className="underline underline-offset-2">Klimawandel</Link>,{' '}
              <Link to="/wort/Zeitenwende" className="underline underline-offset-2">Zeitenwende</Link> oder{' '}
              <Link to="/wort/Wiedervereinigung" className="underline underline-offset-2">Wiedervereinigung</Link>. Gebeugte
              Formen führen zur Grundform. Wie gezählt wird, steht unter <Link to="/about" className="underline underline-offset-2">Über das Projekt</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
