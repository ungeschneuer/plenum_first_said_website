import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Sparkles, TrendingUp, ExternalLink } from 'lucide-react';
import { getProtocolDetails, getProtocolNewWords, getProtocolWords } from '../utils/api';
import { formatGermanDate, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge } from '../utils/partyColors.jsx';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function ProtocolDetail() {
  const { protocolId } = useParams();
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState(null);
  const [newWords, setNewWords] = useState([]);
  const [topWords, setTopWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllWords, setShowAllWords] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [protocolData, newWordsData, topWordsData] = await Promise.all([
          getProtocolDetails(protocolId),
          getProtocolNewWords(protocolId),
          getProtocolWords(protocolId, 20)
        ]);

        setProtocol(protocolData);
        setNewWords(newWordsData);

        // Handle paginated response for topWords
        if (topWordsData && topWordsData.items) {
          setTopWords(topWordsData.items);
        } else if (Array.isArray(topWordsData)) {
          setTopWords(topWordsData);
        } else {
          setTopWords([]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [protocolId]);

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
        <Button onClick={() => navigate(-1)} className="mt-4" variant="outline" aria-label="Zurück">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück
        </Button>
      </div>
    );
  }

  const displayTopWords = showAllWords ? topWords : topWords.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(`/wahlperiode/${protocol.wahlperiode}`)}
        className="mb-6"
        aria-label={`Zurück zur Wahlperiode ${protocol.wahlperiode}`}
      >
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Wahlperiode {protocol.wahlperiode}
      </Button>

      {/* Protocol Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          Protokoll {protocol.wahlperiode}/{protocol.protokollnummer}
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{formatGermanDate(protocol.datum)}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-sm font-medium">Gesamtwörter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {protocol.total_words?.toLocaleString('de-DE') || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-sm font-medium">Einzigartige Wörter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {protocol.unique_words?.toLocaleString('de-DE') || 'N/A'}
            </p>
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
            <p className="text-2xl font-bold">
              {protocol.new_words_count || newWords.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PDF Link */}
      {protocol.pdf_url && (
        <div className="mb-8">
          <Button variant="outline" asChild>
            <a href={protocol.pdf_url} target="_blank" rel="noopener noreferrer" aria-label="PDF-Dokument ansehen (öffnet in neuem Tab)">
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              PDF-Dokument ansehen
              <ExternalLink className="h-3 w-3 ml-2" aria-hidden="true" />
            </a>
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="new" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new">
            <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
            Neue Wörter ({newWords.length})
          </TabsTrigger>
          <TabsTrigger value="top">
            <TrendingUp className="h-4 w-4 mr-2" aria-hidden="true" />
            Häufigste Wörter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Neue Wörter in diesem Protokoll</CardTitle>
              <CardDescription>
                Wörter, die in diesem Protokoll zum ersten Mal im Bundestag verwendet wurden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {newWords.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Keine neuen Wörter in diesem Protokoll gefunden.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <caption className="sr-only">
                    Neue Wörter die zum ersten Mal in Protokoll {protocol.wahlperiode}/{protocol.protokollnummer} verwendet wurden
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wort</TableHead>
                      <TableHead>Häufigkeit</TableHead>
                      {newWords.some(w => w.speaker_name) && <TableHead>Erstmals gesagt von</TableHead>}
                      <TableHead className="text-right">Gesamtvorkommen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newWords.map((word) => (
                      <TableRow key={word.word}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/wort/${encodeURIComponent(word.word)}`}
                            className="text-primary hover:underline"
                          >
                            {word.word}
                          </Link>
                        </TableCell>
                        <TableCell>{word.count}</TableCell>
                        {newWords.some(w => w.speaker_name) && (
                          <TableCell>
                            {word.speaker_name ? (
                              <div className="flex items-center gap-2">
                                {word.first_speaker_id ? (
                                  <Link
                                    to={`/redner/${word.first_speaker_id}`}
                                    className="text-primary hover:underline"
                                  >
                                    {word.speaker_name}
                                  </Link>
                                ) : (
                                  <span>{word.speaker_name}</span>
                                )}
                                {word.party_at_time_name && (
                                  <PartyBadge party={word.party_at_time_name} className="text-xs" />
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">{word.total_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle>Häufigste Wörter</CardTitle>
              <CardDescription>
                Die am häufigsten verwendeten Wörter in diesem Protokoll
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topWords.length === 0 ? (
                <Alert>
                  <AlertDescription>Keine Daten verfügbar.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Table>
                    <caption className="sr-only">
                      Häufigste Wörter in Protokoll {protocol.wahlperiode}/{protocol.protokollnummer}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rang</TableHead>
                        <TableHead>Wort</TableHead>
                        <TableHead className="text-right">Häufigkeit</TableHead>
                        <TableHead className="text-right">Gesamtvorkommen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayTopWords.map((word, index) => (
                        <TableRow key={word.word}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <Link
                              to={`/wort/${encodeURIComponent(word.word)}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {word.word}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{word.count}</TableCell>
                          <TableCell className="text-right">{word.total_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {topWords.length > 10 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        onClick={() => setShowAllWords(!showAllWords)}
                      >
                        {showAllWords
                          ? 'Weniger anzeigen'
                          : `${topWords.length - 10} weitere Wörter anzeigen`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
