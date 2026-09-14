# Boule de cristal

Accessoire de scène : une PWA mono-page, 100 % hors-ligne, qui fait apparaître un nombre dans une boule de cristal. Le déclenchement se fait par un toucher discret sur l'écran.

## Utilisation

| Geste | Effet |
| --- | --- |
| Toucher le tiers **haut / central / bas** de l'écran | Arme **6 / 16 / 26**. Le nombre apparaît après le délai, puis l'écran se verrouille |
| Appui de **2 s** dans le coin inférieur droit | Le nombre s'estompe, l'app se réarme |
| **3 tapotements** sur le socle, puis **appui de 1 s** | Ouvre les réglages (et efface le nombre) |

Les réglages permettent de changer le nombre de zones (2, 3 ou 4), les valeurs, le délai (0–10 s), la durée du fondu et la luminosité. Ils affichent aussi l'état du maintien de l'écran allumé. Le bouton **Test des zones** montre les limites des zones pour répéter.

## Installation

L'app doit être servie en HTTPS (GitHub Pages convient ; tous les chemins sont relatifs). Ouvrez la page une fois en ligne pour que le service worker mette tout en cache, puis :

- **iOS** : Safari → Partager → *Sur l'écran d'accueil*.
- **Android** : Chrome → menu → *Installer l'application*.

Pour vérifier le fonctionnement hors-ligne, relancez l'app en mode avion.

Pour publier une nouvelle version, incrémentez `CACHE` dans `src/sw/sw.ts`, sinon les appareils où l'app est déjà installée gardent l'ancienne. Poussez ensuite sur `main` : GitHub Actions vérifie les types, lance les tests, compile puis déploie sur GitHub Pages.

## Développement

Il faut Node 24 ou plus récent. TypeScript et Sass servent uniquement au build : l'app publiée n'a aucune dépendance.

```sh
npm install
npm run serve       # build puis http://localhost:8000
npm test            # tests de la logique des zones
npm run typecheck   # vérification des types
npm run build       # génère dist/
```

| Dossier | Contenu |
| --- | --- |
| `public/` | `index.html`, manifest et icônes, copiés tels quels |
| `src/app.ts` | Scène, gestes, réglages, maintien de l'écran allumé |
| `src/zone-logic.ts` | Logique pure « coordonnée Y → valeur », testée sous Node |
| `src/sw/sw.ts` | Service worker (cache hors-ligne) |
| `src/styles/` | Styles Sass, compilés en `dist/style.css` |
| `tests/` | Tests unitaires TypeScript (`node --test`) |
| `scripts/check-dist.ts` | Vérifie que le build contient tout ce que le service worker met en cache |
