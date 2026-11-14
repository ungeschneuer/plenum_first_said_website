import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, Database, RefreshCw, FileCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [lines, setLines] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }

    loadLogs();

    if (autoRefresh) {
      const interval = setInterval(loadLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [token, navigate, lines, autoRefresh]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/logs?lines=${lines}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Fehler beim Laden der Logs');

      const data = await response.json();
      setLogs(data.logs);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const handleLinesChange = (e) => {
    setLines(parseInt(e.target.value));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">System-Logs</h1>
          <p className="text-muted-foreground mt-1">Anwendungsprotokolle</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Zur Website
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/database">
              <Database className="h-4 w-4 mr-2" />
              Datenbank
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

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Anzeigeoptionen</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="lines">Anzahl Zeilen:</Label>
            <Select value={lines.toString()} onValueChange={(value) => setLines(parseInt(value))}>
              <SelectTrigger id="lines" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Auto-Aktualisierung (3s)</span>
              {autoRefresh && <Badge variant="secondary">Aktiv</Badge>}
            </label>
          </div>

          <Button onClick={loadLogs} disabled={loading} variant="outline" className="ml-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Laden...' : 'Aktualisieren'}
          </Button>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log-Ausgabe</CardTitle>
              <CardDescription>
                Letzte {lines} Zeilen aus <code className="text-xs bg-muted px-1 py-0.5 rounded">backend/app.log</code>
              </CardDescription>
            </div>
            {logs.length > 0 && (
              <Badge variant="outline">
                <FileCode className="h-3 w-3 mr-1" />
                {logs.length} Zeilen
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ScrollArea className="h-[600px] w-full rounded border bg-muted/50">
              <pre className="p-4 text-xs font-mono">
                {logs.map((line, index) => (
                  <div key={index} className="leading-relaxed">
                    {line}
                  </div>
                ))}
              </pre>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Keine Logs gefunden. Die Log-Datei befindet sich unter{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">backend/app.log</code>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
