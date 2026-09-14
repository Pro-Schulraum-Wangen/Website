import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Supporters – people from Wangen who back the project.
// `image` is optional: only those with a photo appear as a card.
// Everyone else automatically appears in the plain name list.
const supporters = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/supporters' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			// surname, used to sort the list A–Z
			lastName: z.string(),
			// e.g. neighborhood, function/role – informational only, optional
			role: z.string().optional(),
			image: image().optional(),
			// order/date added – no longer used for sorting, kept for reference
			date: z.coerce.date().default(() => new Date()),
			// set to false to temporarily hide an entry without deleting the file
			published: z.boolean().default(true),
		}),
});

// Supporters who only want to appear with their name and place of
// residence – maintained as one short YAML list, no Markdown needed.
const supporterNames = defineCollection({
	loader: file('./src/content/supporter-names.yaml'),
	schema: z.object({
		name: z.string(),
		// surname, used to sort the list A–Z
		lastName: z.string(),
		location: z.string(),
		published: z.boolean().default(true),
	}),
});

// Arguments for the project – public, factual, referencing the
// municipality's official message (Botschaft).
const arguments_ = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/arguments' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			summary: z.string(),
			icon: z.string().optional(),
			// optional visualization/photo matching the argument
			image: image().optional(),
			imageAlt: z.string().optional(),
			// lower number = higher up on the page
			order: z.number().default(50),
			published: z.boolean().default(true),
		}),
});

// Videos – maintained as a short YAML list, no Markdown needed.
const videos = defineCollection({
	loader: file('./src/content/videos.yaml'),
	schema: z.object({
		title: z.string(),
		youtubeId: z.string(),
		description: z.string().optional(),
		date: z.coerce.date().default(() => new Date()),
		published: z.boolean().default(true),
	}),
});

export const collections = {
	supporters,
	supporterNames,
	arguments: arguments_,
	videos,
};
