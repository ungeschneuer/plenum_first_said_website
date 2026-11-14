import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { useState } from 'react';

export function StatusBanner({ status }) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!status || status.status === 'idle' || isDismissed) {
    return null;
  }

  const isProcessing = status.status === 'processing';
  const progressPercent = status.total > 0
    ? Math.round((status.processed / status.total) * 100)
    : 0;

  return (
    <div className="border-b border-border bg-accent/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {isProcessing
                    ? `Verarbeite Protokolle: ${status.processed} / ${status.total}`
                    : status.message || 'Processing...'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsDismissed(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {isProcessing && status.total > 0 && (
                <Progress value={progressPercent} className="h-2" />
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
