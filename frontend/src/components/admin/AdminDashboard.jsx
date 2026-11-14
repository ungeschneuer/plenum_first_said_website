import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Cpu, HardDrive, Activity, Database, FileText, Users, Building2,
  Clock, RefreshCw, Home, FolderOpen, FileCode, Play, Pause, TrendingUp,
  Sparkles, CheckCircle2, AlertCircle, BarChart3, ShieldAlert,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Progress } from '../ui/progress';

function StatCard({ title, value, unit = '', loading = false, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">
            {value !== null && value !== undefined ? value : '—'}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [systemStats, setSystemStats] = useState(null);
  const [databaseStats, setDatabaseStats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quality tab state
  const [qualityData, setQualityData] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityPage, setQualityPage] = useState(1);
  const [qualityMinOcc, setQualityMinOcc] = useState(1);
  const [qualityCapsOnly, setQualityCapsOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('system');

  const navigate = useNavigate();
  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }

    fetchAllStats();
    const interval = setInterval(fetchAllStats, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [token, navigate]);

  const fetchAllStats = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      const fetchJson = async (url) => {
        const r = await fetch(url, { headers });
        if (r.status === 401) {
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
          throw new Error('401');
        }
        return r.json();
      };

      const [system, database, queue] = await Promise.all([
        fetchJson('/api/admin/stats/system'),
        fetchJson('/api/admin/stats/database'),
        fetchJson('/api/admin/stats/queue'),
      ]);

      setSystemStats(system);
      setDatabaseStats(database);
      setQueueStats(queue);
      setError('');
    } catch (err) {
      if (!err.message.includes('401')) {
        setError('Fehler beim Laden der Statistiken');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchQualityStats = useCallback(async (page = qualityPage, minOcc = qualityMinOcc, capsOnly = qualityCapsOnly) => {
    if (!token) return;
    setQualityLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 50, min_occ: minOcc, caps_only: capsOnly });
      const res = await fetch(`/api/admin/data-quality?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setQualityData(await res.json());
    } catch (err) {
      setError('Fehler beim Laden der Datenqualitätsstatistiken');
    } finally {
      setQualityLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'quality' && !qualityData) {
      fetchQualityStats();
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System-Überwachung und Verwaltung</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Zur Website
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/database">
              <Database className="h-4 w-4 mr-2" />
              Datenbank
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/logs">
              <FileCode className="h-4 w-4 mr-2" />
              Logs
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Abmelden
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="system" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="system">
            <Cpu className="h-4 w-4 mr-2" aria-hidden="true" />
            System
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" aria-hidden="true" />
            Datenbank
          </TabsTrigger>
          <TabsTrigger value="queue">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Warteschlange
          </TabsTrigger>
          <TabsTrigger value="quality">
            <ShieldAlert className="h-4 w-4 mr-2" aria-hidden="true" />
            Datenqualität
          </TabsTrigger>
        </TabsList>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="CPU-Auslastung"
              value={systemStats?.cpu_percent}
              unit="%"
              loading={loading}
              icon={Cpu}
            />
            <StatCard
              title="Arbeitsspeicher"
              value={systemStats ? `${systemStats.memory_used_mb} / ${systemStats.memory_total_mb}` : null}
              unit="MB"
              loading={loading}
              icon={Activity}
            />
            <StatCard
              title="Festplatte"
              value={systemStats ? `${systemStats.disk_used_gb} / ${systemStats.disk_total_gb}` : null}
              unit="GB"
              loading={loading}
              icon={HardDrive}
            />
            <StatCard
              title="Betriebszeit"
              value={systemStats ? formatUptime(systemStats.uptime_seconds) : null}
              loading={loading}
              icon={Clock}
            />
            <StatCard
              title="Datenbankgröße"
              value={systemStats?.database_size_mb}
              unit="MB"
              loading={loading}
              icon={Database}
            />
          </div>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          {/* Processing Status Banner */}
          {databaseStats?.processing_active && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Verarbeitung läuft</h3>
                      <Badge variant="default">Aktiv</Badge>
                    </div>
                    {databaseStats.processing_info && (
                      <p className="text-sm text-muted-foreground">
                        PID: {databaseStats.processing_info.pid} • Laufzeit: {databaseStats.processing_info.uptime_formatted}
                      </p>
                    )}
                    {databaseStats.currently_processing && (
                      <p className="text-sm font-medium mt-1">
                        Aktuell: {databaseStats.currently_processing.id} — {databaseStats.currently_processing.title}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Protokolle gesamt"
              value={databaseStats?.total_protocols}
              loading={loading}
              icon={FileText}
            />
            <StatCard
              title="Verarbeitet"
              value={databaseStats?.processed_protocols}
              loading={loading}
              icon={CheckCircle2}
            />
            <StatCard
              title="Ausstehend"
              value={databaseStats?.unprocessed_protocols}
              loading={loading}
              icon={AlertCircle}
            />
            <StatCard
              title="Fortschritt"
              value={databaseStats?.processing_percentage}
              unit="%"
              loading={loading}
              icon={TrendingUp}
            />
          </div>

          {/* Processing Progress Bar */}
          {databaseStats && (
            <Card>
              <CardHeader>
                <CardTitle>Verarbeitungsfortschritt</CardTitle>
                <CardDescription>
                  {databaseStats.processed_protocols} von {databaseStats.total_protocols} Protokollen verarbeitet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={databaseStats.processing_percentage} className="h-3" />
              </CardContent>
            </Card>
          )}

          {/* Word Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Einzigartige Wörter"
              value={databaseStats?.total_unique_words?.toLocaleString('de-DE')}
              loading={loading}
              icon={FileText}
            />
            <StatCard
              title="Mit NLP-Daten"
              value={databaseStats?.words_with_nlp_data?.toLocaleString('de-DE')}
              loading={loading}
              icon={Sparkles}
            />
            <StatCard
              title="Wort-Vorkommen"
              value={databaseStats?.total_word_occurrences?.toLocaleString('de-DE')}
              loading={loading}
              icon={BarChart3}
            />
            <StatCard
              title="Redner"
              value={databaseStats?.total_speakers}
              loading={loading}
              icon={Users}
            />
          </div>

          {/* NLP Analysis Breakdown */}
          {databaseStats?.nlp_analysis_breakdown && databaseStats.nlp_analysis_breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>NLP-Analyse Verteilung</CardTitle>
                <CardDescription>Wörter nach Analyse-Quelle</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {databaseStats.nlp_analysis_breakdown.map((item, index) => {
                    const percentage = (item.count / databaseStats.total_unique_words) * 100;
                    const sourceLabels = {
                      'custom_dict': 'Benutzerdefiniertes Wörterbuch',
                      'spacy': 'spaCy Analyse',
                      'compound': 'Kompositum-Zerlegung',
                      'pattern': 'Muster-Erkennung'
                    };
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {sourceLabels[item.source] || item.source}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {item.count.toLocaleString('de-DE')}
                            </span>
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

          {/* Protocol Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {databaseStats?.last_processed_protocol && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <CardTitle>Zuletzt verarbeitet</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{databaseStats.last_processed_protocol.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {databaseStats.last_processed_protocol.date}
                    </p>
                    <p className="text-sm">{databaseStats.last_processed_protocol.title}</p>
                    <Badge variant="outline" className="mt-2">
                      WP {databaseStats.last_processed_protocol.wahlperiode}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {databaseStats?.next_to_process && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <CardTitle>Als nächstes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{databaseStats.next_to_process.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {databaseStats.next_to_process.date}
                    </p>
                    <p className="text-sm">{databaseStats.next_to_process.title}</p>
                    <Badge variant="outline" className="mt-2">
                      WP {databaseStats.next_to_process.wahlperiode}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {/* Overall Queue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Ausstehend"
              value={queueStats?.total_unprocessed}
              loading={loading}
              icon={Clock}
            />
            <StatCard
              title="Verarbeitet"
              value={queueStats?.total_processed}
              loading={loading}
              icon={CheckCircle2}
            />
            <StatCard
              title="Geschätzte Restzeit"
              value={queueStats?.estimated_hours_remaining}
              unit="h"
              loading={loading}
              icon={TrendingUp}
            />
            <StatCard
              title="Verarbeitungsrate"
              value={queueStats?.estimated_rate_per_min}
              unit="pro Min"
              loading={loading}
              icon={Activity}
            />
          </div>

          {/* Progress by Wahlperiode */}
          {queueStats?.progress_by_wahlperiode && queueStats.progress_by_wahlperiode.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fortschritt nach Wahlperiode</CardTitle>
                <CardDescription>Verarbeitungsstatus für alle Wahlperioden</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queueStats.progress_by_wahlperiode.map((item) => (
                    <div key={item.wahlperiode} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">WP {item.wahlperiode}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {item.processed} / {item.total}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={item.percentage === 100 ? "default" : "secondary"}>
                            {item.percentage.toFixed(1)}%
                          </Badge>
                          {item.percentage === 100 && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unprocessed Queue */}
          {queueStats?.queue_by_wahlperiode && queueStats.queue_by_wahlperiode.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ausstehende Protokolle</CardTitle>
                <CardDescription>Noch zu verarbeitende Protokolle nach Wahlperiode</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wahlperiode</TableHead>
                      <TableHead className="text-right">Ausstehende Protokolle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueStats.queue_by_wahlperiode.map((item) => (
                      <TableRow key={item.wahlperiode}>
                        <TableCell>
                          <Badge variant="outline">WP {item.wahlperiode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.unprocessed_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {queueStats?.queue_by_wahlperiode && queueStats.queue_by_wahlperiode.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <h3 className="text-lg font-semibold mt-2">Alle Protokolle verarbeitet</h3>
                  <p className="text-sm text-muted-foreground">
                    Es gibt keine ausstehenden Protokolle in der Warteschlange.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Oldest Unprocessed */}
          {queueStats?.oldest_unprocessed && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" aria-hidden="true" />
                  <CardTitle>Ältestes unverarbeitetes Protokoll</CardTitle>
                </div>
                <CardDescription>Nächstes in der Warteschlange</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-semibold">{queueStats.oldest_unprocessed.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {queueStats.oldest_unprocessed.date}
                  </p>
                  <p className="text-sm">{queueStats.oldest_unprocessed.title}</p>
                  <Badge variant="outline" className="mt-2">
                    WP {queueStats.oldest_unprocessed.wahlperiode}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Datenqualität Tab */}
        <TabsContent value="quality" className="space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="PATTERN_FALLBACK"
              value={qualityData?.pattern_fallback_total?.toLocaleString('de-DE')}
              loading={qualityLoading && !qualityData}
              icon={AlertCircle}
            />
            <StatCard
              title="COMPOUND_SPLIT"
              value={qualityData?.compound_split_total?.toLocaleString('de-DE')}
              loading={qualityLoading && !qualityData}
              icon={Sparkles}
            />
            <StatCard
              title="CUSTOM_DICT"
              value={qualityData?.custom_dict_total?.toLocaleString('de-DE')}
              loading={qualityLoading && !qualityData}
              icon={CheckCircle2}
            />
            <StatCard
              title="Unerkannte Großschreibung"
              value={qualityData?.all_caps_unrecognized?.toLocaleString('de-DE')}
              loading={qualityLoading && !qualityData}
              icon={ShieldAlert}
            />
          </div>

          {/* Filter Row */}
          <Card>
            <CardHeader>
              <CardTitle>PATTERN_FALLBACK Wörter</CardTitle>
              <CardDescription>
                Wörter, die weder von spaCy noch vom Komposita-Splitter erkannt wurden — nach Häufigkeit sortiert
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="quality-min-occ" className="text-sm font-medium whitespace-nowrap">
                    Min. Vorkommen:
                  </label>
                  <input
                    id="quality-min-occ"
                    type="number"
                    min="1"
                    value={qualityMinOcc}
                    onChange={(e) => setQualityMinOcc(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    aria-label="Mindestanzahl Vorkommen"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="quality-caps-only"
                    type="checkbox"
                    checked={qualityCapsOnly}
                    onChange={(e) => setQualityCapsOnly(e.target.checked)}
                    className="rounded border-gray-300"
                    aria-label="Nur Großschreibung anzeigen"
                  />
                  <label htmlFor="quality-caps-only" className="text-sm font-medium cursor-pointer">
                    Nur Großschreibung
                  </label>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setQualityPage(1);
                    fetchQualityStats(1, qualityMinOcc, qualityCapsOnly);
                  }}
                  aria-label="Filter anwenden"
                >
                  Anwenden
                </Button>
              </div>

              {/* Table */}
              {qualityLoading && !qualityData ? (
                <div className="space-y-2" aria-busy="true" aria-label="Lade Daten">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : qualityData?.words?.length > 0 ? (
                <>
                  <Table>
                    <caption className="sr-only">
                      PATTERN_FALLBACK Wörter sortiert nach Häufigkeit
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wort</TableHead>
                        <TableHead className="text-right">Vorkommen</TableHead>
                        <TableHead>POS</TableHead>
                        <TableHead>Genus</TableHead>
                        <TableHead>Erstmals</TableHead>
                        <TableHead className="text-center">Großschr.?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qualityData.words.map((item) => (
                        <TableRow key={item.word}>
                          <TableCell className="font-mono font-medium">
                            <Link
                              to={`/wort/${encodeURIComponent(item.word)}`}
                              className="hover:underline"
                              aria-label={`Wort ${item.word} anzeigen`}
                            >
                              {item.word}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.total_occurrences.toLocaleString('de-DE')}
                          </TableCell>
                          <TableCell>
                            {item.pos_tag
                              ? <Badge variant="outline">{item.pos_tag}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            {item.gender
                              ? <Badge variant="secondary">{item.gender}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.first_date || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.is_all_caps
                              ? <CheckCircle2 className="h-4 w-4 text-orange-500 mx-auto" aria-label="Ja" />
                              : <span className="text-muted-foreground text-xs" aria-label="Nein">—</span>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      Seite {qualityData.page} von {qualityData.pages} ({qualityData.total.toLocaleString('de-DE')} Wörter)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={qualityData.page <= 1 || qualityLoading}
                        onClick={() => {
                          const newPage = qualityData.page - 1;
                          setQualityPage(newPage);
                          fetchQualityStats(newPage, qualityMinOcc, qualityCapsOnly);
                        }}
                        aria-label="Vorherige Seite"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Zurück
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={qualityData.page >= qualityData.pages || qualityLoading}
                        onClick={() => {
                          const newPage = qualityData.page + 1;
                          setQualityPage(newPage);
                          fetchQualityStats(newPage, qualityMinOcc, qualityCapsOnly);
                        }}
                        aria-label="Nächste Seite"
                      >
                        Weiter
                        <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : qualityData ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine PATTERN_FALLBACK Wörter für die gewählten Filter gefunden.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
