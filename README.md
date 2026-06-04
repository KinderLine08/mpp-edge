# MPP Edge

PWA locale pour calculer des pronostics Mon Petit Prono avec une logique d'esperance de points.

## Acces

Serveur lance pendant cette session :

- PC : http://127.0.0.1:4173
- iPhone sur le meme Wi-Fi : http://192.168.1.30:4173

Sur iPhone, ouvre l'URL dans Safari puis utilise "Ajouter a l'ecran d'accueil" pour l'avoir comme une app.

## Publication GitHub Pages

Le dossier contient un workflow GitHub Actions :

```text
.github/workflows/pages.yml
```

Quand le repo sera pousse sur GitHub, active Pages avec la source "GitHub Actions". A chaque push sur `main` ou `master`, l'app sera publiee en HTTPS.

## Synchronisation

La synch utilise un GitHub Gist secret/non liste.

1. Cree un token GitHub avec le scope `gist`.
2. Dans l'app, ouvre Parametres.
3. Colle le token.
4. Clique sur "Creer Gist".
5. Sur l'autre appareil, colle le meme token et le Gist ID.
6. Clique sur "Recuperer" ou active "Synchronisation auto".

Le token est stocke uniquement dans le navigateur de l'appareil. Il n'est pas inclus dans l'export JSON.

## Methode

Pour chaque match, l'app calcule :

```text
proba brute = 1 / cote bookmaker
overround = somme des probas brutes
proba sans marge = proba brute / overround
EV issue = proba sans marge * points MPP
EV score = EV issue + proba score exact * bonus rarete estime
```

Si plusieurs scores ont une EV tres proche, l'app choisit le score le plus probable. Cela evite de sur-optimiser un bonus de rarete incertain.

## Donnees

Sans service payant :

- saisie rapide des points MPP et cotes 1/N/2 ;
- collage de texte OCR ;
- upload de capture depuis iPhone ;
- OCR navigateur via Tesseract.js si internet est disponible ;
- stockage local dans le navigateur ;
- export/import JSON.

## x2

Le gain marginal du x2 est l'EV totale du prono. L'app signale les candidats au-dessus du seuil configure dans Parametres.
