import { getCollection } from 'astro:content';

// Loads both supporter sources and returns them ready for display:
// - `photo`: people with a photo card (Markdown files in src/content/supporters/)
// - `names`: people shown only as name + place (src/content/supporter-names.yaml),
//   plus any photo-less Markdown entry, sorted alphabetically by name
// - `count`: total number of published supporters
export async function getSupporters() {
	const cards = (await getCollection('supporters', ({ data }) => data.published)).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);
	const nameList = await getCollection('supporterNames', ({ data }) => data.published);

	const photo = cards.filter((s) => s.data.image);

	const names = [
		...nameList.map((s) => ({ name: s.data.name, location: s.data.location })),
		...cards
			.filter((s) => !s.data.image)
			.map((s) => ({ name: s.data.name, location: s.data.role ?? '' })),
	].sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));

	return { photo, names, count: photo.length + names.length };
}
