export const SITE_TITLE = 'Pro Schulraum Wangen';
export const SITE_TAGLINE =
	'Unabhängige Unterstützer:innengruppe für die neue Schul- und Sportanlage «Am Buechberg»';
export const SITE_DESCRIPTION =
	'Wir sind Einwohnerinnen und Einwohner von Wangen SZ, die sich für ein Ja zum Neubau der Schulanlage «Am Buechberg» einsetzen. Argumente, Videos und Unterstützer:innen zur Abstimmung vom 29. November 2026.';

export const OFFICIAL_SITE_URL = 'https://schulanlage-wangensz.ch/';
export const OFFICIAL_SITE_LABEL = 'Offizielle Website der Gemeinde';

// Address for enquiries about the website and about supporter entries.
export const CONTACT_EMAIL = 'info@philippbruhin.ch';
export const SUPPORT_FORM_URL = ''; // optional, e.g. a Google Form link

// People responsible for this website (shown in the privacy notice).
export const RESPONSIBLE_PEOPLE = [
	{
		name: 'Raphael Seunig',
		role: 'Präsident Die Mitte Wangen SZ',
		email: 'raphaelseunig@saveurs-vivre.ch',
	},
	{
		name: 'Jonas Küttel',
		role: 'Präsident STV Wangen SZ',
		email: 'jonas.kuettel@stv-wangensz.ch',
	},
	{
		name: 'Philipp Bruhin',
		role: 'Webmaster',
		email: 'info@philippbruhin.ch',
	},
] as const;

export const VOTE_DATE_LABEL = 'Urnenabstimmung: Sonntag, 29. November 2026';

export const NAV_LINKS = [
	{ href: '/', label: 'Start' },
	{ href: '/argumente/', label: 'Argumente' },
	{ href: '/unterstuetzer/', label: 'Unterstützer:innen' },
	{ href: '/videos/', label: 'Videos' },
	{ href: '/mitmachen/', label: 'Mitmachen' },
] as const;
