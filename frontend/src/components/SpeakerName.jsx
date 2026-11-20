import { Link } from 'react-router-dom';
import { personPath } from '../utils/persons';

// "Name (Fraktion, Rolle)" with the name linked to the person page.
export function SpeakerName({ speaker, className = 'underline underline-offset-2 hover:text-foreground' }) {
  const { name, fraktion, rolle } = speaker;
  const affiliation = [fraktion, rolle].filter(Boolean).join(', ');
  const path = personPath(name);
  return (
    <>
      {path ? <Link to={path} className={className}>{name}</Link> : name}
      {affiliation && ` (${affiliation})`}
    </>
  );
}

export function speakerPrefix({ zitat, zwischenruf }) {
  if (zitat) return 'Zitat, vorgelesen von ';
  return zwischenruf ? 'Zwischenruf von ' : '';
}
