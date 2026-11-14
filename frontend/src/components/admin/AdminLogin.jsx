import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Label } from '../ui/label';

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Falsches Passwort');
      }

      const data = await response.json();
      localStorage.setItem('admin_token', data.access_token);
      onLogin(data.access_token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-accent rounded-full" aria-hidden="true">
                <Lock className="h-8 w-8" />
              </div>
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl">Admin Login</CardTitle>
              <CardDescription>
                Melden Sie sich an, um auf den Admin-Bereich zuzugreifen
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Admin Login Formular">
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin-Passwort eingeben"
                    disabled={loading}
                    autoFocus
                    className="pl-10"
                    aria-label="Admin Passwort"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Anmelden...
                  </>
                ) : (
                  'Anmelden'
                )}
              </Button>
            </form>

            <Alert className="mt-6" role="status">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="text-xs">
                <div className="font-medium mb-1">Entwicklungshinweis:</div>
                <div>Standard-Passwort: change_me_in_production</div>
                <div className="mt-1 text-muted-foreground">
                  Ändern Sie das Passwort in der .env-Datei
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
