import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Sparkles, User, FileText, TrendingUp, ExternalLink, Download, Share2 } from 'lucide-react';
import { getWordOfTheDay } from '../utils/api';
import { formatCalendarDate, getCurrentCalendarDate } from '../utils/german';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { PartyBadge } from '../utils/partyColors.jsx';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

export default function WordOfTheDay() {
  const [wordData, setWordData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getWordOfTheDay();
        setWordData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const generateImage = async (wordData, currentDate, firstUsedDate) => {
    setGenerating(true);
    try {
      const isDark = document.documentElement.classList.contains('dark');
      const size = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Card background with rounded corners
      const cardMargin = 60;
      const cardWidth = size - cardMargin * 2;
      const cardHeight = size - cardMargin * 2;
      const radius = 16;

      ctx.beginPath();
      ctx.moveTo(cardMargin + radius, cardMargin);
      ctx.lineTo(cardMargin + cardWidth - radius, cardMargin);
      ctx.quadraticCurveTo(cardMargin + cardWidth, cardMargin, cardMargin + cardWidth, cardMargin + radius);
      ctx.lineTo(cardMargin + cardWidth, cardMargin + cardHeight - radius);
      ctx.quadraticCurveTo(cardMargin + cardWidth, cardMargin + cardHeight, cardMargin + cardWidth - radius, cardMargin + cardHeight);
      ctx.lineTo(cardMargin + radius, cardMargin + cardHeight);
      ctx.quadraticCurveTo(cardMargin, cardMargin + cardHeight, cardMargin, cardMargin + cardHeight - radius);
      ctx.lineTo(cardMargin, cardMargin + radius);
      ctx.quadraticCurveTo(cardMargin, cardMargin, cardMargin + radius, cardMargin);
      ctx.closePath();
      ctx.fillStyle = isDark ? '#18181b' : '#ffffff';
      ctx.fill();

      // Card shadow
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Red header
      const headerHeight = 280;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cardMargin + radius, cardMargin);
      ctx.lineTo(cardMargin + cardWidth - radius, cardMargin);
      ctx.quadraticCurveTo(cardMargin + cardWidth, cardMargin, cardMargin + cardWidth, cardMargin + radius);
      ctx.lineTo(cardMargin + cardWidth, cardMargin + headerHeight);
      ctx.lineTo(cardMargin, cardMargin + headerHeight);
      ctx.lineTo(cardMargin, cardMargin + radius);
      ctx.quadraticCurveTo(cardMargin, cardMargin, cardMargin + radius, cardMargin);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(cardMargin, cardMargin, cardMargin + cardWidth, cardMargin + headerHeight);
      gradient.addColorStop(0, isDark ? '#b91c1c' : '#dc2626');
      gradient.addColorStop(1, isDark ? '#7f1d1d' : '#b91c1c');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // Weekday
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentDate.weekday.toUpperCase(), size / 2, cardMargin + 80);

      // Day number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 160px system-ui, sans-serif';
      ctx.fillText(String(currentDate.day), size / 2, cardMargin + 215);

      // Month + Year
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${currentDate.month} ${currentDate.year}`, size / 2, cardMargin + 265);

      // Word — vertically center the content block in the available area
      const hasSpeaker = !!wordData.speaker_name;
      // Height of content below the word baseline:
      //   subtitle (+50) + gap-to-divider (+40) + gap-to-info (+60) + info-label+value (+42)
      //   + optional speaker section (+120 for divider+label+value)
      const belowWordHeight = hasSpeaker ? 312 : 192;
      const wordCapHeight = 70; // approximate cap height for system-ui font
      const contentAreaHeight = cardHeight - headerHeight - 60; // 620
      const topPadding = Math.round((contentAreaHeight - wordCapHeight - belowWordHeight) / 2);
      const wordY = cardMargin + headerHeight + topPadding + wordCapHeight;
      ctx.fillStyle = isDark ? '#f4f4f5' : '#09090b';
      const maxWordWidth = cardWidth - 80;
      let wordFontSize = 100;
      ctx.font = `bold ${wordFontSize}px system-ui, sans-serif`;
      while (ctx.measureText(wordData.word).width > maxWordWidth && wordFontSize > 40) {
        wordFontSize -= 4;
        ctx.font = `bold ${wordFontSize}px system-ui, sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(wordData.word, size / 2, wordY);

      // "Wort des Tages" label
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
      ctx.fillText('Wort des Tages', size / 2, wordY + 50);

      // Divider
      const dividerY = wordY + 90;
      ctx.beginPath();
      ctx.moveTo(cardMargin + 40, dividerY);
      ctx.lineTo(cardMargin + cardWidth - 40, dividerY);
      ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Info row
      const infoY = dividerY + 60;
      const infoItems = [
        { label: 'Erstmals', value: `${firstUsedDate.day}. ${firstUsedDate.month} ${firstUsedDate.year}` },
        { label: 'Wahlperiode', value: `${wordData.wahlperiode}. WP` },
        { label: 'Vorkommen', value: String(wordData.total_count) },
        { label: 'Protokoll', value: `${wordData.wahlperiode}/${wordData.protokollnummer}` },
      ];

      const colWidth = cardWidth / infoItems.length;
      infoItems.forEach((item, i) => {
        const cx = cardMargin + colWidth * i + colWidth / 2;

        ctx.font = '22px system-ui, sans-serif';
        ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, cx, infoY);

        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillStyle = isDark ? '#f4f4f5' : '#09090b';
        ctx.fillText(item.value, cx, infoY + 42);
      });

      // Speaker (if present)
      if (wordData.speaker_name) {
        const speakerY = infoY + 110;
        ctx.beginPath();
        ctx.moveTo(cardMargin + 40, speakerY - 20);
        ctx.lineTo(cardMargin + cardWidth - 40, speakerY - 20);
        ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '22px system-ui, sans-serif';
        ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
        ctx.textAlign = 'center';
        ctx.fillText('Erstmals gesagt von', size / 2, speakerY + 10);

        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.fillStyle = isDark ? '#f4f4f5' : '#09090b';
        const speakerText = wordData.party_at_time_name
          ? `${wordData.speaker_name} · ${wordData.party_at_time_name}`
          : wordData.speaker_name;
        ctx.fillText(speakerText, size / 2, speakerY + 52);
      }

      // Footer branding
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
      ctx.textAlign = 'center';
      ctx.fillText('bundestag-wortschatz.de', size / 2, cardMargin + cardHeight - 30);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
      });
    } catch (err) {
      toast.error('Bild konnte nicht erstellt werden.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const currentDate = getCurrentCalendarDate();
    const firstUsedDate = formatCalendarDate(wordData.first_date);
    const blob = await generateImage(wordData, currentDate, firstUsedDate);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wort-des-tages-${currentDate.day}-${currentDate.month}-${currentDate.year}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const currentDate = getCurrentCalendarDate();
    const firstUsedDate = formatCalendarDate(wordData.first_date);
    const blob = await generateImage(wordData, currentDate, firstUsedDate);
    if (!blob) return;

    const file = new File([blob], `wort-des-tages-${currentDate.day}-${currentDate.month}-${currentDate.year}.png`, {
      type: 'image/png',
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Wort des Tages: ${wordData.word}`,
          text: `Das Wort „${wordData.word}" wurde erstmals am ${currentDate.day}. ${currentDate.month} im Bundestag gesagt.`,
          files: [file],
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error('Teilen fehlgeschlagen.');
        }
      }
    } else {
      // Desktop fallback: copy the word's page URL to clipboard
      const url = `${window.location.origin}/wort/${encodeURIComponent(wordData.word)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard API unavailable — fall back to download
        handleDownload();
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!wordData) return null;

  const currentDate = getCurrentCalendarDate();
  const firstUsedDate = formatCalendarDate(wordData.first_date);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
      {/* Abreißkalender-Karte */}
      <Card className="overflow-hidden shadow-xl">
        {/* Kalender-Header - angepasst für Light/Dark Mode */}
        <div className="bg-gradient-to-br from-red-600 via-red-600 to-red-700 dark:from-red-700 dark:via-red-800 dark:to-red-900 text-white p-4 sm:p-5 text-center">
          <div className="text-xs sm:text-sm font-medium uppercase tracking-wider mb-0.5">
            {currentDate.weekday}
          </div>
          <div className="text-5xl sm:text-6xl font-bold mb-0.5">
            {currentDate.day}
          </div>
          <div className="text-base sm:text-lg font-medium">
            {currentDate.month} {currentDate.year}
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          {/* Fallback-Indikator */}
          {wordData.is_random && (
            <div className="mb-3">
              <Badge variant="secondary" className="text-xs sm:text-sm">
                <Sparkles className="h-3 w-3 mr-1" aria-hidden="true" />
                Zufälliges Wort - kein historisches Datum für heute
              </Badge>
            </div>
          )}

          {/* Das Wort - Hauptfokus */}
          <div className="text-center mb-4 sm:mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1">
              <Link
                to={`/wort/${encodeURIComponent(wordData.word)}`}
                className="hover:text-primary transition-colors"
              >
                {wordData.word}
              </Link>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Wort des Tages
            </p>
          </div>

          {/* Kompakte Info-Zeile */}
          <div className="border-t pt-4 mb-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Erstmals gesagt am
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-muted/50 dark:bg-muted/30 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Datum</p>
                <p className="text-sm font-semibold">
                  {firstUsedDate.day}. {firstUsedDate.month} {firstUsedDate.year}
                </p>
              </div>

              <div className="bg-muted/50 dark:bg-muted/30 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Wahlperiode</p>
                <Link to={`/wahlperiode/${wordData.wahlperiode}`} className="text-sm font-semibold text-primary hover:underline">
                  {wordData.wahlperiode}. WP
                </Link>
              </div>

              <div className="bg-muted/50 dark:bg-muted/30 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Vorkommen</p>
                <p className="text-sm font-semibold">{wordData.total_count}</p>
              </div>

              <div className="bg-muted/50 dark:bg-muted/30 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Protokoll</p>
                <Link
                  to={`/protokoll/${wordData.first_protocol_id}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {wordData.wahlperiode}/{wordData.protokollnummer}
                </Link>
              </div>
            </div>
          </div>

          {/* Redner-Info */}
          {wordData.speaker_name && (
            <div className="border-t pt-4 mb-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                Erstmals gesagt von
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {wordData.first_speaker_id ? (
                  <Link
                    to={`/redner/${wordData.first_speaker_id}`}
                    className="text-sm sm:text-base font-medium text-primary hover:underline"
                  >
                    {wordData.speaker_name}
                  </Link>
                ) : (
                  <p className="text-sm sm:text-base font-medium">{wordData.speaker_name}</p>
                )}
                {wordData.party_at_time_name && (
                  <PartyBadge party={wordData.party_at_time_name} className="text-xs sm:text-sm" />
                )}
              </div>
              {wordData.optv_link && (
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <a
                    href={wordData.optv_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Video auf OpenParliamentTV ansehen (öffnet in neuem Tab)"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" aria-hidden="true" />
                    Video ansehen
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="border-t pt-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1" size="sm">
                <Link to={`/wort/${encodeURIComponent(wordData.word)}`}>
                  <TrendingUp className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                  Zeitverlauf
                </Link>
              </Button>
              <Button asChild className="flex-1" size="sm">
                <Link to={`/protokoll/${wordData.first_protocol_id}`}>
                  <FileText className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                  Protokoll
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share-Bereich */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <h3 className="text-sm font-semibold mb-1">Als Bild teilen</h3>
              <p className="text-xs text-muted-foreground">
                Lade das Kalenderblatt als Bild herunter oder teile es direkt
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={generating}
                aria-label="Kalenderblatt als Bild herunterladen"
              >
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                {generating ? 'Erstelle...' : 'Download'}
              </Button>
              <Button
                size="sm"
                onClick={handleShare}
                disabled={generating}
                aria-label={copied ? 'Link kopiert' : 'Kalenderblatt teilen'}
                aria-live="polite"
              >
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />
                {generating ? 'Erstelle...' : copied ? 'Link kopiert!' : 'Teilen'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
