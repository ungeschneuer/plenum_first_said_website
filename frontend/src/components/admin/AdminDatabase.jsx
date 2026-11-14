import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database, Save, Zap, Home, LayoutDashboard, FileCode,
  AlertTriangle, CheckCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';

export default function AdminDatabase() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVacuumDialog, setShowVacuumDialog] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }

    loadBackups();
  }, [token, navigate]);

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/admin/database/backups', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Fehler beim Laden der Backups');

      const data = await response.json();
      setBackups(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const createBackup = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/database/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Backup erfolgreich erstellt: ${data.backup_file} (${data.backup_size_mb} MB)`);
        loadBackups();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen des Backups');
    } finally {
      setLoading(false);
    }
  };

  const vacuumDatabase = async () => {
    setShowVacuumDialog(false);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/database/vacuum', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Fehler beim Optimieren der Datenbank');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('de-DE');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Datenbank-Verwaltung</h1>
          <p className="text-muted-foreground mt-1">Backups und Wartung</p>
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

      {/* Database Operations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Datenbank-Operationen</CardTitle>
          <CardDescription>
            Backups werden im Verzeichnis <code className="text-xs bg-muted px-1 py-0.5 rounded">backend/backups/</code> gespeichert.
            VACUUM gibt ungenutzten Speicherplatz frei und optimiert die Datenbank.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={createBackup} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Backup erstellen
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setShowVacuumDialog(true)} disabled={loading}>
            <Zap className="h-4 w-4 mr-2" />
            Datenbank optimieren (VACUUM)
          </Button>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Backup-Verlauf</CardTitle>
          <CardDescription>Übersicht aller erstellten Datenbank-Backups</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dateiname</TableHead>
                  <TableHead className="text-right">Größe</TableHead>
                  <TableHead className="text-right">Erstellt am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                    <TableCell className="text-right">{backup.size_mb} MB</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(backup.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">Keine Backups gefunden</p>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium">Warnung</p>
          <p className="text-sm mt-1">
            Diese Operationen können die Datenbank beeinflussen. Erstellen Sie immer
            ein Backup, bevor Sie wichtige Änderungen vornehmen. Backups sind nicht
            automatisiert und müssen manuell erstellt werden.
          </p>
        </AlertDescription>
      </Alert>

      {/* Vacuum Confirmation Dialog */}
      <Dialog open={showVacuumDialog} onOpenChange={setShowVacuumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datenbank optimieren?</DialogTitle>
            <DialogDescription>
              Dies kann einige Sekunden dauern. Die Datenbank wird während dieser Zeit optimiert
              und ungenutzter Speicherplatz wird freigegeben.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVacuumDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={vacuumDatabase}>
              <Zap className="h-4 w-4 mr-2" />
              Optimieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
