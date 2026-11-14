import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, FileText, ExternalLink, Video, TrendingUp, ZoomOut, BarChart3, LineChart, GitCompare } from 'lucide-react';
import { getWordTimeline, getWordDetails } from '../utils/api';
import Chart from './Chart';
import { formatGermanDate, formatLegislature, formatLegislatureShort, germanPlurals } from '../utils/german';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge } from '../utils/partyColors.jsx';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export default function WordTimeline() {
  const { word } = useParams();
  const navigate = useNavigate();
  const [timelineData, setTimelineData] = useState([]);
  const [wordDetails, setWordDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPercentage, setShowPercentage] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [aggregation, setAggregation] = useState('protocol'); // protocol, month, year, legislature
  const chartRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [timeline, details] = await Promise.all([
          getWordTimeline(word),
          getWordDetails(word)
        ]);

        setTimelineData(timeline);
        setWordDetails(details);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [word]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
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
        <Button onClick={() => navigate('/')} className="mt-4" variant="outline" aria-label="Zurück zur Suche">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück zur Suche
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-6" aria-label="Zurück zur Suche">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Zurück zur Suche
      </Button>

      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{word}</h1>
        <p className="text-muted-foreground">Worthäufigkeitsverlauf im Bundestag</p>
      </div>

      {/* Word Details */}
      {wordDetails && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm font-medium">Erstes Vorkommen</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatGermanDate(wordDetails.first_date)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatLegislature(wordDetails.wahlperiode, wordDetails.protokollnummer)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm font-medium">Zuerst gesagt von</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {wordDetails.speaker_name ? (
                <>
                  {wordDetails.first_speaker_id ? (
                    <Link
                      to={`/redner/${wordDetails.first_speaker_id}`}
                      className="text-2xl font-bold hover:underline"
                      aria-label={`Alle Wörter von ${wordDetails.speaker_name} anzeigen`}
                    >
                      {wordDetails.speaker_name}
                    </Link>
                  ) : (
                    <div className="text-2xl font-bold">{wordDetails.speaker_name}</div>
                  )}
                  {wordDetails.party_at_time_name && (
                    wordDetails.party_at_time_id ? (
                      <Link
                        to={`/parteien/${wordDetails.party_at_time_id}`}
                        className="block w-fit mt-2"
                        aria-label={`Alle Wörter der ${wordDetails.party_at_time_name} anzeigen`}
                      >
                        <PartyBadge party={wordDetails.party_at_time_name} className="cursor-pointer" />
                      </Link>
                    ) : (
                      <PartyBadge party={wordDetails.party_at_time_name} className="mt-2" />
                    )
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">Unbekannt</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm font-medium">Statistik</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{germanPlurals.vorkommen(wordDetails.total_count)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                in {germanPlurals.protokoll(timelineData.length)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Abbreviation — shown when word is an abbreviation */}
        {wordDetails.is_abbreviation && (
          <div
            className="flex flex-wrap items-center gap-2 mb-6"
            aria-label="Abkürzung"
          >
            <span className="text-sm text-muted-foreground shrink-0">Abkürzung für:</span>
            {wordDetails.full_form
              ? <Badge variant="secondary">{wordDetails.full_form}</Badge>
              : <span className="text-sm text-muted-foreground italic">unbekannt</span>
            }
          </div>
        )}

        {/* Inflected forms — only shown when variants exist */}
        {(wordDetails.inflected_forms?.length > 1 || wordDetails.first_spoken_form) && (
          <div
            className="flex flex-wrap items-center gap-2 mb-6"
            aria-label="Zusammengefasste grammatische Formen"
          >
            {wordDetails.inflected_forms?.length > 1 && (
              <>
                <span className="text-sm text-muted-foreground shrink-0">
                  Fasst zusammen:
                </span>
                {wordDetails.inflected_forms.map((form, i) => (
                  <Badge
                    key={form}
                    variant={i === 0 ? 'secondary' : 'outline'}
                    className="font-mono"
                  >
                    {form}
                  </Badge>
                ))}
              </>
            )}
            {wordDetails.first_spoken_form && (
              <>
                {wordDetails.inflected_forms?.length > 1 && (
                  <span className="text-muted-foreground mx-1" aria-hidden="true">·</span>
                )}
                <span
                  className="text-sm text-muted-foreground shrink-0"
                  title="Diese Form steht im Originalprotokoll und kann in der PDF und bei OpenParliamentTV gesucht werden"
                >
                  Originalform:
                </span>
                <Badge
                  variant="destructive"
                  className="font-mono"
                  title="Originalform aus dem Protokoll — zum Suchen in der PDF und bei OpenParliamentTV verwenden"
                >
                  {wordDetails.first_spoken_form}
                </Badge>
              </>
            )}
          </div>
        )}
        </>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-3 mb-8">
        {/* Comparison Link */}
        <Button variant="default" asChild>
          <Link to={`/vergleich?words=${encodeURIComponent(word)}`}>
            <GitCompare className="h-4 w-4 mr-2" aria-hidden="true" />
            Mit anderen Wörtern vergleichen
          </Link>
        </Button>

        {/* External Links */}
        {wordDetails && wordDetails.pdf_url && (
          <Button variant="outline" asChild>
            <a href={wordDetails.pdf_url} target="_blank" rel="noopener noreferrer" aria-label="PDF Protokoll ansehen (öffnet in neuem Tab)">
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              PDF ansehen
              <ExternalLink className="h-3 w-3 ml-2" aria-hidden="true" />
            </a>
          </Button>
        )}
        {wordDetails && wordDetails.optv_link && (
          <Button variant="outline" asChild>
            <a href={wordDetails.optv_link} target="_blank" rel="noopener noreferrer" aria-label="Video ansehen (öffnet in neuem Tab)">
              <Video className="h-4 w-4 mr-2" aria-hidden="true" />
              Video ansehen
              <ExternalLink className="h-3 w-3 ml-2" aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>

      {/* Tabs for Chart and Details */}
      <Tabs defaultValue="chart" className="space-y-6">
        <TabsList>
          <TabsTrigger value="chart">Häufigkeitszeitachse</TabsTrigger>
          <TabsTrigger value="details">Protokolldetails</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Häufigkeitsverlauf</CardTitle>
                  <div className="flex items-center gap-4">
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
                    <label htmlFor="show-percentage" className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        id="show-percentage"
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
                <div className="flex items-center gap-3">
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
                <div className="flex items-center gap-3">
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
                Mausrad zum Zoomen, ziehen zum Verschieben, Punkte anklicken für Protokolldetails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Chart ref={chartRef} timelineData={timelineData} showPercentage={showPercentage} chartType={chartType} aggregation={aggregation} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Protokolldetails</CardTitle>
              <CardDescription>
                Detaillierte Aufschlüsselung nach Sitzungsprotokoll
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <caption className="sr-only">
                  Detaillierte Aufschlüsselung der Worthäufigkeit nach Protokoll
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>WP</TableHead>
                    <TableHead>Protokoll</TableHead>
                    <TableHead className="text-right">Anzahl</TableHead>
                    <TableHead className="text-right">Prozentsatz</TableHead>
                    <TableHead><span className="sr-only">Aktionen</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timelineData.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatGermanDate(point.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{point.wahlperiode}</Badge>
                      </TableCell>
                      <TableCell>{point.protokollnummer}</TableCell>
                      <TableCell className="text-right font-medium">{point.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {point.percentage.toFixed(4)}%
                      </TableCell>
                      <TableCell>
                        {point.pdf_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={point.pdf_url} target="_blank" rel="noopener noreferrer" aria-label="PDF Protokoll ansehen">
                              <FileText className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">PDF ansehen</span>
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
