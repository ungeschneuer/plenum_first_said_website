import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowUpDown } from 'lucide-react';
import { getSpeakers } from '../utils/api';
import { germanPlurals } from '../utils/german';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge } from '../utils/partyColors.jsx';
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

export default function SpeakerList() {
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('words-desc');
  const [filterParty, setFilterParty] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchSpeakers() {
      try {
        const data = await getSpeakers();
        setSpeakers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSpeakers();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-12 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/')} className="mt-4" variant="outline">
          Zurück zur Startseite
        </Button>
      </div>
    );
  }

  const sortOptions = [
    { value: 'words-desc', label: 'Wörter (meiste zuerst)' },
    { value: 'words-asc', label: 'Wörter (wenigste zuerst)' },
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'party', label: 'Partei' },
  ];

  const availableParties = [...new Set(
    speakers.map(s => s.party_name).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'de'));

  const filteredSpeakers = filterParty === 'all'
    ? speakers
    : speakers.filter(s => s.party_name === filterParty);

  const sortedSpeakers = [...filteredSpeakers].sort((a, b) => {
    switch (sortBy) {
      case 'words-desc':
        return b.word_count - a.word_count;
      case 'words-asc':
        return a.word_count - b.word_count;
      case 'name-asc':
        return a.name.localeCompare(b.name, 'de');
      case 'name-desc':
        return b.name.localeCompare(a.name, 'de');
      case 'party':
        return (a.party_name || '').localeCompare(b.party_name || '', 'de');
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedSpeakers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSpeakers = sortedSpeakers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent rounded-lg" aria-hidden="true">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Redner im Bundestag</h1>
            <p className="text-muted-foreground mt-1">
              {speakers.length} Redner haben neue Wörter eingeführt (ab Wahlperiode 19)
            </p>
          </div>
        </div>
      </div>

      {speakers.length === 0 ? (
        <Alert>
          <AlertDescription>
            <p className="font-medium mb-2">Noch keine Redner mit neuen Wörtern gefunden.</p>
            <p className="text-sm">
              Verarbeiten Sie Protokolle ab Wahlperiode 19 (Oktober 2017), um Rednerinformationen zu erhalten.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Filter + Sort Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <p className="text-sm text-muted-foreground">
              {sortedSpeakers.length === speakers.length
                ? `${speakers.length} Redner`
                : `${sortedSpeakers.length} von ${speakers.length} Rednern`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Party filter */}
              <Select value={filterParty} onValueChange={(value) => {
                setFilterParty(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-44" aria-label="Nach Partei filtern">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Parteien</SelectItem>
                  {availableParties.map(party => (
                    <SelectItem key={party} value={party}>{party}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Select value={sortBy} onValueChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-56" aria-label="Sortierung auswählen">
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

          {/* Empty filter result */}
          {sortedSpeakers.length === 0 && (
            <Alert className="mb-6">
              <AlertDescription>
                Keine Redner für diese Partei gefunden.
              </AlertDescription>
            </Alert>
          )}

          {/* Speaker Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {paginatedSpeakers.map((speaker) => (
              <Card
                key={speaker.speaker_id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                onClick={() => navigate(`/redner/${speaker.speaker_id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/redner/${speaker.speaker_id}`);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${speaker.name}${speaker.party_name ? `, ${speaker.party_name}` : ''}, ${germanPlurals.wort(speaker.word_count)} eingeführt`}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{speaker.name}</CardTitle>
                  {speaker.party_name && (
                    <PartyBadge party={speaker.party_name} className="w-fit mt-2" />
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {germanPlurals.wort(speaker.word_count)} eingeführt
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Seitennavigation">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Vorherige Seite"
              >
                Zurück
              </Button>
              <div className="flex items-center gap-2">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Show first, last, current, and adjacent pages
                  if (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        onClick={() => setCurrentPage(page)}
                        className="w-10"
                        aria-label={`Gehe zu Seite ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </Button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return (
                      <span key={page} className="px-2" aria-hidden="true">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Nächste Seite"
              >
                Weiter
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
