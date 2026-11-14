import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, FileText, Sparkles, CheckCircle, ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { getWahlperiodeDetails, getWahlperiodeProtocols, getWahlperiodeStats, getNewWordsRanking } from '../utils/api';
import { formatGermanDate, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge } from '../utils/partyColors.jsx';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Progress } from './ui/progress';

export default function WahlperiodeDetail() {
  const { wpNumber } = useParams();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState(null);
  const [protocols, setProtocols] = useState([]);
  const [stats, setStats] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('number-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Check if this Wahlperiode is eligible for ranking (2014+, which is WP 18+)
  const showRanking = parseInt(wpNumber) >= 18;

  useEffect(() => {
    async function fetchData() {
      try {
        const promises = [
          getWahlperiodeDetails(parseInt(wpNumber)),
          getWahlperiodeProtocols(parseInt(wpNumber)),
          getWahlperiodeStats(parseInt(wpNumber))
        ];

        // Add ranking data for WP 18+ (2014+)
        if (showRanking) {
          promises.push(getNewWordsRanking(parseInt(wpNumber), null, 10));
        }

        const results = await Promise.all(promises);

        setMetadata(results[0]);
        setProtocols(results[1]);
        setStats(results[2]);
        if (showRanking && results[3]) {
          setRanking(results[3]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [wpNumber, showRanking]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-12 w-96 mb-2" />
        <Skeleton className="h-6 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/wahlperioden')} className="mt-4" variant="outline" aria-label="Zurück zur Übersicht">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const sortOptions = [
    { value: 'number-asc', label: 'Protokoll-Nr. (aufsteigend)' },
    { value: 'number-desc', label: 'Protokoll-Nr. (absteigend)' },
    { value: 'date-asc', label: 'Datum (älteste zuerst)' },
    { value: 'date-desc', label: 'Datum (neueste zuerst)' },
    { value: 'words-desc', label: 'Wörter (meiste zuerst)' },
    { value: 'words-asc', label: 'Wörter (wenigste zuerst)' },
    { value: 'status', label: 'Status (verarbeitet zuerst)' },
  ];

  const sortedProtocols = [...protocols].sort((a, b) => {
    switch (sortBy) {
      case 'number-asc':
        return a.protokollnummer - b.protokollnummer;
      case 'number-desc':
        return b.protokollnummer - a.protokollnummer;
      case 'date-asc':
        return new Date(a.datum) - new Date(b.datum);
      case 'date-desc':
        return new Date(b.datum) - new Date(a.datum);
      case 'words-desc':
        return (b.total_words || 0) - (a.total_words || 0);
      case 'words-asc':
        return (a.total_words || 0) - (b.total_words || 0);
      case 'status':
        return b.processed - a.processed;
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedProtocols.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProtocols = sortedProtocols.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/wahlperioden')}
        className="mb-6"
        aria-label="Zurück zur Übersicht"
      >
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Übersicht
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{wpNumber}. Deutscher Bundestag</h1>
        {metadata.start_date && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>
              {formatGermanDate(metadata.start_date)} - {metadata.end_date ? formatGermanDate(metadata.end_date) : 'Heute'}
            </span>
          </div>
        )}
      </div>

      {/* Political Information */}
      {(metadata.chancellor || metadata.election_date) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Regierung und Parlament</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metadata.election_date && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Bundestagswahl:</span>
                  <span className="font-medium">{formatGermanDate(metadata.election_date)}</span>
                </div>
              )}
              {metadata.chancellor && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Bundeskanzler/in:</span>
                  <span className="font-medium">{metadata.chancellor}</span>
                </div>
              )}
              {metadata.coalition && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Koalition:</span>
                  <span className="font-medium">{metadata.coalition}</span>
                </div>
              )}
              {metadata.bundestag_president && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Bundestagspräsident/in:</span>
                  <span className="font-medium">{metadata.bundestag_president}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parliament Composition */}
      {metadata.parliament_composition && metadata.parliament_composition.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Zusammensetzung des Bundestags</CardTitle>
            <CardDescription>{metadata.total_seats} Sitze</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metadata.parliament_composition.map((party, index) => {
                const percentage = ((party.seats / metadata.total_seats) * 100);
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{party.party}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{party.seats} Sitze</span>
                        <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cabinet Members */}
      {metadata.cabinet_members && metadata.cabinet_members.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Bundeskabinett</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <caption className="sr-only">
                Bundeskabinett Mitglieder der {wpNumber}. Wahlperiode
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amt</TableHead>
                  <TableHead>Partei</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metadata.cabinet_members.slice(0, 15).map((minister, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{minister.name}</TableCell>
                    <TableCell>{minister.position}</TableCell>
                    <TableCell>
                      {minister.party ? (
                        <PartyBadge party={minister.party} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {metadata.cabinet_members.length > 15 && (
              <p className="text-sm text-muted-foreground mt-4">
                ... und {metadata.cabinet_members.length - 15} weitere Kabinettsmitglieder
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm font-medium">Protokolle gesamt</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_protocols}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm font-medium">Verarbeitet</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.processed_protocols}</p>
            </CardContent>
          </Card>

          {stats.unique_words > 0 && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm font-medium">Eindeutige Wörter</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.unique_words.toLocaleString('de-DE')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm font-medium">Neue Wörter</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.new_words?.toLocaleString('de-DE')}</p>
                </CardContent>
              </Card>
            </>
          )}

          {stats.speakers_count > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm font-medium">Redner/innen</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.speakers_count}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* New Words Ranking (only for WP 18+ / 2014+) */}
      {showRanking && ranking && ranking.rankings && ranking.rankings.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle>Neue Wörter - Ranking</CardTitle>
            </div>
            <CardDescription>
              Abgeordnete, die die meisten neuen Wörter in dieser Wahlperiode eingeführt haben
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <caption className="sr-only">
                Top 10 Abgeordnete mit den meisten neuen Wörtern in der {wpNumber}. Wahlperiode
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rang</TableHead>
                  <TableHead>Abgeordnete/r</TableHead>
                  <TableHead>Partei</TableHead>
                  <TableHead className="text-right">Neue Wörter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.rankings.map((item, index) => (
                  <TableRow key={item.primary_speaker_id || item.canonical_id || index}>
                    <TableCell className="font-medium">
                      {index + 1 === 1 && <span className="text-2xl">🥇</span>}
                      {index + 1 === 2 && <span className="text-2xl">🥈</span>}
                      {index + 1 === 3 && <span className="text-2xl">🥉</span>}
                      {index + 1 > 3 && <span className="text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell>
                      {item.primary_speaker_id ? (
                        <Link
                          to={`/redner/${item.primary_speaker_id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {item.mp_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{item.mp_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.current_party ? (
                        <PartyBadge party={item.current_party} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-lg">{item.new_words_count.toLocaleString('de-DE')}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ranking.total_mps > 10 && (
              <p className="text-sm text-muted-foreground mt-4">
                Top 10 von insgesamt {ranking.total_mps} Abgeordneten mit neuen Wörtern
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Protocols List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Protokolle</CardTitle>
              <CardDescription>{protocols.length} {germanPlurals.protokoll(protocols.length)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Select value={sortBy} onValueChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
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
        </CardHeader>
        <CardContent>
          <Table>
            <caption className="sr-only">
              Protokolle der {wpNumber}. Wahlperiode
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nr.</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="text-right">Wörter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"><span className="sr-only">Aktionen</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProtocols.map((protocol) => (
                <TableRow key={protocol.id}>
                  <TableCell className="font-medium">{protocol.protokollnummer}</TableCell>
                  <TableCell>{formatGermanDate(protocol.datum)}</TableCell>
                  <TableCell>{protocol.titel || '-'}</TableCell>
                  <TableCell className="text-right">
                    {protocol.total_words?.toLocaleString('de-DE') || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={protocol.processed ? 'default' : 'secondary'}>
                      {protocol.processed ? 'Verarbeitet' : 'Ausstehend'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {protocol.processed ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/protokoll/${protocol.id}`)}
                      >
                        Details
                      </Button>
                    ) : (
                      protocol.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={protocol.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="PDF ansehen (öffnet in neuem Tab)"
                          >
                            PDF
                            <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
                          </a>
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 mt-4" aria-label="Seitennavigation">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Vorherige Seite"
              >
                Zurück
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        aria-label={`Gehe zu Seite ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </Button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
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
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Nächste Seite"
              >
                Weiter
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
