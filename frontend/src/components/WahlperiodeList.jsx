import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowUpDown, FileText, CheckCircle } from 'lucide-react';
import { getWahlperioden } from '../utils/api';
import { formatGermanDate, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export default function WahlperiodeList() {
  const [wahlperioden, setWahlperioden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('number-desc');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getWahlperioden();
        setWahlperioden(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-12 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/')} className="mt-4" variant="outline" aria-label="Zurück zur Startseite">
          Zurück zur Startseite
        </Button>
      </div>
    );
  }

  const sortOptions = [
    { value: 'number-desc', label: 'Neueste zuerst (Standard)' },
    { value: 'number-asc', label: 'Älteste zuerst' },
    { value: 'protocols-desc', label: 'Protokolle (meiste zuerst)' },
    { value: 'protocols-asc', label: 'Protokolle (wenigste zuerst)' },
  ];

  const sortedWahlperioden = [...wahlperioden].sort((a, b) => {
    switch (sortBy) {
      case 'number-desc':
        return b.wahlperiode - a.wahlperiode;
      case 'number-asc':
        return a.wahlperiode - b.wahlperiode;
      case 'protocols-desc':
        return b.protocol_count - a.protocol_count;
      case 'protocols-asc':
        return a.protocol_count - b.protocol_count;
      default:
        return 0;
    }
  });

  const totalProtocols = wahlperioden.reduce((sum, wp) => sum + wp.protocol_count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg" aria-hidden="true">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Wahlperioden des Deutschen Bundestags</h1>
            <p className="text-muted-foreground mt-1">
              {germanPlurals.protokoll(totalProtocols)} in der Datenbank
            </p>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-64" aria-label="Sortierung auswählen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Wahlperioden Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedWahlperioden.map((wp) => (
          <Card
            key={wp.wahlperiode}
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
            onClick={() => navigate(`/wahlperiode/${wp.wahlperiode}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/wahlperiode/${wp.wahlperiode}`);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${wp.wahlperiode}. Wahlperiode: ${formatGermanDate(wp.start_date)} bis ${formatGermanDate(wp.end_date)}, ${wp.protocol_count} Protokolle, ${wp.processed_count} verarbeitet`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold">{wp.wahlperiode}.</CardTitle>
                  <CardDescription className="mt-1">Wahlperiode</CardDescription>
                </div>
                <div className="p-2 bg-accent rounded-lg" aria-hidden="true">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {formatGermanDate(wp.start_date)} - {formatGermanDate(wp.end_date)}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span className="text-sm">Protokolle</span>
                  </div>
                  <Badge variant="secondary">{wp.protocol_count}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                    <span className="text-sm">Verarbeitet</span>
                  </div>
                  <Badge variant="secondary">{wp.processed_count}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
