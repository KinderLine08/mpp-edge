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
5. Clique sur "Copier le lien magique" et garde-le dans Notes (iPhone) :
   ouvrir ce lien restaure token + Gist ID + auto-sync en un tap.
6. Sur l'autre appareil : ouvre le lien magique, ou colle le Gist ID seul
   puis "Recuperer" (la lecture marche sans token ; le token n'est requis
   que pour envoyer).

Le token est stocke uniquement dans le navigateur de l'appareil (et dans le
lien magique si tu en copies un : garde-le prive). Il n'est pas inclus dans
l'export JSON. Les champs vides du formulaire n'ecrasent jamais une config
deja enregistree, et l'app demande le stockage persistant au navigateur
pour limiter le nettoyage iOS.

## Methode

Pour chaque match, l'app calcule :

```text
proba brute = 1 / cote bookmaker
overround = somme des probas brutes
proba sans marge = proba brute / overround
EV issue = proba sans marge * points MPP
EV score = EV issue + proba score exact * bonus rarete
```

Le bonus rarete depend de la repartition des pronos de l'ensemble des
joueurs MPP, figee au coup d'envoi : il n'est pas connaissable a l'avance.
L'app l'estime (`~` dans le tableau) en modelisant ce que la foule joue :
proba du score dans son issue + biais de popularite (1-0, 2-0, 2-1 et 1-1
sur-joues, scores larges sous-joues). Le champ "Forcer le bonus rarete par
score" (format `2-0 30`) permet de remplacer l'estimation (`+` dans le
tableau) si tu as une meilleure info. Apres chaque match, renseigne le
bonus reellement obtenu ("Bonus exact reel") pour verifier le calibrage.

Si plusieurs scores ont une EV tres proche, l'app choisit le score le plus
probable. Cela evite de sur-optimiser un bonus de rarete incertain.

## Regles officielles MPP (captures du 11 juin 2026)

Verifiees sur les pages "Regles du jeu" de l'app MPP :

- Bon resultat (1/N/2) = points de la cote MPP affichee, sinon 0.
- Score exact en plus = points additionnels selon l'indice de rarete du
  prono joue. Exemple officiel : USA - Paraguay (cotes 100-113-98), victoire
  USA 2-1 ; prono 2-0 = 100 pts, prono 2-1 "Rare" = 130 pts. La grille
  +20/+30/+50/+70/+100 de l'app correspond (+30 = Rare confirme).
- x2 : un seul pour toute la competition, double tout, bonus de rarete
  compris (1-0 juste + x2 = 200 pts dans l'exemple officiel). Mauvaise
  issue = 0, meme avec x2.
- Le prono est unique pour toutes les ligues et challenges.
- Les cotes MPP sont figees environ 2 semaines avant chaque match (cotes
  bookmaker + coefficient maison) : pas besoin de re-saisir a la derniere
  minute.
- Favoris (vainqueur de la competition + meilleur buteur) a verrouiller
  avant le 11 juin 2026 21h, coup d'envoi de Mexique - Afrique du Sud.
  Points credites apres la finale du 20 juillet.
- Meilleur buteur : en cas d'egalite, seuls les points du meilleur buteur
  officiel de la competition sont attribues.
- Challenges avec dotation : les points ne comptent qu'a partir du moment
  ou tu rejoins le challenge.

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
