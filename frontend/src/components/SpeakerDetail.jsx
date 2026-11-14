import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Building2, FileText, ExternalLink, Calendar } from 'lucide-react';
import { getSpeakerDetails, getSpeakerWords } from '../utils/api';
import { formatGermanDate, formatLegislature, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge, getPartyFullName } from '../utils/partyColors.jsx';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';

export default function SpeakerDetail() {
  const { speakerId } = useParams();
  const navigate = useNavigate();
  const [speaker, setSpeaker] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [totalWords, setTotalWords] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [speakerData, wordsData] = await Promise.all([
          getSpeakerDetails(speakerId),
          getSpeakerWords(speakerId)
        ]);

        setSpeaker(speakerData);

        if (wordsData && wordsData.items) {
          setWords(wordsData.items);
          setTotalWords(wordsData.pagination?.total ?? wordsData.items.length);
        } else {
          setWords([]);
          setTotalWords(0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [speakerId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
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
        <Button onClick={() => navigate('/redner')} className="mt-4" variant="outline" aria-label="Zurück zur Rednerliste">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück zur Rednerliste
        </Button>
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert>
          <AlertDescription>Keine Daten verfügbar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayWords = showAll ? words : words.slice(0, 20);
  const initials = speaker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/redner')} className="mb-6" aria-label="Zurück zur Rednerliste">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Rednerliste
      </Button>

      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-8">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{speaker.name}</h1>
          {speaker.party_name && (
            <PartyBadge party={speaker.party_name} className="text-base px-3 py-1" />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-sm font-medium">Partei</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{getPartyFullName(speaker.party_name) || 'Unbekannt'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-sm font-medium">Eingeführte Wörter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalWords ?? words.length}</p>
          </CardContent>
        </Card>

        {speaker.optv_link && (
          <Card className="cursor-pointer transition-colors hover:bg-accent" asChild>
            <a href={speaker.optv_link} target="_blank" rel="noopener noreferrer" aria-label="OpenParliamentTV Profil ansehen (öffnet in neuem Tab)">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm font-medium">OpenParliamentTV</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Profil ansehen →</p>
              </CardContent>
            </a>
          </Card>
        )}
      </div>

      {/* Words Table */}
      <Card>
        <CardHeader>
          <CardTitle>Erstmals verwendete Wörter ({totalWords ?? words.length})</CardTitle>
          <CardDescription>
            Wörter, die {speaker.name} als Erste/r im Bundestag verwendete
          </CardDescription>
        </CardHeader>
        <CardContent>
          {words.length === 0 ? (
            <Alert>
              <AlertDescription>
                Für diese/n Redner/in wurden noch keine erstmals verwendeten Wörter gefunden.
                {speaker.optv_link && (
                  <> Möglicherweise sind Daten auf{' '}
                    <a
                      href={speaker.optv_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      OpenParliamentTV
                    </a>{' '}
                    verfügbar.
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Table>
                <caption className="sr-only">
                  Von {speaker.name} erstmals verwendete Wörter im Bundestag
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wort</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Wahlperiode</TableHead>
                    <TableHead>Protokoll</TableHead>
                    <TableHead className="text-right">Vorkommen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayWords.map((word) => (
                    <TableRow key={word.word}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/wort/${encodeURIComponent(word.word)}`}
                          className="text-primary hover:underline"
                        >
                          {word.word}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatGermanDate(word.datum)}
                      </TableCell>
                      <TableCell>
                        <Link to={`/wahlperiode/${word.wahlperiode}`}>
                          <Badge variant="outline">{word.wahlperiode}. WP</Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/protokoll/${word.first_protocol_id}`}
                          className="text-primary hover:underline text-sm"
                        >
                          {word.wahlperiode}/{word.protokollnummer}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {word.total_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {words.length > 20 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                    {showAll
                      ? 'Weniger anzeigen'
                      : `${words.length - 20} weitere Wörter anzeigen`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
