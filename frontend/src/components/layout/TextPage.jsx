// Running text reads best at about 65 characters per line, so text pages use a narrow column.
export function TextPage({ title, children }) {
  return (
    <article className="mx-auto max-w-prose px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold sm:text-4xl">{title}</h1>
      <div className="space-y-4 leading-relaxed text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold">
        {children}
      </div>
    </article>
  );
}

export function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
