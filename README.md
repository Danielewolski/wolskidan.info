# WOLSKI — Links

Pagina link con foto 3D a livelli. Solo HTML, CSS e JavaScript: niente npm, niente build.

```
index.html     struttura e LINK (modifica qui href e testi)
style.css      stile
script.js      scena 3D (WebGL), animazioni (GSAP da CDN), grana, scintille
assets/
  bg.webp            sfondo: il ring con i fighter rimossi e ricostruito dall'AI (LaMa)
  bg-depth.webp      profondità dello sfondo
  fg.webp            i fighter ritagliati (BiRefNet), con trasparenza
  fg-depth.webp      profondità dei fighter
  wolski-3d.webp     foto originale: anteprima social e ripiego se WebGL non c'è
  inline-assets.js   le 4 immagini della scena in base64, solo per l'apertura con doppio clic
```

## Come funziona

La foto IMG_6380 è divisa in due livelli 3D: **sfondo** (il ring vuoto ricostruito) e **fighter**.
Ogni livello ha la sua mappa di profondità (Depth Anything V2): quando la camera si muove, lo sfondo e i fighter si spostano in direzioni opposte.
La scritta **WOLSKI** sta in mezzo ai due livelli, quindi i fighter le passano davanti come su una copertina.

All'ingresso si vede prima il ring vuoto, poi sale il nome e infine i fighter entrano verso lo spettatore.
Il movimento segue il mouse su desktop e il giroscopio sul telefono (su iPhone tocca "Attiva 3D"); senza interazioni oscilla da solo.
Con "riduci movimento" attivo nel sistema la scena resta ferma.

Parametri regolabili in cima a `script.js`: `STRENGTH` (ampiezza del 3D), `FOCUS` (inquadratura sui telefoni), `FOCUS_DEPTH`.
Posizione e dimensione del nome si cambiano in `style.css` (`.title` e `.name`).

## Modificare i link

Apri `index.html`, cerca il commento `I TUOI LINK` e cambia `href`, titolo e descrizione.

## Vederla in locale

Basta il doppio clic su `index.html`. Da file la pagina usa `assets/inline-assets.js`; online quel file non viene mai scaricato.
Se cambi le immagini in `assets/` va rigenerato anche `inline-assets.js`.

## Pubblicarla

Carica `index.html`, `style.css`, `script.js` e la cartella `assets/` su un hosting statico qualsiasi: Netlify Drop, GitHub Pages, Cloudflare Pages, oppure lo stesso hosting di wolskidev.site.

