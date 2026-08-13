import { load } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import { Plugin } from '@/types/plugin';

type ChapterPage = {
  chapters: Array<{
    number: string;
    slug: string;
    name_fr?: string | null;
    name?: string | null;
    created_at?: string | null;
  }>;
  current_page: number;
  last_page: number;
  total: number;
};

class LightNovelVFPlugin implements Plugin.PluginBase {
  id = 'lightnovelvf';
  name = 'LightNovelVF';
  icon = 'src/fr/lightnovelvf/icon.png';
  site = 'https://www.lightnovelvf.com/';
  version = '1.0.0';

  resolveUrl(path: string, _isNovel = false): string {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    return new URL(`/novel/${cleanPath}`, this.site).toString();
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetchApi(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.text();
  }

  private async fetchChapterPage(url: string): Promise<ChapterPage> {
    const response = await fetchApi(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.json() as Promise<ChapterPage>;
  }

  private parseCards(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels = new Map<string, Plugin.NovelItem>();
    $('a[href^="/novel/"]').each((_, element) => {
      const href = $(element).attr('href') || '';
      const match = href.match(/^\/novel\/([^/?#]+)\/?$/);
      if (!match) return;

      const card = $(element).clone();
      card.find('img').remove();
      card
        .find('*')
        .filter((_, child) => {
          const text = $(child).text().trim();
          return (
            /\b\d[\d\s,.]*\s*(?:chapitres?|chapters?|ch\.?)(?:\s|$)/i.test(
              text,
            ) ||
            /^(?:note|rating\s*:?)?\s*\d(?:[.,]\d+)?\s*(?:\/\s*5)?$/i.test(text)
          );
        })
        .remove();
      const name = card.text().replace(/\s+/g, ' ').trim();
      if (!name) return;

      const cover =
        $(element).find('img').first().attr('data-src') ||
        $(element).find('img').first().attr('src');
      novels.set(match[1], {
        name,
        path: match[1],
        cover: cover ? new URL(cover, this.site).toString() : defaultCover,
      });
    });
    return Array.from(novels.values());
  }

  private catalogueUrl(pageNo: number, searchTerm?: string): string {
    const query = searchTerm
      ? `?page=${pageNo}&search=${encodeURIComponent(searchTerm)}`
      : `?page=${pageNo}`;
    return new URL(`/novels-list${query}`, this.site).toString();
  }

  private labelledValue(html: string, label: string): string | undefined {
    const $ = load(html);
    let value: string | undefined;
    $('dt, [class*="label" i]').each((_, element) => {
      if (value || $(element).text().trim().toLowerCase() !== label) return;
      value = $(element).next('dd').first().text().trim() || undefined;
    });
    return value;
  }

  async popularNovels(
    pageNo: number,
    _options: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    return this.parseCards(await this.fetchHtml(this.catalogueUrl(pageNo)));
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    return this.parseCards(
      await this.fetchHtml(this.catalogueUrl(pageNo, searchTerm)),
    );
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = novelPath.replace(/^\/novel\//, '').replace(/^\/+|\/+$/g, '');
    const html = await this.fetchHtml(this.resolveUrl(slug, true));
    const $ = load(html);
    const statusText =
      this.labelledValue(html, 'statut') ||
      $('span')
        .filter((_, element) =>
          /^(?:en\s+cours|terminé|complete|hiatus|pause)$/i.test(
            $(element).text().trim(),
          ),
        )
        .first()
        .text()
        .trim();
    const firstPage = await this.fetchChapterPage(
      `${this.resolveUrl(`${slug}/chapitres`, true)}?p=1&order=asc&q=`,
    );
    const lastPage = Math.min(Math.max(firstPage.last_page, 1), 500);
    const pages = [firstPage];
    for (let pageNo = 2; pageNo <= lastPage; pageNo += 1) {
      pages.push(
        await this.fetchChapterPage(
          `${this.resolveUrl(`${slug}/chapitres`, true)}?p=${pageNo}&order=asc&q=`,
        ),
      );
    }
    const chapters = new Map<string, Plugin.ChapterItem>();
    for (const page of pages) {
      for (const chapter of page.chapters) {
        const chapterNumber = Number(chapter.number);
        if (!chapter.slug || !Number.isFinite(chapterNumber)) continue;
        chapters.set(chapter.slug, {
          name: chapter.name_fr || chapter.name || `Chapitre ${chapter.number}`,
          path: `${slug}/${chapter.slug}`,
          chapterNumber,
          releaseTime: chapter.created_at || null,
        });
      }
    }

    const cover =
      $('.lnv-novel-cover, .lnv-novel__cover, .lnv-hero img, .hero img')
        .first()
        .attr('src') || $('img').first().attr('src');
    return {
      path: slug,
      name: $('h1').first().text().trim(),
      cover: cover ? new URL(cover, this.site).toString() : defaultCover,
      summary: $('.lnv-synopsis__body').first().text().trim() || undefined,
      author:
        this.labelledValue(html, 'auteur') ||
        $('[itemprop="author"]').first().text().trim() ||
        undefined,
      genres:
        this.labelledValue(html, 'catégories') ||
        this.labelledValue(html, 'categories') ||
        $('[itemprop="genre"]')
          .map((_, element) => $(element).text().trim())
          .get()
          .filter(Boolean)
          .join(', ') ||
        undefined,
      status: /termin|complet/i.test(statusText)
        ? NovelStatus.Completed
        : /hiatus|pause/i.test(statusText)
          ? NovelStatus.OnHiatus
          : /cours|ongoing/i.test(statusText)
            ? NovelStatus.Ongoing
            : NovelStatus.Unknown,
      chapters: Array.from(chapters.values()).sort(
        (left, right) => (left.chapterNumber || 0) - (right.chapterNumber || 0),
      ),
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const html = await this.fetchHtml(this.resolveUrl(chapterPath));
    const $ = load(html);
    const content = $('.lnv-reader-content').first();
    content
      .find(
        'script, style, header, footer, nav, form, [class*="nav" i], [id*="nav" i], [class*="advert" i], [id*="advert" i], [class*="share" i], [class*="control" i]',
      )
      .remove();
    const chapter = content.html()?.trim() || '';
    if (content.text().replace(/\s+/g, ' ').trim().length < 200)
      throw new Error('No readable chapter content found');
    return chapter;
  }
}

export default new LightNovelVFPlugin();
