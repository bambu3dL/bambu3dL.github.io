# Guida: il sito su GitHub, senza installare nulla

Alla fine avrai:

- il sito online su `https://TUO-NOME.github.io` (gratis, con HTTPS);
- un'**area riservata** (`/admin`) da cui gestisci materiali, opere, magazzino e impostazioni, anche dal telefono;
- il **modulo di contatto** che salva i file su Google Drive, scrive via Gmail e tiene l'elenco delle richieste in un **foglio Google privato**, che gestisci dalla sezione **Contatti**.

Tutto si fa dal browser. Il PC serve **una volta sola**, al passo 3, per caricare su GitHub i file del sito che ci sono già. Dopo, non serve più.

> **Nota onesta.** Ho collaudato il codice con GitHub e Google simulati, ma non ho accesso ai tuoi account: i passaggi nelle loro pagine li fai tu, e i nomi delle voci li ho scritti a memoria. Se una voce ha un nome diverso, cerca quella più simile.

## Come funziona, in breve

- Il sito è un insieme di file in un **repository** GitHub. GitHub Pages li pubblica.
- I contenuti (materiali, opere, magazzino, nome del sito) sono file di dati nello stesso repository.
- L'area riservata li modifica salvando un **commit** su GitHub, usando un **token personale** che solo tu hai. Ogni salvataggio rimette online il sito da solo (1–2 minuti) e resta nella cronologia, quindi si può sempre annullare.
- Il token non sta nel sito: lo incolli una volta per dispositivo e il browser lo conserva **cifrato** con una password che scegli tu.

## Cose da sapere prima

- **I dati dei clienti non stanno nel repository.** Nome, email e messaggi delle richieste vivono solo nel tuo foglio Google (privato) e l'area riservata li legge con una chiave segreta che solo tu hai.
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

## 3. I file sul repository

Questo passo è **già fatto**: il sito è stato caricato con Git dalla cartella del repository sul PC. Se un giorno servisse rifarlo dal browser: **Add file → Upload files**, trascina il contenuto della cartella (prima `public`, poi il resto: sono più di 100 file) e controlla che esista `.github/workflows/pages.yml`; se manca, crealo con **Add file → Create new file** incollando il contenuto.

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
4. **Chiave dei contatti** (facoltativa): la crei al passo 8.5. Puoi lasciarla vuota ora e darla dopo, dalla sezione **Contatti**.
5. **Scegli una password per questo dispositivo** (almeno 10 caratteri) e ripetila. Serve ad aprire il token, che sul dispositivo resta cifrato: senza questa password quello che è salvato non serve a nulla.
6. **Collega ed entra**.

Da quel momento, su quel dispositivo, basta la password. Per collegare un altro telefono o PC ripeti i punti 1–5 con lo stesso token.

- **Esci** chiude la visita (la password servirà di nuovo).
- **Dimentica questo dispositivo** (nella pagina di accesso) toglie anche il token cifrato dal browser.

## 7. Cosa puoi fare dall'area riservata

| Sezione | Cosa fai |
|---|---|
| **Panoramica** | Richieste da leggere, stato della pubblicazione, conteggi, fili da riordinare, scorciatoie |
| **Contatti** | Le richieste arrivate dal modulo: elenco con filtro per stato, scheda con messaggio e file, risposta per email, stato (ricevuta, in valutazione, proposta inviata, confermata, in stampa, pronta, chiusa) e nota; eliminazione |
| **File** | I modelli su Google Drive: scegli la **Libreria** (file tuoi) o la cartella di una richiesta, vedi i file (anche quelli che il cliente ha allegato dal modulo), **carichi** altri file (STL, 3MF, STEP, IGES, OBJ, DWG, DXF e altri CAD, fino a 5 alla volta) e puoi metterli nel **cestino** di Drive |
| **Fili** | Il catalogo: famiglia (PLA, PETG…), colore, marca, peso nominale di una bobina. Alla creazione puoi aggiungere subito le bobine. Qui anche i testi delle famiglie |
| **Bobine** | I pezzi fisici di ogni filo: aggiungi una bobina (nuova o iniziata), regola i grammi, segnala finita o riaprila, eliminala. **"Ho stampato un oggetto"** toglie i grammi stimati partendo dalla bobina più vecchia e passa alla successiva quando si svuota. **"Ho usato dei grammi"** fa lo stesso scrivendo tu i grammi (una prova, uno scarto, una stampa fuori vetrina), senza scegliere un oggetto. Registro dei movimenti |
| **Oggetti** | Le realizzazioni in vetrina: titoli e descrizioni IT/EN, filo, grammi, misure, forma 3D di esempio, **foto della stampa** (ridotta a 1400 px e compressa prima di caricarla, senza i dati nascosti come la posizione), visibile o nascosto |
| **Impostazioni** | Nome del sito ed email di contatto; link alla cronologia delle modifiche |

