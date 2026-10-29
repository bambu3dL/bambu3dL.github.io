# Sito stampe 3D

Vetrina pubblica statica, in italiano e inglese, con tema chiaro/scuro, hero 3D guidata dallo scroll, galleria, materiali con residui, contatti e privacy, più un'**area riservata** per gestire tutto dal browser.
**Per metterlo online (GitHub Pages, area riservata, modulo di contatto): [GUIDA-GITHUB.md](GUIDA-GITHUB.md). Non serve installare nulla.**

## Come è fatto

- Sito statico in `public/`, pubblicato da **GitHub Pages** con il workflow `.github/workflows/pages.yml` (che crea anche `404.html`, perché Pages non riscrive le rotte).
- I contenuti sono file nel repository: `public/assets/data/` (`works.json`, `materials.json`, `site.json`, `stock-log.json`) e `public/assets/uploads/` (foto). L'area riservata li modifica con l'API Contents di GitHub, un commit per salvataggio; ogni commit rimette online il sito.
- L'accesso all'area riservata è il possesso di un **token GitHub** (fine-grained, un solo repository, solo "Contents"). Il token sta sul dispositivo **cifrato** (PBKDF2 + AES-GCM) con una password scelta dall'utente.
- Il modulo di contatto invia a un'app web di **Google Apps Script** (`apps-script/Code.gs`): file su Drive, email Gmail a gestori e cliente.
- Il repository è pubblico: tutto ciò che sta nei dati è pubblico.

## Struttura (MVC, SOLID)

```
public/
  index.html            guscio: un solo documento, le pagine sono rotte
  assets/css/           tokens (colori, font), base, componenti, pagine
  assets/data/          dati modificabili dall'area riservata
  assets/uploads/       foto delle stampe caricate dall'area riservata
  assets/vendor/three/  Three.js 0.170 (MIT) in locale
  src/
    main.js             composition root: l'unico file che sceglie le implementazioni concrete
    config.js           nome sito, repository, URL di Apps Script
    core/               Router, PreferenceStore, html (escape), dom, forms, image, base64, reveal
    models/             Work, Material, QuoteRequest, RequestStatus; AdminRules (regole dei contenuti, pure)
    repositories/       contratti WorksRepository / MaterialsRepository + adattatori JSON (nascondono le opere non visibili)
    gateways/           contratti QuoteGateway e ContentGateway; SimulatedQuoteGateway, AppsScriptQuoteGateway, GitHubContentGateway
    services/           QuoteService, StockEstimator, ThemeService; TokenVault, AdminSession, CatalogAdmin
    i18n/               I18nService, it.js / en.js (pubblico), admin.it.js (area riservata, solo italiano)
    views/              funzioni pure che restituiscono markup (html`` con escape automatico)
    controllers/        un controller per pagina; AdminPage (guardia, messaggi, errori) e un controller per sezione admin, caricati a richiesta (LazyController)
    three/              forme di esempio, materiale di stampa, palco, hero (ugello e piano in PEI), time lapse, visore
apps-script/            Code.gs e appsscript.json del modulo di contatto
tools/serve.mjs         server locale facoltativo (solo per chi sviluppa)
```

- **Single responsibility**: ogni servizio ha un compito (tema, lingua, invio, cassaforte del token, sessione, catalogo).
- **Open/closed**: le rotte e i dizionari si registrano da fuori; aggiungere una pagina non tocca il router.
- **Dependency inversion**: controller e servizi ricevono gateway e repository già costruiti; per cambiare luogo dei contenuti (ad esempio un database) si scrive un'altra classe con il contratto di `ContentGateway` e si cambia una riga in `main.js`.

## Cosa è vero e cosa è di esempio

- **Hero**: ugello, blocco riscaldatore e piano in PEI sono modellati nel codice (`BedScene.js`); il vaso è una forma di esempio. Non è un modello CAD di una macchina precisa.
- **Dati**: opere, materiali e grammi in `assets/data/*.json` sono ancora d'esempio e vanno sostituiti dall'area riservata. Le forme 3D sono generate dal codice (vaso, nido d'ape, ingranaggio); le foto reali si aggiungono dall'area riservata. L'import da `.3mf`/`.stl` dello slicer non c'è ancora.
- **Prezzi e preventivi**: non ci sono. Il sito è solo vetrina; "Contatti" è un modulo di messaggio.
- **Modulo di contatto**: con `SITE.backend.quoteEndpoint` vuoto l'invio è simulato e dichiarato come tale. Con l'URL di Apps Script parte davvero. Collaudato con servizi Google simulati, non ancora su un account reale.
- **Area riservata**: materiali, opere (con foto), famiglie, magazzino con registro, impostazioni. Collaudata con un finto GitHub in memoria, non ancora su un repository reale.
- **Nome attività, email di contatto, privacy policy**: da completare (i campi tra `[parentesi]` nella privacy).
- **Non realizzati**: note interne sulle quantità (il repository è pubblico), stati delle richieste online, import dal slicer.

## Sicurezza

- CSP restrittiva in `index.html` (nessuno script o stile inline, nessuna risorsa di terzi). `connect-src` ammette solo `api.github.com` e Google Apps Script. GitHub Pages non permette intestazioni personalizzate, quindi la CSP è nel meta tag.
- Ogni testo dinamico passa da `html\`\`` che lo escapa; gli esadecimali dei colori sono validati prima di arrivare negli attributi.
- Area riservata: pagine `noindex`; token mai in chiaro su disco (cifrato nella cassaforte, in chiaro solo in `sessionStorage` durante la visita); errori di accesso senza dettagli utili a chi attacca; ogni scrittura rilegge il file prima di modificarlo (niente sovrascritture alla cieca; conflitti segnalati).
- Il modulo di contatto ha un campo-trappola per i bot e limiti su tipo/numero/dimensione dei file; **Apps Script ricontrolla tutto lato server** e limita la frequenza degli invii.
- Preferenze (tema, lingua) in `localStorage` per sei mesi solo se il visitatore acconsente; altrimenti `sessionStorage`.

## Accessibilità e prestazioni

- Salto al contenuto, landmark, focus visibile, annunci di cambio pagina, errori dei moduli legati ai campi, messaggi d'errore annunciati.
- Con "riduci movimento" l'hero resta ferma sulle stampe finite. Senza WebGL restano le anteprime.
- Three.js e il codice dell'area riservata si scaricano solo sulle pagine che li usano.
