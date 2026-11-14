import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "@/lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: "Darshan Atkari — Field notes",
    description: "Short write-ups of things that broke or needed deciding on Kubernetes, AWS, GitOps and MLOps systems, each tied to the repository it came from.",
    site: context.site ?? "https://atkaridarshan.online",
    items: posts.map((post) => ({
      title: post.data.deck ? `${post.data.title} — ${post.data.deck}` : post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/writing/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: "<language>en</language>",
  });
}
