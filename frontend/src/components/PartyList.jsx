import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowUpDown, Users, FileText } from 'lucide-react';
import { getParties } from '../utils/api';
import { germanPlurals } from '../utils/german';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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

export default function PartyList() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('words-desc');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchParties() {
      try {
        const data = await getParties();
        setParties(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchParties();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-12 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
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
    { value: 'words-desc', label: 'Wörter (meiste zuerst)' },
    { value: 'words-asc', label: 'Wörter (wenigste zuerst)' },
    { value: 'speakers-desc', label: 'Redner (meiste zuerst)' },
    { value: 'speakers-asc', label: 'Redner (wenigste zuerst)' },
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
  ];

  const sortedParties = [...parties].sort((a, b) => {
    switch (sortBy) {
      case 'words-desc':
        return b.word_count - a.word_count;
      case 'words-asc':
        return a.word_count - b.word_count;
      case 'speakers-desc':
        return b.speaker_count - a.speaker_count;
      case 'speakers-asc':
        return a.speaker_count - b.speaker_count;
      case 'name-asc':
        return a.name.localeCompare(b.name, 'de');
      case 'name-desc':
        return b.name.localeCompare(a.name, 'de');
      default:
        return 0;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg" aria-hidden="true">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Parteien im Bundestag</h1>
            <p className="text-muted-foreground mt-1">
              Wörter eingeführt von Bundestagsfraktionen (ab Wahlperiode 19)
            </p>
          </div>
        </div>
      </div>

      {parties.length === 0 ? (
        <Alert>
          <AlertDescription>
            <p className="font-medium mb-2">Noch keine Parteidaten verfügbar.</p>
            <p className="text-sm">
              Verarbeiten Sie Protokolle ab Wahlperiode 19 (Oktober 2017), um Parteistatistiken zu erhalten.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <>
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

          {/* Party Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedParties.map((party) => (
              <Card
                key={party.party_id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                onClick={() => navigate(`/parteien/${party.party_id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/parteien/${party.party_id}`);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${party.name}: ${party.speaker_count} Redner, ${party.word_count} Wörter`}
              >
                <CardHeader>
                  <CardTitle className="text-xl">{party.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        <span className="text-sm">Redner</span>
                      </div>
                      <Badge variant="secondary">{party.speaker_count}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span className="text-sm">Wörter</span>
                      </div>
                      <Badge variant="secondary">{party.word_count}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
