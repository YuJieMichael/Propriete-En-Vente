// @vitest-environment node
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const exec = promisify(execFile);
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');

it('builds only public listing URLs and escaped, unique HTML metadata from the public API', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'propriete-seo-'));
  const requests: string[] = [];
  const id = '7d695ff4-bd03-580b-8d84-f0897a16e779';
  const server = createServer((request, response) => {
    requests.push(request.url || '');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify([{
      id, published_at: '2026-09-27T12:00:00Z',
      property: { title: 'Maison & jardin', city: 'Montréal', type: 'house', price: 500000, description: 'Maison <lumineuse>', contact: 'private@example.com' },
    }, { id: 'demo-01', property: { title: 'Fictional', city: 'Québec', price: 1 } }]));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const folder = join(workspace, 'frontend');
    for (const path of ['scripts', 'src', 'public']) await mkdir(join(folder, path), { recursive: true });
    await mkdir(join(workspace, 'dist'));
    for (const path of ['scripts/generate-sitemap.mjs', 'scripts/prerender-seo-pages.mjs', 'src/seo-content.json']) {
      await copyFile(join(frontend, path), join(folder, path));
    }
    await copyFile(join(frontend, 'index.html'), join(workspace, 'dist/index.html'));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local fixture server');
    const env = { ...process.env, VITE_SITE_URL: 'https://proprieteenvente.ca', VITE_LISTING_PUBLICATION_ENABLED: 'true', VITE_SUPABASE_URL: `http://127.0.0.1:${address.port}`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
    await exec(process.execPath, [join(folder, 'scripts/generate-sitemap.mjs')], { env });
    await exec(process.execPath, [join(folder, 'scripts/prerender-seo-pages.mjs')], { env });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('/rest/v1/published_listings?');
    const sitemap = await readFile(join(folder, 'public/sitemap.xml'), 'utf8');
    expect(sitemap.match(/<loc>/g)).toHaveLength(9);
    expect(sitemap.match(/<lastmod>2026-09-27<\/lastmod>/g)).toHaveLength(3);
    expect(sitemap).not.toMatch(/demo-01|Fictional|private@example/);
    const titles = new Set<string>();
    for (const lang of ['fr', 'en', 'zh']) {
      const path = `/${lang}/${lang === 'fr' ? 'propriete' : 'property'}/maison-jardin-montreal-${id}/`;
      const html = await readFile(join(workspace, 'dist', path, 'index.html'), 'utf8');
      titles.add(html.match(/<title>(.*?)<\/title>/)![1]);
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
      expect(html).toContain(`rel="canonical" href="https://proprieteenvente.ca${path}"`);
      expect(html.match(/hreflang=/g)).toHaveLength(4);
      expect(html).not.toMatch(/private@example|noindex|Maison <lumineuse>/);
      if (lang === 'fr') expect(html).toContain('Maison &lt;lumineuse&gt;');
    }
    expect(titles.size).toBe(3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const insideTemp = relative(tmpdir(), workspace);
    if (insideTemp.startsWith('propriete-seo-') && !insideTemp.includes('..') && !isAbsolute(insideTemp)) {
      await rm(workspace, { recursive: true, force: true });
    }
  }
}, 15000);
