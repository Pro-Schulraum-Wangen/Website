// Reading time for a Markdown text, shown as «4 Min. Lesezeit» next to
// author and date on the media pages. Counts only the words people read:
// image alt texts, link targets and HTML tags are stripped first.

// Typical reading speed of adults for German non-fiction.
const WORDS_PER_MINUTE = 220;

export function readingMinutes(markdown: string | undefined): number {
	if (!markdown) return 1;
	const text = markdown
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images incl. alt text
		.replace(/\]\([^)]*\)/g, ' ') // link targets, keep link text
		.replace(/<[^>]+>/g, ' '); // HTML tags (figures, links, tables)
	const words = text.match(/[\p{L}\p{N}’']+/gu)?.length ?? 0;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function readingTimeLabel(markdown: string | undefined): string {
	return `${readingMinutes(markdown)} Min. Lesezeit`;
}
