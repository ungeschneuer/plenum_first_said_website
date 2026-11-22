import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { SHARE_FORMATS } from '../pageMeta';

const base = import.meta.env.BASE_URL;

// Links to download the share images of a page (scripts/og-images.mjs). image is the name below og/ without format
// suffix and extension. Shown only when the images exist; they are rendered for persons and new words.
export function ShareImages({ image, fileName }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let current = true;
    setAvailable(false);
    fetch(`${base}og/${image}-post.png`, { method: 'HEAD' })
      .then((response) => {
        const type = response.headers.get('content-type') ?? '';
        if (current) setAvailable(response.ok && type.startsWith('image/'));
      })
      .catch(() => {});
    return () => { current = false; };
  }, [image]);

  if (!available) return null;
  return (
    <section aria-labelledby="share-images" className="space-y-2">
      <h2 id="share-images" className="text-sm font-semibold">Bild zum Teilen</h2>
      <ul className="flex flex-wrap gap-2">
        {SHARE_FORMATS.map((format) => (
          <li key={format.key}>
            <a
              href={`${base}og/${image}${format.suffix}.png`}
              download={`${fileName}${format.suffix || '-linkedin'}.png`}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {format.label}
              <span className="text-muted-foreground">
                {format.width} × {format.height}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
