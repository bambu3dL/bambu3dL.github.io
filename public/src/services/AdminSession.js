import { ContentError } from '../gateways/ContentGateway.js';
import { VaultError } from './TokenVault.js';

const SESSION_KEY = 'stampe3d:admin-session';

export class AdminError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AdminError';
    this.code = code; // 'password' | 'repo' | 'token' | 'noWrite' | 'network' | 'unavailable' | 'unknown'
  }
}

/** Da "nome.github.io" ricava il repository del sito, "nome/nome.github.io". Su altri domini non può indovinarlo. */
export function detectRepo(hostname) {
  const match = /^([a-z0-9-]+)\.github\.io$/i.exec(hostname);
  return match ? `${match[1]}/${match[1]}.github.io` : '';
}

// Chi è dentro all'area riservata e con quale chiave. L'accesso è il possesso di un token GitHub con diritto di
// scrittura sul repository: la cassaforte lo tiene cifrato su questo dispositivo, la password lo apre per la visita.
// Il servizio non sa come si parla con GitHub: riceve `createGateway({ repo, token })` e una cassaforte.
export class AdminSession {
  #vault;
  #createGateway;
  #storage;
  #gateway = null;

  constructor({ vault, createGateway, storage = window.sessionStorage }) {
    this.#vault = vault;
    this.#createGateway = createGateway;
    this.#storage = storage;
    this.#restore();
  }

  get hasVault() {
    return this.#vault.exists;
  }

  get unlocked() {
    return this.#gateway !== null;
  }

  get gateway() {
    return this.#gateway;
  }

  /** Prima configurazione di questo dispositivo: verifica il token, lo cifra con la password e apre la sessione. */
  async setup({ repo, token, passphrase }) {
    const gateway = this.#build(repo.trim(), token.trim());
    const info = await this.#verify(gateway);
    if (!info.canWrite) throw new AdminError('noWrite');
    try {
      await this.#vault.save({ repo: repo.trim(), token: token.trim() }, passphrase);
    } catch (error) {
      throw new AdminError(error instanceof VaultError ? error.code : 'unavailable');
    }
    this.#open(gateway, repo.trim(), token.trim());
  }

  async unlock(passphrase) {
    let secret;
    try {
      secret = await this.#vault.open(passphrase);
    } catch (error) {
      throw new AdminError(error instanceof VaultError ? error.code : 'unknown');
    }
    this.#open(this.#build(secret.repo, secret.token), secret.repo, secret.token);
  }

  /** Esce dalla visita; la cassaforte resta, così la prossima volta basta la password. */
  lock() {
    this.#gateway = null;
    try {
      this.#storage.removeItem(SESSION_KEY);
    } catch { /* storage non disponibile: la sessione in memoria è già azzerata */ }
  }

  /** Toglie da questo dispositivo anche il token cifrato. */
  forget() {
    this.lock();
    this.#vault.clear();
  }

  #build(repo, token) {
    try {
      return this.#createGateway({ repo, token });
    } catch {
      throw new AdminError('repo');
    }
  }

  async #verify(gateway) {
    try {
      return await gateway.verify();
    } catch (error) {
      if (!(error instanceof ContentError)) throw new AdminError('unknown');
      if (error.code === 'auth') throw new AdminError('token');
      if (error.code === 'notFound' || error.code === 'forbidden') throw new AdminError('repo');
      throw new AdminError(error.code === 'network' ? 'network' : 'unknown');
    }
  }

  #open(gateway, repo, token) {
    this.#gateway = gateway;
    try {
      this.#storage.setItem(SESSION_KEY, JSON.stringify({ repo, token }));
    } catch { /* senza storage la sessione dura finché la pagina resta aperta */ }
  }

  #restore() {
    try {
      const saved = JSON.parse(this.#storage.getItem(SESSION_KEY));
      if (saved?.repo && saved?.token) this.#gateway = this.#createGateway(saved);
    } catch {
      this.#gateway = null;
    }
  }
}
