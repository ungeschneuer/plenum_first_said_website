import { TextPage, ExternalLink } from '../layout/TextPage';
import { OPERATOR } from '../../siteConfig';

export default function Datenschutz() {
  return (
    <TextPage title="Datenschutzerklärung">
      <h2>Verantwortlicher</h2>
      <p>Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
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

      <h2>Hosting über GitHub Pages</h2>
      <p>
        Diese Website ist eine statische Seite und wird über GitHub Pages ausgeliefert, einen Dienst der GitHub, Inc.,
        88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Aufruf verarbeitet GitHub technisch notwendige
        Verbindungsdaten, insbesondere Ihre IP-Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen.
        Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und verlässlichen Bereitstellung (Art. 6
        Abs. 1 lit. f DSGVO). Dabei können Daten in die USA übermittelt werden; GitHub ist nach dem EU-US Data Privacy
        Framework zertifiziert. Einzelheiten stehen in der{' '}
        <ExternalLink href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">
          Datenschutzerklärung von GitHub
        </ExternalLink>
        .
      </p>

      <h2>Keine Cookies, kein Tracking</h2>
      <p>
        Wir setzen keine Cookies, keine Analyse- oder Tracking-Dienste und keine Inhalte von Drittanbietern ein.
        Schriften, Daten und Skripte werden mit der Seite ausgeliefert. Das gewählte Farbschema speichert Ihr Browser
        lokal; es wird nicht an uns übertragen.
      </p>

      <h2>Links zu Protokollen</h2>
      <p>
        Links zu den PDF-Protokollen führen zum Angebot des Deutschen Bundestages. Erst wenn Sie einen solchen Link
        öffnen, werden Daten an dessen Betreiber übertragen; es gelten dessen Datenschutzhinweise.
      </p>

      <h2>Kontakt per E-Mail</h2>
      <p>
        Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben nur, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. f
        DSGVO), und löschen sie, wenn sie dafür nicht mehr gebraucht werden.
      </p>

      <h2>Personen in den Daten</h2>
      <p>
        Die Seite zählt Wörter aus öffentlichen Plenarsitzungen des Deutschen Bundestages. Sie zeigt, welche
        Rednerin oder welcher Redner ein Wort zuerst gesagt hat, und ab der 19. Wahlperiode, wie oft die Fraktionen es
        gebraucht haben. Grundlage ist das öffentliche Interesse an
        der Arbeit gewählter Abgeordneter und der Bundesregierung (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
        und Widerspruch (Art. 15 bis 21 DSGVO). Wenden Sie sich dafür an die oben genannte Adresse. Außerdem können Sie
        sich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für Ihren Wohnort zuständigen
        Behörde.
      </p>
    </TextPage>
  );
}
