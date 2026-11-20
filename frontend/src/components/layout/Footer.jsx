import { Link } from 'react-router-dom';
import { DATA_SOURCE, SOURCE_REPOSITORY } from '../../siteConfig';

const PAGE_LINKS = [
  { to: '/about', label: 'Über das Projekt' },
  { to: '/faq', label: 'Häufige Fragen' },
  { to: '/impressum', label: 'Impressum' },
  { to: '/datenschutz', label: 'Datenschutz' },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-background" aria-label="Seitenfuß">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <nav aria-label="Informationen">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {PAGE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="hover:text-foreground">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>
          Ein privates Projekt, kein offizielles Angebot des Deutschen Bundestages.
        </p>
        <p>
          Texte: Plenarprotokolle des Deutschen Bundestages, {DATA_SOURCE.licenseName}. Der{' '}
          <a href={SOURCE_REPOSITORY} className="underline underline-offset-2 hover:text-foreground">
            Quellcode
          </a>{' '}
          steht unter der GNU General Public License 3.
        </p>
      </div>
    </footer>
  );
}