**Fili e bobine, in breve.** Un *filo* è una voce del catalogo ("PLA · Rosso lampone"); una *bobina* è un pezzo fisico di quel filo. Un filo può avere più bobine e il suo residuo è la somma di quelle in uso. Una bobina a zero grammi si chiude da sola; una bobina chiusa non conta nel residuo mostrato nel sito.

Dopo ogni salvataggio il sito pubblico si aggiorna da solo in 1–2 minuti. In **Panoramica** vedi "In corso" e poi "Il sito è aggiornato" (se hai dato il permesso Actions).

**Annullare un errore:** su GitHub, scheda **Code** → **Commits**: ogni modifica ha un messaggio chiaro (`Admin: aggiorna il materiale …`). Apri quella sbagliata e premi **Revert**.

**Se due persone modificano insieme:** se un contenuto è stato cambiato da qualcun altro mentre lavoravi, compare "Qualcuno ha cambiato questo contenuto": ricarica e riprova.

---

## 8. Modulo di contatto e contatti: Apps Script, Drive, Gmail e foglio

Sul tuo account Gmail. Non serve nulla sul PC.

**8.1 Crea il progetto**
1. Vai su <https://script.google.com> e premi **Nuovo progetto**. Rinominalo "Stampe3D contatti".

**8.2 Incolla il codice**
1. Apri `Code.gs`, cancella tutto e incolla il contenuto di `apps-script/Code.gs` (aprilo da GitHub: vai al file e premi **Copy raw file**).
2. **Impostazioni progetto** (ingranaggio) → spunta **Mostra il file manifest "appsscript.json" nell'editor**.
3. Torna all'**Editor**, apri `appsscript.json` e incolla il contenuto di `apps-script/appsscript.json`. Salva.

**8.3 Prepara Drive e il foglio**
1. Nel menu delle funzioni scegli **`inizializza`** → **Esegui**.
2. Autorizza: **Verifica le autorizzazioni** → il tuo account → "Google non ha verificato questa app" (è normale: è il tuo script) → **Avanzate** → **Vai a … (non sicuro)** → **Consenti**.
3. Nel registro compaiono il link alla cartella "Stampe3D – richieste" e quello al foglio "Stampe3D – elenco richieste". Il foglio è privato: lo vedi solo tu.

**8.4 Controlla le impostazioni** (Impostazioni progetto → Proprietà script)

| Proprietà | Valore |
|---|---|
| `DRIVE_FOLDER_ID` | l'ID della cartella (messo da `inizializza`). Se preferisci una cartella tua già esistente, incolla qui il suo ID (la parte dopo `/folders/` nell'indirizzo): le richieste e la Libreria si creeranno lì dentro |
| `SHEET_ID` | l'ID del foglio (messo da `inizializza`) |
| `OWNER_EMAILS` | gli indirizzi che ricevono ogni messaggio, separati da virgola (se siete in due con due Gmail, scrivili entrambi) |
| `SITE_NAME` | il nome che compare nelle email |

**8.5 Crea la chiave dei contatti.** Scegli la funzione **`creaChiaveAdmin`** → **Esegui**. Nel registro compare una chiave lunga: **copiala subito** nel gestore di password. È ciò che permette all'area riservata di leggere le richieste. Se la perdi, rilancia la funzione: ne crea una nuova (e va ridata ai dispositivi).

**8.6 Collaudo:** esegui **`prova`**. Devono comparire una sottocartella su Drive, una riga nel foglio "Richieste" e due email (una a voi, una di conferma).

**8.7 Pubblica:** **Esegui il deployment → Nuovo deployment** → ingranaggio → **App web** → **Esegui come: Me**, **Chi ha accesso: Chiunque** → **Esegui il deployment**. Copia l'**URL dell'app web** (finisce con `/exec`).

**8.8 Collegalo al sito (sempre dal browser)**
1. Su GitHub apri `public/src/config.js` e premi la matita (**Edit this file**).
2. Nella riga `quoteEndpoint: ''` incolla l'URL tra gli apici.
3. **Commit changes**. In un paio di minuti il modulo invia davvero e la sezione **Contatti** si può collegare.

**8.9 Collega i contatti all'area riservata.** Apri **Contatti**: ti chiede la **chiave** (passo 8.5) e la **password di questo dispositivo**. La chiave viene cifrata come il token e non dovrai rimetterla su questo dispositivo. Su un altro dispositivo, la dai al primo accesso o dalla stessa sezione.

**8.10 Se modifichi `Code.gs`** (ad esempio dopo un aggiornamento del sito): non basta salvare. Incolla il nuovo codice, lancia di nuovo **`inizializza`** (è sicuro rilanciarlo: crea solo ciò che manca, ad esempio il foglio se è la prima volta), poi **Esegui il deployment → Gestisci i deployment** → matita → **Versione: Nuova versione**. L'URL non cambia. Google può chiedere di nuovo le autorizzazioni (il foglio richiede un permesso in più).

