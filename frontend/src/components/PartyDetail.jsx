import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, Users } from 'lucide-react';
import { getPartyDetails, getPartyWords } from '../utils/api';
import { formatGermanDate, formatLegislature, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export default function PartyDetail() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const [party, setParty] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [totalWords, setTotalWords] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [partyData, wordsData] = await Promise.all([
          getPartyDetails(partyId),
          getPartyWords(partyId)
        ]);

        setParty(partyData);

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
  }, [partyId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
        <Button onClick={() => navigate('/parteien')} className="mt-4" variant="outline" aria-label="Zurück zur Parteienübersicht">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück zur Parteienübersicht
        </Button>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert>
          <AlertDescription>Keine Daten verfügbar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayWords = showAll ? words : words.slice(0, 20);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/parteien')} className="mb-6" aria-label="Zurück zur Parteienübersicht">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Parteienübersicht
      </Button>

      {/* Party Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-accent rounded-lg" aria-hidden="true">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">{party.name}</h1>
            {party.short_name && party.short_name !== party.name && (
              <p className="text-muted-foreground mt-1">({party.short_name})</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
      </div>

      {/* Words Table */}
      <Card>
        <CardHeader>
          <CardTitle>Von Parteimitgliedern erstmals verwendete Wörter ({totalWords ?? words.length})</CardTitle>
          <CardDescription>
            Wörter, die Mitglieder von {party.name} als Erste im Bundestag verwendeten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {words.length === 0 ? (
            <Alert>
              <AlertDescription>
                Für diese Partei wurden noch keine erstmals verwendeten Wörter gefunden.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Table>
                <caption className="sr-only">
                  Von {party.name} Mitgliedern erstmals verwendete Wörter im Bundestag
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wort</TableHead>
                    <TableHead>Redner/in</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>WP</TableHead>
                    <TableHead>Protokoll</TableHead>
                    <TableHead className="text-right">Vorkommen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayWords.map((word) => (
                    <TableRow key={`${word.word}-${word.speaker_name}`}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/wort/${encodeURIComponent(word.word)}`}
                          className="text-primary hover:underline"
                        >
                          {word.word}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {word.speaker_id ? (
                          <Link
                            to={`/redner/${word.speaker_id}`}
                            className="text-primary hover:underline"
                          >
                            {word.speaker_name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{word.speaker_name || '-'}</span>
                        )}
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
                        {word.first_protocol_id ? (
                          <Link
                            to={`/protokoll/${word.first_protocol_id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {word.wahlperiode}/{word.protokollnummer}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {word.wahlperiode}/{word.protokollnummer}
                          </span>
                        )}
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
