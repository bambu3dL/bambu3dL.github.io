# Guida: il sito su GitHub, senza installare nulla

Alla fine avrai:

- il sito online su `https://TUO-NOME.github.io` (gratis, con HTTPS);
- un'**area riservata** (`/admin`) da cui gestisci materiali, opere, magazzino e impostazioni, anche dal telefono;
- il **modulo di contatto** che salva i file su Google Drive e scrive via Gmail.

Tutto si fa dal browser. Il PC serve **una volta sola**, al passo 3, per caricare su GitHub i file del sito che ci sono già. Dopo, non serve più.

> **Nota onesta.** Ho collaudato il codice con GitHub e Google simulati, ma non ho accesso ai tuoi account: i passaggi nelle loro pagine li fai tu, e i nomi delle voci li ho scritti a memoria. Se una voce ha un nome diverso, cerca quella più simile.

## Come funziona, in breve

- Il sito è un insieme di file in un **repository** GitHub. GitHub Pages li pubblica.
- I contenuti (materiali, opere, magazzino, nome del sito) sono file di dati nello stesso repository.
- L'area riservata li modifica salvando un **commit** su GitHub, usando un **token personale** che solo tu hai. Ogni salvataggio rimette online il sito da solo (1–2 minuti) e resta nella cronologia, quindi si può sempre annullare.
- Il token non sta nel sito: lo incolli una volta per dispositivo e il browser lo conserva **cifrato** con una password che scegli tu.

## Cose da sapere prima

- **Il repository deve essere pubblico** (Pages gratuito lo richiede). Quindi tutto ciò che sta nei dati è pubblico, compresi i grammi a magazzino e il registro dei movimenti. Le **note interne** sulle quantità non le ho previste proprio per questo: tienile altrove.
- **I prezzi non ci sono più** e il "preventivo" è diventato "Contatti / Scrivici". Se invece volevi togliere del tutto anche il modulo di contatto, dimmelo.
- Il token è la chiave del sito: chi lo ha può modificarlo. Si limita a **un solo repository** e a **un solo permesso** (passo 5).

---

## 0. Prima di pubblicare

- [ ] **Opere, materiali e grammi** sono ancora d'esempio. Li sostituisci dall'area riservata, dopo il passo 6 (puoi eliminare quelli finti e aggiungere i tuoi).
- [ ] **Privacy** (`public/src/i18n/it.js`, voce "Chi tratta i dati"): ci sono ancora `[Nome e cognome o ragione sociale]`, `[indirizzo]`, `[email di contatto]`. Va compilata prima di dare il link a clienti veri, e va aggiunto che il sito è ospitato da GitHub Pages e che i messaggi passano da Google.
- [ ] **Nome del sito**: ora è "Stampe3D", un segnaposto. Lo cambi da **Impostazioni** nell'area riservata.
- [ ] Finché il sito è provvisorio, `public/robots.txt` chiede ai motori di ricerca di non indicizzarlo.

---

## 1. Account GitHub

Se non ne hai uno: <https://github.com/signup>. Attiva l'**autenticazione a due fattori** (Impostazioni → Password and authentication): chi entra nel tuo account GitHub entra anche nel sito. Il nome utente scelto qui diventa l'indirizzo del sito, quindi sceglilo con cura.

## 2. Crea il repository

1. In alto a destra: **+** → **New repository**.
2. **Repository name**: esattamente `TUO-NOME.github.io` (il tuo nome utente, minuscolo, più `.github.io`). Deve avere questo nome: così il sito sta alla radice dell'indirizzo, senza `/nome-repo` in mezzo.
3. **Public**. Lascia vuote le spunte "Add a README", ".gitignore" e "license".
4. **Create repository**.

## 3. Carica i file (l'unica volta in cui serve il PC)

