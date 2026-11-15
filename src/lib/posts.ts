import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

/* What the React island on the home page receives: plain data only, since
   props to a hydrated component have to survive serialisation. */
export type PostSummary = {
  slug: string;
  title: string;
  deck?: string;
  description: string;
  date: string;
  tags: string[];
  minutes: number;
};

/* Newest first. Drafts show up in `astro dev` so they can be proofread in
   place, and are dropped from the production build. */
export async function getPublishedPosts(): Promise<Post[]> {
  const all = await getCollection("posts", ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function readingTime(body: string | undefined): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/* ISO dates, set in mono, read as log lines; that is the register of the page. */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function summarize(post: Post): PostSummary {
  return {
    slug: post.id,
    title: post.data.title,
    deck: post.data.deck,
    description: post.data.description,
    date: formatDate(post.data.date),
    tags: post.data.tags,
    minutes: readingTime(post.body),
  };
}

export type TagCount = { tag: string; slug: string; count: number };

export function countTags(posts: Post[]): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = tagSlug(tag);
      const entry = counts.get(slug) ?? { tag, slug, count: 0 };
      entry.count += 1;
      counts.set(slug, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
