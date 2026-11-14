import { Button } from './ui/button';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Seitennavigation">
      <Button
        variant="outline"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Vorherige Seite"
      >
        ← Zurück
      </Button>

      {startPage > 1 && (
        <>
          <Button
            variant="outline"
            onClick={() => onPageChange(1)}
            aria-label="Gehe zu Seite 1"
          >
            1
          </Button>
          {startPage > 2 && (
            <span className="px-2" aria-hidden="true">
              ...
            </span>
          )}
        </>
      )}

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'default' : 'outline'}
          onClick={() => onPageChange(page)}
          aria-label={`Gehe zu Seite ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
          className={page === currentPage ? 'font-bold shadow-md' : ''}
        >
          {page}
        </Button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="px-2" aria-hidden="true">
              ...
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onPageChange(totalPages)}
            aria-label={`Gehe zu Seite ${totalPages}`}
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Nächste Seite"
      >
        Weiter →
      </Button>
    </nav>
  );
}
