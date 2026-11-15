import { useNavigate, Link } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-muted rounded-full">
            <FileQuestion className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-6xl font-bold text-muted-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Seite nicht gefunden</h2>
        <p className="text-muted-foreground">
          Diese Seite existiert nicht oder wurde verschoben.
          Vielleicht hilft eine der folgenden Optionen weiter.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          aria-label="Zur vorherigen Seite zurück"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Zurück
        </Button>
        <Button asChild>
          <Link to="/" aria-label="Zur Startseite">
            <Home className="h-4 w-4 mr-2" aria-hidden="true" />
            Zur Startseite
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4 justify-center">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Beliebte Bereiche</span>
          </div>
          <nav aria-label="Beliebte Seiten">
            <ul className="space-y-1">
              {[
                { to: '/', label: 'Wortsuche' },
                { to: '/vergleich', label: 'Wortvergleich' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="block py-1.5 text-sm text-primary hover:underline focus:underline focus:outline-none rounded"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
