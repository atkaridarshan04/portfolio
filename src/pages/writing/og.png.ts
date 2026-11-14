import { getPublishedPosts } from "@/lib/posts";
import { png, renderCard } from "@/lib/og";

export async function GET() {
  const posts = await getPublishedPosts();
  return png(
    await renderCard({
      label: "component / writing",
      title: "Field notes.",
      deck: "Incidents, decisions, fixes — on Kubernetes, AWS, GitOps and MLOps systems, each tied to the repository it came from.",
      meta: `${posts.length} notes · rss available`,
      tags: ["Kubernetes", "AWS", "GitOps", "MLOps"],
    }),
  );
}
