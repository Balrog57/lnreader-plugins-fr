import { load } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import { Plugin } from '@/types/plugin';

const catalogueTypes = ['Web+Novel', 'Light+Novel'];
const chapterPathPattern = /^\/oeuvre\/([^/?#]+)\/chapitre\/(\d+(?:[.,]\d+)?)/;

class TradIndexPlugin implements Plugin.PluginBase {
  id = 'tradindex';
  name = 'Trad-Index';
  icon = 'src/fr/tradindex/icon.png';
  site = 'https://trad-index.com/';
  version = '1.0.0';

  resolveUrl(path: string, isNovel = false): string {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    if (isNovel) return new URL(`/oeuvre/${cleanPath}`, this.site).href;

    const [slug, chapterNumber] = cleanPath
      .replace(/\/chapitre\//, '/')
      .split('/');
    return new URL(`/oeuvre/${slug}/chapitre/${chapterNumber}`, this.site).href;
  }

  private async fetchHtml(path: string): Promise<string> {
    const response = await fetchApi(new URL(path, this.site).href);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.text();
  }

  private parseCards(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels = new Map<string, Plugin.NovelItem>();
    $('a[href^="/oeuvre/"]').each((_, element) => {
      const href = $(element).attr('href') || '';
      const match = href.match(/^\/oeuvre\/([^/?#]+)\/?$/);
      if (!match) return;

      const name = $(element)
        .find('[class*="line-clamp"]')
        .first()
        .text()
        .trim();
      const sourceType = $(element)
        .find('span')
        .toArray()
        .map(span => $(span).text().trim())
        .find(text =>
          /^(?:(?:Web|Light) Novel|Manhwa|Manga|Scan)$/i.test(text),
        );
      if (!name || (sourceType && !/^(?:Web|Light) Novel$/i.test(sourceType)))
        return;
      const cover = $(element).find('img').first().attr('src');
      novels.set(match[1], {
        name,
        path: match[1],
        cover: cover ? new URL(cover, this.site).href : defaultCover,
      });
    });
    return [...novels.values()];
  }

  private cataloguePath(type: string, pageNo: number, searchTerm?: string) {
    const query = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
    return `/catalogue?type=${type}${query}&page=${pageNo}`;
  }

  private chapterItems(html: string, slug: string): Plugin.ChapterItem[] {
    const $ = load(html);
    const chapters = new Map<string, Plugin.ChapterItem>();
    $('a[href^="/oeuvre/"]').each((_, element) => {
      const href = $(element).attr('href') || '';
      const match = href.match(chapterPathPattern);
      if (!match || match[1] !== slug) return;

      const number = Number(match[2].replace(',', '.'));
      if (!Number.isFinite(number)) return;
      const path = `${slug}/${match[2]}`;
      chapters.set(path, {
        name: $(element).text().trim() || `Chapitre ${match[2]}`,
        path,
        chapterNumber: number,
      });
    });
    return [...chapters.values()];
  }

  private async fetchChapterPages(
    html: string,
    slug: string,
  ): Promise<Plugin.ChapterItem[]> {
    const $ = load(html);
    let lastPage = 1;
    $('a[href*="onglet=chapitres"]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      const page = Number(
        new URL(href, this.resolveUrl(slug, true)).searchParams.get('page'),
      );
      if (Number.isInteger(page)) lastPage = Math.max(lastPage, page);
    });

    const pages = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, index) =>
        this.fetchHtml(
          `/oeuvre/${slug}?onglet=chapitres&tri=desc&page=${index + 2}`,
        ),
      ),
    );
    const chapters = new Map<string, Plugin.ChapterItem>();
    for (const pageHtml of [html, ...pages]) {
      for (const chapter of this.chapterItems(pageHtml, slug)) {
        chapters.set(chapter.path, chapter);
      }
    }
    return [...chapters.values()].sort(
      (left, right) => (left.chapterNumber || 0) - (right.chapterNumber || 0),
    );
  }

  async popularNovels(
    pageNo: number,
    _options: Plugin.PopularNovelsOptions<undefined>,
  ): Promise<Plugin.NovelItem[]> {
    const pages = await Promise.all(
      catalogueTypes.map(type =>
        this.fetchHtml(this.cataloguePath(type, pageNo)),
      ),
    );
    return [
      ...new Map(
        pages
          .flatMap(html => this.parseCards(html))
          .map(novel => [novel.path, novel]),
      ).values(),
    ];
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const pages = await Promise.all(
      catalogueTypes.map(type =>
        this.fetchHtml(this.cataloguePath(type, pageNo, searchTerm)),
      ),
    );
    return [
      ...new Map(
        pages
          .flatMap(html => this.parseCards(html))
          .map(novel => [novel.path, novel]),
      ).values(),
    ];
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = novelPath.replace(/^\/oeuvre\//, '').replace(/\/$/, '');
    const html = await this.fetchHtml(`/oeuvre/${slug}`);
    const $ = load(html);
    const details = $('body').text().replace(/\s+/g, ' ');
    const formatStatus = details.match(
      /(Web Novel|Light Novel)\s*·\s*([^\n]+)/i,
    );
    const getDetail = (label: string) => {
      let value: string | undefined;
      $('*').each((_, element) => {
        const text = $(element).text().trim();
        const match = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'i'));
        if (match) {
          value = match[1].trim();
          return false;
        }
      });
      return value;
    };
    const synopsisHeading = $('h1,h2,h3')
      .filter(
        (_, element) => $(element).text().trim().toLowerCase() === 'synopsis',
      )
      .first();

    return {
      path: slug,
      name: $('h1').first().text().trim(),
      cover: $('img[alt^="Couverture de"]').first().attr('src')
        ? new URL(
            $('img[alt^="Couverture de"]').first().attr('src')!,
            this.site,
          ).href
        : defaultCover,
      summary: synopsisHeading.nextAll('p').first().text().trim() || undefined,
      author: getDetail('Auteur'),
      artist: getDetail('Traducteur'),
      genres: getDetail('Genres'),
      status: /terminé/i.test(formatStatus?.[2] || '')
        ? NovelStatus.Completed
        : /en cours/i.test(formatStatus?.[2] || '')
          ? NovelStatus.Ongoing
          : NovelStatus.Unknown,
      chapters: await this.fetchChapterPages(html, slug),
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const html = await this.fetchHtml(
      this.resolveUrl(chapterPath).replace(this.site.slice(0, -1), ''),
    );
    const $ = load(html);
    const main = $('main').first();
    const stopPattern =
      /traduit par|traducteur|navigation|partager|signaler|commentaires?/i;
    let stopped = false;
    const prose: string[] = [];
    main
      .find(
        'h1, h2, h3, h4, h5, h6, p, nav, form, [class*="comment"], [class*="share"], [class*="report"], [class*="translator"]',
      )
      .each((_, element) => {
        const part = $(element);
        if (stopped) return false;
        if (stopPattern.test(part.text())) {
          stopped = true;
          return false;
        }
        if (
          element.tagName === 'p' &&
          (part.hasClass('narration') || part.hasClass('dialogue'))
        )
          prose.push($.html(element));
      });

    const content = prose.join('');
    if (load(content).text().trim().length < 200)
      throw new Error('No readable chapter content found');
    return content;
  }
}

export default new TradIndexPlugin();