**8.11 I file su Drive: chi può fare cosa.** La cartella è una sola e ha due ingressi, tutti e due dal sito:
- **i clienti** possono solo **allegare** file al modulo di contatto (STL, 3MF, STEP, IGES, OBJ, DWG, DXF e altri CAD, al massimo 5 file, 25 MB ciascuno e 30 MB in tutto). Ogni richiesta ha la sua sottocartella; il cliente non vede né cancella nulla;
- **tu** dalla sezione **File** dell'area riservata: elenchi, carichi e metti nel cestino. Si usa la stessa chiave dei contatti (passo 8.9), quindi non c'è altro da collegare.

I file senza una richiesta vanno nella sottocartella **Libreria**, che lo script crea da sé la prima volta. Lo script non tocca mai altro in Drive (né il foglio né le tue cartelle): solo la Libreria e le cartelle delle richieste. "Sposta nel cestino" non cancella per sempre: da Drive lo ripristini entro 30 giorni. I link "Apri" si aprono su Drive e funzionano solo per gli account con cui la cartella è condivisa.

**8.12 Se siete in due:** condividi la cartella "Stampe3D – richieste" e il foglio con l'altra Gmail, altrimenti l'altro Lorenzo riceve la mail ma non può aprire i file. Per usare la sezione Contatti anche dal suo dispositivo, serve la stessa chiave.

**Da sapere:** una Gmail gratuita manda circa 100 destinatari al giorno (ogni messaggio ne usa 2 più un altro per ogni gestore). Il limite sui file (25 MB ciascuno, 30 MB in tutto) è prudente: fai una prova reale con un STL grande e, se fallisce, abbassalo in `Code.gs` **e** in `public/src/models/QuoteRequest.js`. Lo script ricontrolla tutto lato server, ammette al massimo 3 messaggi all'ora per indirizzo e blocca per un'ora la lettura dei contatti dopo 10 chiavi sbagliate. Nel foglio le celle sono in formato testo, così un cliente non può inserirci formule.

---

## 9. Controllo finale

- [ ] `https://TUO-NOME.github.io` si apre; anche `/gallery` aperto direttamente (grazie a `404.html`) mostra la pagina giusta.
- [ ] Nessuna pagina parla di prezzi o preventivi.
- [ ] Accesso su `/admin/login`; con la password sbagliata dice "Password non corretta."
- [ ] Salvi una modifica di prova (ad esempio il nome in **Impostazioni**): dopo 1–2 minuti la vedi nel sito.
- [ ] Il modulo di contatto invia con un file, arrivano le due email e la richiesta compare in **Contatti**.
- [ ] In **File** carichi un STL di prova nella Libreria: compare nell'elenco e su Drive. Lo sposti nel cestino.
- [ ] Cambi lo stato di una richiesta di prova e poi la elimini.
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
| **Contatti**: "La chiave dei contatti non è corretta" | Chiave sbagliata o ruotata (hai rilanciato `creaChiaveAdmin`) | Incolla la chiave attuale nel modulo che compare |
| **Contatti**: "bloccato per un'ora" | Troppi tentativi con chiavi sbagliate | Aspetta un'ora, poi riprova con la chiave giusta |
| **Contatti**: "Lo script non ha ancora il foglio o la chiave" | Mancano `SHEET_ID` o `ADMIN_KEY` | Rilancia `inizializza` e `creaChiaveAdmin` (passi 8.3 e 8.5), poi una nuova versione del deployment |
| **Contatti**: la richiesta c'è su Drive e per email ma non nell'elenco | Il foglio non era ancora stato creato quando è arrivata | Aggiungila a mano nel foglio, oppure ignora: i file e le email ci sono comunque |
| **File**: "Uno dei file ha un formato non ammesso" | Il formato non è nell'elenco (ad esempio un PDF o un ZIP) | Carica solo modelli e CAD; per altro usa Drive direttamente |
| **File**: l'elenco o il caricamento non funzionano dopo un aggiornamento | Lo script ha ancora il vecchio codice | Incolla il nuovo `Code.gs` e fai una **nuova versione** del deployment (passo 8.10) |
| **File**: "Questa richiesta o questo file non esiste più" | La cartella è stata spostata o cancellata su Drive | Aggiorna la pagina; se serve, ripristinala dal cestino di Drive |
| Le email non arrivano | Quota Gmail, spam, o `OWNER_EMAILS` vuoto | Controlla lo spam e **Esecuzioni** |

## 12. Se il token finisce in mani sbagliate

Su GitHub: **Settings → Developer settings → Fine-grained tokens** → il token → **Revoke**. Crea un token nuovo (passo 5) e ricollega i tuoi dispositivi. Dalla scheda **Commits** controlla che non ci siano modifiche che non hai fatto tu, e annullale con **Revert**.
