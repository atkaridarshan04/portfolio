import type { APIContext } from "astro";
import { formatDate, getPublishedPosts, readingTime, type Post } from "@/lib/posts";
import { png, renderCard } from "@/lib/og";

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export async function GET({ props }: APIContext<{ post: Post }>) {
  const { post } = props;
  return png(
    await renderCard({
      label: "component / writing",
      title: post.data.title,
      deck: post.data.deck,
      meta: `${formatDate(post.data.date)} · ${readingTime(post.body)} min read`,
      tags: post.data.tags,
    }),
  );
}
