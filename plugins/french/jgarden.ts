import { load } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import { Plugin } from '@/types/plugin';

type WordPressPage = {
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
};

const chapterSlug =
  /(?:chapitre|prologue|epilogue|interlude|bonus|postface|preface)/i;

class JGardenPlugin implements Plugin.PluginBase {
  id = 'jgarden';
  name = 'J-Garden';
  icon = 'src/fr/jgarden/icon.png';
  site = 'https://j-garden.fr/';
  version = '1.0.0';

  resolveUrl(path: string): string {
    return new URL(path, this.site).toString();
  }

  private slugFromLink(link: string): string | undefined {
    const url = new URL(link, this.site);
    if (url.origin !== new URL(this.site).origin) return undefined;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetchApi(this.resolveUrl(path));
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json() as Promise<T>;
  }

  private parseCatalogue(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels = new Map<string, Plugin.NovelItem>();
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const path = href ? this.slugFromLink(href) : undefined;
      const name = $(element).text().trim() || this.nameFromSlug(path || '');
      if (path && name) novels.set(path, { name, path, cover: defaultCover });
    });
    return Array.from(novels.values());
  }

  private nameFromSlug(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private chapterSequence(name: string, path: string) {
    const source = `${name} ${path}`;
    const chapter = source.match(
      /(?:chapitre|chapter|ch\.?)[\s_-]*(\d+(?:[.,]\d+)?)/i,
    );
    if (!chapter) return undefined;
    const volume = source.match(/(?:tome|volume|vol\.?|t)[\s_-]*(\d+)/i);
    return {
      volume: Number(volume?.[1] || 0),
      chapter: Number(chapter[1].replace(',', '.')),
    };
  }

  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return [];
    const [lightNovels, webNovels] = await Promise.all(
      ['jg-ln', 'jg-web-novel'].map(section =>
        this.getJson<Pick<WordPressPage, 'content'>[]>(
          `/wp-json/wp/v2/pages?slug=${section}&_fields=content`,
        ),
      ),
    );
    const novels = new Map<string, Plugin.NovelItem>();
    for (const section of [...lightNovels, ...webNovels]) {
      for (const novel of this.parseCatalogue(section.content.rendered)) {
        novels.set(novel.path, novel);
      }
    }
    return Array.from(novels.values());
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = this.slugFromLink(novelPath) || novelPath;
    const pages = await this.getJson<WordPressPage[]>(
      `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=slug,link,title,content`,
    );
    const page = pages[0];
    if (!page) throw new Error('Novel not found');

    const $ = load(page.content.rendered);
    const chapters = new Map<
      string,
      { chapter: Plugin.ChapterItem; index: number }
    >();
    const firstChapter = $('a[href]')
      .filter((_, element) => {
        const href = $(element).attr('href');
        const chapterPath = href ? this.slugFromLink(href) : undefined;
        return Boolean(chapterPath && chapterSlug.test(chapterPath));
      })
      .first();

    $('a[href]').each((index, element) => {
      const href = $(element).attr('href');
      const path = href ? this.slugFromLink(href) : undefined;
      const name = $(element).text().trim();
      if (path && name && chapterSlug.test(path) && !chapters.has(path)) {
        chapters.set(path, { chapter: { name, path }, index });
      }
    });

    return {
      path: page.slug,
      name: load(page.title.rendered).text().trim(),
      cover: $('img').first().attr('src') || defaultCover,
      summary: firstChapter.prevAll().text().trim(),
      status: NovelStatus.Ongoing,
      chapters: Array.from(chapters.values())
        .sort((left, right) => {
          const leftSequence = this.chapterSequence(
            left.chapter.name,
            left.chapter.path,
          );
          const rightSequence = this.chapterSequence(
            right.chapter.name,
            right.chapter.path,
          );
          if (!leftSequence || !rightSequence) return left.index - right.index;
          return (
            leftSequence.volume - rightSequence.volume ||
            leftSequence.chapter - rightSequence.chapter ||
            left.index - right.index
          );
        })
        .map(({ chapter }) => chapter),
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const slug = this.slugFromLink(chapterPath) || chapterPath;
    let posts = await this.getJson<
      Pick<WordPressPage, 'content' | 'title' | 'link'>[]
    >(
      `/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content,title,link`,
    );
    if (posts.length === 0) {
      const resolved = await fetchApi(this.resolveUrl(chapterPath));
      const canonicalSlug = this.slugFromLink(resolved.url);
      if (canonicalSlug && canonicalSlug !== slug) {
        posts = await this.getJson(
          `/wp-json/wp/v2/posts?slug=${encodeURIComponent(canonicalSlug)}&_fields=content,title,link`,
        );
      }
    }
    const post = posts[0];
    if (!post) throw new Error('Chapter not found');

    const $ = load(post.content.rendered);
    const content = $('.elementor-widget-theme-post-content').first();
    const chapter = content.length ? content : $('body');
    chapter
      .find(
        'script, style, nav, .sharedaddy, .share, [class*="share"], [id*="share"]',
      )
      .remove();
    chapter
      .find('*')
      .filter((_, element) => !$(element).text().trim())
      .remove();
    const html = chapter.html()?.trim() || '';
    if (chapter.text().trim().length < 200)
      throw new Error('No readable chapter content found');
    return html;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo !== 1) return [];
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    const query = normalize(searchTerm);
    return (await this.popularNovels(1)).filter(novel =>
      normalize(novel.name).includes(query),
    );
  }
}

export default new JGardenPlugin();
