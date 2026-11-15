import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Plus, Search, TrendingUp, ZoomOut, Download, BarChart3, LineChart } from 'lucide-react';
import { getWordsComparison, searchWords } from '../utils/staticData';
import { formatGermanDate } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

// Color palette for different words
const COLORS = [
  { border: '#000000', bg: '#00000030' },     // Black (primary)
  { border: '#D4AF37', bg: '#D4AF3730' },     // Gold (secondary)
  { border: '#2563eb', bg: '#2563eb30' },     // Blue
  { border: '#dc2626', bg: '#dc262630' },     // Red
  { border: '#16a34a', bg: '#16a34a30' },     // Green
];

export default function WordComparison() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chartRef = useRef(null);

  // Initialize words from URL params or empty array
  const [words, setWords] = useState(() => {
    const urlWords = searchParams.get('words');
    return urlWords ? urlWords.split(',') : [];
  });

  const [wordInput, setWordInput] = useState('');
  const [timelineData, setTimelineData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPercentage, setShowPercentage] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [aggregation, setAggregation] = useState('protocol'); // protocol, month, year, legislature
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Update URL when words change
  useEffect(() => {
    if (words.length > 0) {
      setSearchParams({ words: words.join(',') });
    } else {
      setSearchParams({});
    }
  }, [words, setSearchParams]);

  // Fetch timeline data for all words in one optimized request
  const fetchWordsTimeline = async (wordsToFetch) => {
    if (wordsToFetch.length === 0) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await getWordsComparison(wordsToFetch);
      setTimelineData(response.words);

      // Check if any words have no data (not found in database)
      const wordsWithoutData = wordsToFetch.filter(
        word => !response.words[word] || response.words[word].length === 0
      );

      if (wordsWithoutData.length > 0) {
        const wordList = wordsWithoutData.join(', ');
        setErrors({
          general: `Folgende Wörter wurden nicht in der Datenbank gefunden: ${wordList}`
        });

        // Remove words that weren't found
        setWords(prev => prev.filter(w => !wordsWithoutData.includes(w)));
      }
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      setErrors({ general: err.message || 'Fehler beim Laden der Vergleichsdaten' });
    } finally {
      setLoading(false);
    }
  };

  // Debounced search for word suggestions
  const searchForWords = useCallback(
    async (query) => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await searchWords(query, 10);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    },
    []
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchForWords(wordInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [wordInput, searchForWords]);

  // Add word to comparison
  const addWord = async (wordToAdd = null, skipValidation = false) => {
    const word = wordToAdd || wordInput.trim();
    if (!word) return;

    if (words.includes(word)) {
      setErrors({ input: 'Wort bereits hinzugefügt' });
      return;
    }

    if (words.length >= 5) {
      setErrors({ input: 'Maximal 5 Wörter können verglichen werden' });
      return;
    }

    let validatedWord = word;

    // If word came from suggestion, skip validation (already validated)
    if (!skipValidation) {
      // Try to validate word exists in database
      setSearchLoading(true);

      try {
        const response = await searchWords(word, 20);
        const results = response.items || response; // Handle both formats

        if (results && results.length > 0) {
          // Try to find exact match (case-insensitive)
          let match = results.find(r => r.word.toLowerCase() === word.toLowerCase());

          // If no exact match, try fuzzy matching
          if (!match) {
            match = results.find(r =>
              r.word.toLowerCase().includes(word.toLowerCase()) ||
              word.toLowerCase().includes(r.word.toLowerCase())
            );
          }

          // If still no match, use first result if it starts with the query
          if (!match && results.length > 0) {
            const firstResult = results[0];
            if (firstResult.word.toLowerCase().startsWith(word.toLowerCase().substring(0, Math.min(3, word.length)))) {
              match = firstResult;
            }
          }

          if (match) {
            // Use the correctly cased word from database
            validatedWord = match.word;
          } else {
            // No match found - show available alternatives
            const alternatives = results.slice(0, 5).map(r => r.word).join(', ');
            setErrors({
              input: `Wort "${word}" nicht gefunden. Meinten Sie: ${alternatives}?`
            });
            setSearchLoading(false);
            return;
          }
        } else {
          // No results from search
          setErrors({ input: `Keine Ergebnisse für "${word}" gefunden` });
          setSearchLoading(false);
          return;
        }
      } catch (err) {
        // Search API failed - proceed anyway and let comparison API validate
        console.warn('Search API unavailable, proceeding with word:', word, err);
        // Don't return - continue to add the word
      }

      setSearchLoading(false);
    }

    const newWords = [...words, validatedWord];
    setWords(newWords);
    setWordInput('');
    setErrors({});
    setSuggestions([]);
    setShowSuggestions(false);

    // Fetch all words together (this will validate on backend)
    fetchWordsTimeline(newWords);
  };

  // Remove word from comparison
  const removeWord = (wordToRemove) => {
    const newWords = words.filter(w => w !== wordToRemove);
    setWords(newWords);
    setTimelineData(prev => {
      const newData = { ...prev };
      delete newData[wordToRemove];
      return newData;
    });

    // Re-fetch remaining words if any
    if (newWords.length > 0) {
      fetchWordsTimeline(newWords);
    }
  };

  // Load initial words from URL
  useEffect(() => {
    if (words.length > 0 && Object.keys(timelineData).length === 0) {
      fetchWordsTimeline(words);
    }
  }, []);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-suggestion]') && !e.target.closest('input[aria-autocomplete]')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Aggregate timeline data based on selected aggregation level
  const aggregateData = (data) => {
    if (aggregation === 'protocol') return data;

    const aggregated = {};

    data.forEach(point => {
      const date = new Date(point.date);
      let key;

      if (aggregation === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (aggregation === 'year') {
        key = String(date.getFullYear());
      } else if (aggregation === 'legislature') {
        key = `WP ${point.wahlperiode}`;
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          date: key,
          count: 0,
          total_words: 0,
          wahlperiode: point.wahlperiode,
        };
      }

      aggregated[key].count += point.count;
      aggregated[key].total_words += point.total_words || 0;
    });

    // Calculate percentage for aggregated data
    return Object.values(aggregated).map(item => ({
      ...item,
      percentage: item.total_words > 0 ? (item.count / item.total_words) * 100 : 0,
    })).sort((a, b) => {
      // For legislature aggregation, sort numerically by WP number
      if (aggregation === 'legislature') {
        const wpA = parseInt(a.date.replace('WP ', ''));
        const wpB = parseInt(b.date.replace('WP ', ''));
        return wpA - wpB;
      }
      // For other aggregations, use string comparison
      return a.date.localeCompare(b.date);
    });
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (words.length === 0) return null;

    // Aggregate data for all words
    const aggregatedTimelineData = {};
    Object.keys(timelineData).forEach(word => {
      aggregatedTimelineData[word] = aggregateData(timelineData[word]);
    });

    // Get all unique dates across all words
    const allDates = new Set();
    Object.values(aggregatedTimelineData).forEach(data => {
      data.forEach(point => allDates.add(point.date));
    });

    const sortedDates = Array.from(allDates).sort((a, b) => {
      // For legislature aggregation, sort numerically by WP number
      if (aggregation === 'legislature') {
        const wpA = parseInt(a.replace('WP ', ''));
        const wpB = parseInt(b.replace('WP ', ''));
        return wpA - wpB;
      }
      // For other aggregations, use string comparison
      return a.localeCompare(b);
    });

    // Create datasets for each word
    const datasets = words.map((word, index) => {
      const data = aggregatedTimelineData[word] || [];
      const color = COLORS[index % COLORS.length];

      // Create a map of date to value
      const dateMap = {};
      data.forEach(point => {
        dateMap[point.date] = showPercentage ? point.percentage : point.count;
      });

      // Fill in values for all dates (0 for missing dates)
      // Use !== undefined to properly handle 0 values (don't convert 0 to null)
      const values = sortedDates.map(date =>
        dateMap[date] !== undefined ? dateMap[date] : 0
      );

      const baseConfig = {
        label: word,
        data: values,
        borderColor: color.border,
        spanGaps: false, // Don't skip gaps - show 0 values properly
      };

      if (chartType === 'line') {
        return {
          ...baseConfig,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: false,
        };
      } else if (chartType === 'bar') {
        return {
          ...baseConfig,
          backgroundColor: color.border,
          borderWidth: 0,
          borderRadius: 4,
        };
      }
      return baseConfig;
    });

    return {
      labels: sortedDates,
      datasets
    };
  };

  const chartData = prepareChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 12
          },
          padding: 15,
          usePointStyle: true,
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            return formatGermanDate(context[0].label);
          },
        },
        backgroundColor: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        titleColor: isDark ? '#e0e0e0' : '#ffffff',
        bodyColor: isDark ? '#e0e0e0' : '#ffffff',
        borderColor: isDark ? '#333333' : '#e0e0e0',
        borderWidth: 1,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        limits: {
          x: {min: 'original', max: 'original'},
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        suggestedMin: 0,
        title: {
          display: true,
          text: showPercentage ? 'Prozentsatz der Gesamtwörter (%)' : 'Worthäufigkeit',
          font: {
            size: 12,
            weight: '500'
          },
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        },
        grid: {
          color: isDark ? '#333333' : '#e0e0e0',
        },
        ticks: {
          font: {
            size: 11
          },
          color: isDark ? '#888888' : '#666666',
          precision: 0,
          stepSize: showPercentage ? undefined : 1,
        }
      },
      x: {
        title: {
          display: true,
          text: 'Datum',
          font: {
            size: 12,
            weight: '500'
          },
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        },
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          },
          color: isDark ? '#888888' : '#666666',
          maxRotation: 45,
          minRotation: 45,
        }
      }
    }
  };

  const ChartComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-6" aria-label="Zurück zur Suche">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Suche
      </Button>

      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Wortvergleich</h1>
        <p className="text-muted-foreground">Vergleichen Sie die Häufigkeit mehrerer Wörter im Bundestag</p>
      </div>

      {/* Add Word Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Wörter hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie bis zu 5 Wörter hinzu, um deren Verwendung zu vergleichen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Wort eingeben (min. 2 Zeichen)..."
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWord();
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
                    e.preventDefault();
                    // Focus first suggestion
                    document.querySelector('[data-suggestion]')?.focus();
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                aria-label="Wort zum Vergleich hinzufügen"
                aria-autocomplete="list"
                aria-controls="word-suggestions"
                aria-expanded={showSuggestions}
                disabled={words.length >= 5}
              />

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  id="word-suggestions"
                  className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
                  role="listbox"
                >
                  {suggestions.map((result, index) => (
                    <button
                      key={result.word}
                      data-suggestion
                      onClick={() => {
                        addWord(result.word, true); // Skip validation - already validated
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          addWord(result.word, true); // Skip validation
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                          document.querySelector('input[aria-autocomplete]')?.focus();
                        }
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      role="option"
                      aria-selected={false}
                    >
                      <div className="font-medium">{result.word}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.occurrence_count.toLocaleString('de-DE')} Vorkommen
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchLoading && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" aria-hidden="true"></div>
                </div>
              )}
            </div>
            <Button
              onClick={() => addWord()}
              disabled={!wordInput.trim() || words.length >= 5 || searchLoading}
            >
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Hinzufügen
            </Button>
          </div>

          {errors.input && (
            <Alert variant="destructive" className="mb-4" role="alert">
              <AlertDescription>{errors.input}</AlertDescription>
            </Alert>
          )}

          {/* Word Badges */}
          {words.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {words.map((word, index) => (
                <Badge
                  key={word}
                  variant="secondary"
                  className="text-base px-3 py-1.5"
                  style={{
                    borderLeft: `4px solid ${COLORS[index % COLORS.length].border}`
                  }}
                >
                  {word}
                  {loading && <span className="ml-2 text-xs">Lädt...</span>}
                  <button
                    onClick={() => removeWord(word)}
                    className="ml-2 hover:text-destructive"
                    aria-label={`${word} entfernen`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      {words.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Vergleichsdiagramm</CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (chartRef.current) {
                        chartRef.current.resetZoom();
                      }
                    }}
                    aria-label="Zoom zurücksetzen"
                  >
                    <ZoomOut className="h-4 w-4 mr-2" aria-hidden="true" />
                    Zoom zurücksetzen
                  </Button>
                  <label htmlFor="show-percentage-comparison" className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      id="show-percentage-comparison"
                      type="checkbox"
                      checked={showPercentage}
                      onChange={(e) => setShowPercentage(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Als Prozentsatz anzeigen</span>
                  </label>
                </div>
              </div>

              {/* Chart Type Selector */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Diagrammtyp:</span>
                <ToggleGroup
                  type="single"
                  value={chartType}
                  onValueChange={(value) => value && setChartType(value)}
                  aria-label="Diagrammtyp auswählen"
                >
                  <ToggleGroupItem value="line" aria-label="Liniendiagramm">
                    <LineChart className="h-4 w-4 mr-2" aria-hidden="true" />
                    Linie
                  </ToggleGroupItem>
                  <ToggleGroupItem value="bar" aria-label="Balkendiagramm">
                    <BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" />
                    Balken
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Aggregation Selector */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Zeitraum:</span>
                <ToggleGroup
                  type="single"
                  value={aggregation}
                  onValueChange={(value) => value && setAggregation(value)}
                  aria-label="Aggregationszeitraum auswählen"
                >
                  <ToggleGroupItem value="protocol" aria-label="Nach Protokoll">
                    Protokoll
                  </ToggleGroupItem>
                  <ToggleGroupItem value="month" aria-label="Nach Monat">
                    Monat
                  </ToggleGroupItem>
                  <ToggleGroupItem value="year" aria-label="Nach Jahr">
                    Jahr
                  </ToggleGroupItem>
                  <ToggleGroupItem value="legislature" aria-label="Nach Wahlperiode">
                    Wahlperiode
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
            <CardDescription className="mt-2">
              Mausrad zum Zoomen, ziehen zum Verschieben
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData ? (
              <div className="h-[500px] w-full">
                <ChartComponent key={chartType} ref={chartRef} data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p>Fügen Sie Wörter hinzu, um sie zu vergleichen</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {words.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <h2 className="text-xl font-semibold mb-2">Keine Wörter zum Vergleich</h2>
              <p>Fügen Sie oben Wörter hinzu, um deren Verwendung im Bundestag zu vergleichen.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* General Error Message */}
      {errors.general && (
        <Alert variant="destructive" className="mt-4" role="alert">
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
