export const SITE_NAME = 'Bundestag Wortschatz';
// Public address, shown on the share images; the publishing workflow passes the same address to scripts/page-html.mjs.
export const SITE_URL = 'https://ungeschneuer.github.io/plenum_first_said_website/';

export const OPERATOR = {
  name: 'Marcel Schneuer',
  addressLines: ['c/o Highslammer e.V.', 'Spielbergtor 21', '99096 Erfurt'],
  email: 'hallo@schneuer.online',
  website: 'https://schneuer.online',
};

export const SOURCE_REPOSITORY = 'https://github.com/ungeschneuer/plenum_first_said_website';
export const ISSUES_URL = `${SOURCE_REPOSITORY}/issues`;
export const DATA_DOWNLOAD_URL = `${SOURCE_REPOSITORY}/releases/tag/daten`;
export const BOT_REPOSITORY = 'https://github.com/ungeschneuer/plenum_first_said';
export const BOT_ACCOUNT = { name: '@BT_First_Said', url: 'https://mastodon.social/@BT_First_Said' };

export const DATA_SOURCE = {
  name: 'Dokumentations- und Informationssystem für Parlamentsmaterialien (DIP) des Deutschen Bundestages',
  url: 'https://dip.bundestag.de/',
  licenseName: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
  licenseUrl: 'https://www.govdata.de/dl-de/by-2-0',
};