1. Nella pagina del repository vuoto premi **uploading an existing file** (oppure **Add file → Upload files**).
2. Apri sul PC la cartella `C:\Lorenzo Claude\stampe3d` e trascina nella pagina **il contenuto della cartella**, non la cartella `stampe3d` stessa: così i percorsi nel repository restano `public/…`, `apps-script/…` e così via.
3. GitHub accetta al massimo 100 file per volta e la cartella `public` ne ha circa 90. Quindi **fai due giri**: prima trascina solo `public` e premi **Commit changes**; poi torna su **Add file → Upload files** e trascina tutto il resto (`apps-script`, `tools`, `.github` e i file sciolti).
4. In fondo, **Commit changes**.
5. Controlla che nel repository ci sia la cartella `.github/workflows` con `pages.yml`. Se manca (a volte le cartelle che iniziano con un punto non vengono trascinate): **Add file → Create new file**, scrivi come nome `.github/workflows/pages.yml` (le barre creano le cartelle) e incolla il contenuto del file `stampe3d/.github/workflows/pages.yml`. Poi **Commit changes**.

## 4. Attiva GitHub Pages

1. Nel repository: **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions**.
3. Vai alla scheda **Actions**. Se il lavoro "Pubblica il sito" non è già partito (o è fallito perché Pages non era ancora attivo), aprilo e premi **Run workflow** (oppure **Re-run all jobs**).
4. Dopo uno o due minuti, il segno verde. L'indirizzo è `https://TUO-NOME.github.io`: aprilo e guarda il sito.

## 5. Crea il token

È la chiave per modificare il sito dall'area riservata.

1. Foto profilo in alto a destra → **Settings** → in fondo a sinistra **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name**: ad esempio `sito admin`.
3. **Expiration**: la durata massima concessa (di solito 1 anno). Metti un promemoria per rinnovarlo.
4. **Repository access** → **Only select repositories** → scegli `TUO-NOME.github.io`.
5. **Permissions → Repository permissions**:
   - **Contents** → **Read and write** (necessario);
   - **Actions** → **Read-only** (facoltativo: serve solo a mostrare in Panoramica se la pubblicazione è andata a buon fine);
   - **Metadata** resta in sola lettura da solo.
6. **Generate token** e **copialo subito**: GitHub lo mostra una volta sola. Salvalo nel tuo gestore di password.

Non servono altri permessi. Se per errore scegli "All repositories" o dai permessi in più, rifai il token.

## 6. Primo accesso all'area riservata

1. Apri `https://TUO-NOME.github.io/admin/login`.
2. **Repository del sito**: dovrebbe essere già compilato (`TUO-NOME/TUO-NOME.github.io`).
3. **Token di GitHub**: incolla il token del passo 5.
4. **Scegli una password per questo dispositivo** (almeno 10 caratteri) e ripetila. Serve ad aprire il token, che sul dispositivo resta cifrato: senza questa password quello che è salvato non serve a nulla.
5. **Collega ed entra**.

Da quel momento, su quel dispositivo, basta la password. Per collegare un altro telefono o PC ripeti i punti 1–5 con lo stesso token.

- **Esci** chiude la visita (la password servirà di nuovo).
- **Dimentica questo dispositivo** (nella pagina di accesso) toglie anche il token cifrato dal browser.

## 7. Cosa puoi fare dall'area riservata

| Sezione | Cosa fai |
|---|---|
| **Panoramica** | Stato della pubblicazione, conteggi, bobine sotto il 20%, scorciatoie |
| **Materiali** | Aggiungi, cambia o elimina colori/bobine; gestisci le famiglie (PLA, PETG…) e i loro testi. Il residuo non si modifica qui |
| **Opere** | Aggiungi, cambia, nascondi o elimina le realizzazioni: titoli e descrizioni IT/EN, materiale, grammi, misure, forma 3D di esempio, **foto della stampa** (ridotta a 1600 px prima di caricarla) |
| **Magazzino** | "Ho stampato un'opera" (scala i grammi stimati), movimenti manuali (togli, aggiungi, imposta), registro degli ultimi movimenti |
| **Impostazioni** | Nome del sito ed email di contatto; link alla cronologia delle modifiche |

