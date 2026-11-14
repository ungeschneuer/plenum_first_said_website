import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold mb-4">Ein Fehler ist aufgetreten</h1>
          <p className="text-muted-foreground mb-2">
            Etwas ist schiefgelaufen. Bitte versuche es erneut oder kehre zur Startseite zurück.
          </p>
          {this.state.error?.message && (
            <p className="text-sm text-muted-foreground font-mono mt-3 bg-muted px-4 py-2 rounded inline-block" role="alert">
              {this.state.error.message}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                aria-label="Seite neu laden"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Erneut versuchen
              </Button>
              <Button
                onClick={() => { window.location.href = '/'; }}
                aria-label="Zur Startseite"
              >
                <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                Zur Startseite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
