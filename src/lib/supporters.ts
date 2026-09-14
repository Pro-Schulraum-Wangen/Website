import { getCollection } from 'astro:content';

const byLastName = (a: string, b: string) => a.localeCompare(b, 'de-CH');

// Loads both supporter sources and returns them ready for display:
// - `photo`: people with a photo card (Markdown files in src/content/supporters/),
//   sorted alphabetically by surname
// - `names`: people shown only as name + place (src/content/supporter-names.yaml),
//   plus any photo-less Markdown entry, sorted alphabetically by surname
// - `count`: total number of published supporters
export async function getSupporters() {
	const cards = await getCollection('supporters', ({ data }) => data.published);
	const nameList = await getCollection('supporterNames', ({ data }) => data.published);

	const photo = cards
		.filter((s) => s.data.image)
		.sort((a, b) => byLastName(a.data.lastName, b.data.lastName));

	const names = [
		...nameList.map((s) => ({ name: s.data.name, lastName: s.data.lastName, location: s.data.location })),
		...cards
			.filter((s) => !s.data.image)
			.map((s) => ({ name: s.data.name, lastName: s.data.lastName, location: s.data.role ?? '' })),
	].sort((a, b) => byLastName(a.lastName, b.lastName));

	return { photo, names, count: photo.length + names.length };
}