Dopo ogni salvataggio il sito pubblico si aggiorna da solo in 1–2 minuti. In **Panoramica** vedi "In corso" e poi "Il sito è aggiornato" (se hai dato il permesso Actions).

**Annullare un errore:** su GitHub, scheda **Code** → **Commits**: ogni modifica ha un messaggio chiaro (`Admin: aggiorna il materiale …`). Apri quella sbagliata e premi **Revert**.

**Se due persone modificano insieme:** se un contenuto è stato cambiato da qualcun altro mentre lavoravi, compare "Qualcuno ha cambiato questo contenuto": ricarica e riprova.

---

## 8. Modulo di contatto: Apps Script, Drive e Gmail

Sul tuo account Gmail. Non serve nulla sul PC.

**8.1 Crea il progetto**
1. Vai su <https://script.google.com> e premi **Nuovo progetto**. Rinominalo "Stampe3D contatti".

**8.2 Incolla il codice**
1. Apri `Code.gs`, cancella tutto e incolla il contenuto di `apps-script/Code.gs` (aprilo da GitHub: vai al file e premi il pulsante **Copy raw file**).
2. **Impostazioni progetto** (ingranaggio) → spunta **Mostra il file manifest "appsscript.json" nell'editor**.
3. Torna all'**Editor**, apri `appsscript.json` e incolla il contenuto di `apps-script/appsscript.json`. Salva.

**8.3 Prepara Drive**
1. Nel menu delle funzioni scegli **`inizializza`** → **Esegui**.
2. Autorizza: **Verifica le autorizzazioni** → il tuo account → "Google non ha verificato questa app" (è normale: è il tuo script) → **Avanzate** → **Vai a … (non sicuro)** → **Consenti**.
3. Nel registro compare il link alla cartella "Stampe3D – richieste" creata su Drive.

**8.4 Controlla le impostazioni** (Impostazioni progetto → Proprietà script)

| Proprietà | Valore |
|---|---|
| `DRIVE_FOLDER_ID` | l'ID della cartella (messo da `inizializza`) |
| `OWNER_EMAILS` | gli indirizzi che ricevono ogni messaggio, separati da virgola (se siete in due con due Gmail, scrivili entrambi) |
| `SITE_NAME` | il nome che compare nelle email |

**8.5 Collaudo:** esegui **`prova`**. Devono comparire una sottocartella su Drive e due email (una a voi, una di conferma).

**8.6 Pubblica:** **Esegui il deployment → Nuovo deployment** → ingranaggio → **App web** → **Esegui come: Me**, **Chi ha accesso: Chiunque** → **Esegui il deployment**. Copia l'**URL dell'app web** (finisce con `/exec`).

**8.7 Collegalo al sito (sempre dal browser)**
1. Su GitHub apri `public/src/config.js` e premi la matita (**Edit this file**).
2. Nella riga `quoteEndpoint: ''` incolla l'URL tra gli apici.
3. **Commit changes**. In un paio di minuti il modulo invia davvero.

**8.8 Se modifichi `Code.gs`:** non basta salvare. **Esegui il deployment → Gestisci i deployment** → matita → **Versione: Nuova versione**. L'URL non cambia.

**8.9 Se siete in due:** condividi la cartella "Stampe3D – richieste" con l'altra Gmail, altrimenti l'altro Lorenzo riceve la mail ma non può aprire i file.

**Da sapere:** una Gmail gratuita manda circa 100 destinatari al giorno (ogni messaggio ne usa 2 più un altro per ogni gestore). Il limite sui file (25 MB ciascuno, 30 MB in tutto) è prudente: fai una prova reale con un STL grande e, se fallisce, abbassalo in `Code.gs` **e** in `public/src/models/QuoteRequest.js`. Lo script ricontrolla tutto lato server e ammette al massimo 3 messaggi all'ora per indirizzo.

---

## 9. Controllo finale

