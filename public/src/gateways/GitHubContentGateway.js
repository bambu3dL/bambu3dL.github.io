import { base64ToText, textToBase64 } from '../core/base64.js';
import { ContentError, ContentGateway } from './ContentGateway.js';

const API = 'https://api.github.com';
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function codeFor(status, headers) {
  if (status === 401) return 'auth';
  if (status === 403) return headers.get('x-ratelimit-remaining') === '0' ? 'rateLimit' : 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409 || status === 422) return 'conflict';
  if (status === 429) return 'rateLimit';
  return 'unknown';
}

// Legge e scrive i file del repository tramite l'API Contents di GitHub. Ogni scrittura è un commit:
// il sito si ripubblica da solo (workflow di GitHub Pages) e la cronologia dei commit è il registro delle modifiche.
// `root` è la cartella pubblicata del repository ("public").
export class GitHubContentGateway extends ContentGateway {
  #repo;
  #token;
  #root;

  constructor({ repo, token, root = 'public' }) {
    super();
    if (!REPO_PATTERN.test(repo)) throw new ContentError('notFound');
    this.#repo = repo;
    this.#token = token;
    this.#root = root.replace(/^\/+|\/+$/g, '');
  }

  get repo() {
    return this.#repo;
  }

  async verify() {
    const data = await this.#request(`/repos/${this.#repo}`);
    return { repo: data.full_name, canWrite: Boolean(data.permissions?.push) };
  }

  async readJson(path) {
    try {
      const file = await this.#request(this.#contents(path));
      return { data: JSON.parse(base64ToText(file.content)), sha: file.sha };
    } catch (error) {
      if (error.code === 'notFound') return { data: null, sha: null };
      throw error;
    }
  }

  async writeJson(path, data, { sha = null, message }) {
    return this.writeFile(path, textToBase64(`${JSON.stringify(data, null, 2)}\n`), { sha, message });
  }

  /** @returns {Promise<string>} lo sha del file scritto */
  async writeFile(path, base64, { sha = null, message }) {
    const result = await this.#request(this.#contents(path), {
      method: 'PUT',
      body: { message, content: base64, ...(sha ? { sha } : {}) },
    });
    return result.content.sha;
  }

  async remove(path, { sha, message }) {
    await this.#request(this.#contents(path), { method: 'DELETE', body: { message, sha } });
  }

  async shaOf(path) {
    try {
      return (await this.#request(this.#contents(path))).sha;
    } catch (error) {
      if (error.code === 'notFound') return null;
      throw error;
    }
  }

  /** L'ultima pubblicazione del sito. Serve il permesso di lettura sulle Actions: senza, restituisce null. */
  async latestPublish() {
    try {
      const data = await this.#request(`/repos/${this.#repo}/actions/runs?per_page=1&event=push`);
      const run = data.workflow_runs?.[0];
      return run ? { status: run.status, conclusion: run.conclusion, at: run.updated_at } : null;
    } catch {
      return null;
    }
  }

  #contents(path) {
    const clean = `${this.#root}/${path}`.replace(/\/{2,}/g, '/').split('/').map(encodeURIComponent).join('/');
    return `/repos/${this.#repo}/contents/${clean}`;
  }

  async #request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.#token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ContentError('network');
    }
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ContentError(codeFor(response.status, response.headers), response.status);
    return payload;
  }
}
