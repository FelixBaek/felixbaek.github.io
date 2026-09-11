import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllPosts, SITE } from '@lib/site';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? 'https://felixbaek.github.io',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.lastmod ?? post.data.date,
      link: `/posts/${post.id}/`,
      categories: [...post.data.tags, ...post.data.harness, ...post.data.languages],
    })),
    customData: '<language>ko-kr</language>',
  });
}