- [ ] `https://TUO-NOME.github.io` si apre; anche `/gallery` aperto direttamente (grazie a `404.html`) mostra la pagina giusta.
- [ ] Nessuna pagina parla di prezzi o preventivi.
- [ ] Accesso su `/admin/login`; con la password sbagliata dice "Password non corretta."
- [ ] Salvi una modifica di prova (ad esempio il nome in **Impostazioni**): dopo 1–2 minuti la vedi nel sito.
- [ ] Il modulo di contatto invia con un file e arrivano le due email.
- [ ] Salvato il token nel gestore di password.

---

## 10. Dominio vero (Aruba)

1. Su GitHub: **Settings → Pages → Custom domain** → scrivi il dominio → **Save**.
2. Nel pannello DNS di Aruba aggiungi i record che GitHub indica: quattro record **A** per il dominio senza `www` (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) e un **CNAME** `www` verso `TUO-NOME.github.io`. Controlla gli indirizzi nella documentazione di GitHub Pages, perché possono cambiare. La posta e la webmail restano su Aruba.
3. Quando il certificato è pronto, spunta **Enforce HTTPS**.
4. Con un dominio proprio il sito non ricava più da solo il repository: in `public/src/config.js` scrivi `repo: 'TUO-NOME/TUO-NOME.github.io'` dentro `github`, oppure lo digiti nel modulo di accesso.
5. Quando il sito è pronto per essere trovato: cancella `public/robots.txt` (o sostituiscilo con `Allow: /`).

---

## 11. Se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| L'indirizzo dà "404" | Pages non attivo o primo deploy non riuscito | Passo 4: Source = GitHub Actions, poi rilancia il lavoro in Actions |
| Il lavoro in Actions fallisce | Pages non abilitato, oppure manca `.github/workflows/pages.yml` | Passo 4 e passo 3.5 |
| Una pagina come `/gallery` dà 404 | Il passo "Prepara 404.html" del workflow non è girato | Controlla che `pages.yml` sia quello del progetto e rilancialo |
| Accesso: "Il token non è valido o è scaduto" | Token scaduto, revocato o incollato male | Passo 5: nuovo token. Poi, nella pagina di accesso, "Dimentica questo dispositivo" e ripeti il passo 6 |
| Accesso: "Non trovo questo repository…" | Nome sbagliato, oppure il token non include quel repository | Controlla `proprietario/nome` e il passo 5.4 |
| Accesso: "Questo token può solo leggere" | Manca il permesso **Contents: Read and write** | Rifai il token (passo 5.5) |
| Dentro all'area riservata: "Il token non vale più" | Token scaduto o revocato nel frattempo | Entra di nuovo con un token nuovo |
| "GitHub chiede di rallentare" | Troppe richieste in poco tempo | Aspetta qualche minuto |
| Ho salvato ma il sito non cambia | La pubblicazione richiede 1–2 minuti; oppure è fallita | Panoramica → "Apri le Actions" e guarda l'ultimo lavoro. Ricarica con Ctrl+F5 |
| Ho dimenticato la password del dispositivo | Non si recupera (è cifrata) | Pagina di accesso → "Dimentica questo dispositivo", poi rifai il passo 6 con lo stesso token |
| Il modulo dice "Non siamo riusciti a inviare" | URL di Apps Script sbagliato, deployment non su "Chiunque", file oltre il limite | Apri l'URL nel browser: deve rispondere `{"ok":true…}`. Riprova senza file. In Apps Script → **Esecuzioni** vedi l'errore |
| Le email non arrivano | Quota Gmail, spam, o `OWNER_EMAILS` vuoto | Controlla lo spam e **Esecuzioni** |

## 12. Se il token finisce in mani sbagliate

Su GitHub: **Settings → Developer settings → Fine-grained tokens** → il token → **Revoke**. Crea un token nuovo (passo 5) e ricollega i tuoi dispositivi. Dalla scheda **Commits** controlla che non ci siano modifiche che non hai fatto tu, e annullale con **Revert**.
