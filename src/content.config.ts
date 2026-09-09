import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Supporters – people from Wangen who back the project.
// `image` is optional: only those with a photo appear as a card with
// photo/quote. Everyone else automatically appears in the plain name list.
const supporters = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/supporters' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			// e.g. neighborhood, function/role – informational only, optional
			role: z.string().optional(),
			image: image().optional(),
			quote: z.string().optional(),
			// order/date added, used for sorting
			date: z.coerce.date().default(() => new Date()),
			// set to false to temporarily hide an entry without deleting the file
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

// Simple blog: news, statements, reports.
const blog = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		author: z.string().default('Pro Schulraum Wangen'),
		excerpt: z.string().optional(),
		draft: z.boolean().default(false),
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
	arguments: arguments_,
	blog,
	videos,
};
