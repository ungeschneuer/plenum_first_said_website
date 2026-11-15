import { TextPage, ExternalLink } from '../layout/TextPage';
import { OPERATOR, SOURCE_REPOSITORY, DATA_SOURCE } from '../../siteConfig';

export default function Impressum() {
  return (
    <TextPage title="Impressum">
      <h2>Kontaktadresse</h2>
      <p>
        {OPERATOR.name}
        {OPERATOR.addressLines.map((line) => (
          <span key={line}>
            <br />
            {line}
          </span>
        ))}
        <br />
        E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </p>

      <h2>Haftungsausschluss</h2>
      <p>
        Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen Richtigkeit, Genauigkeit, Aktualität,
        Zuverlässigkeit und Vollständigkeit der Informationen. Die Zahlen werden automatisch aus den Texten der
        Plenarprotokolle ermittelt; ältere Protokolle beruhen auf Texterkennung und enthalten Lesefehler. Verbindlich
        sind allein die Plenarprotokolle des Deutschen Bundestages.
      </p>
      <p>
        Haftungsansprüche gegen den Autor wegen Schäden materieller oder immaterieller Art, welche aus dem Zugriff oder
        der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch
        technische Störungen entstanden sind, werden ausgeschlossen.
      </p>
      <p>
        Alle Angebote sind unverbindlich. Der Autor behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte
        Angebot ohne gesonderte Ankündigung zu verändern, zu ergänzen, zu löschen oder die Veröffentlichung zeitweise
        oder endgültig einzustellen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Verweise und Links auf Webseiten Dritter liegen außerhalb unseres Verantwortungsbereichs. Es wird jegliche
        Verantwortung für solche Webseiten abgelehnt. Der Zugriff und die Nutzung solcher Webseiten erfolgen auf eigene
        Gefahr des Nutzers oder der Nutzerin.
      </p>

      <h2>Lizenzen und Quellen</h2>
      <p>
        Der <ExternalLink href={SOURCE_REPOSITORY}>Quellcode</ExternalLink> steht unter der GNU General Public License,
        Version 3.
      </p>
      <p>
        Die Plenarprotokolle stammen aus dem{' '}
        <ExternalLink href={DATA_SOURCE.url}>{DATA_SOURCE.name}</ExternalLink> (© Deutscher Bundestag,{' '}
        <ExternalLink href={DATA_SOURCE.licenseUrl}>{DATA_SOURCE.licenseName}</ExternalLink>). Die Wortzählungen sind
        aus diesen Texten abgeleitet und stehen unter derselben Lizenz.
      </p>
    </TextPage>
  );
}
