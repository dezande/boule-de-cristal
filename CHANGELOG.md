# Journal des versions

Toutes les versions de la boule de cristal, de la plus récente à la plus ancienne.

Les numéros suivent [semver](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`. Chaque version correspond à un tag git et à une [Release GitHub](https://github.com/dezande/boule-de-cristal/releases). Les versions `0.x` sont l'histoire du développement, avant que l'app soit complète et jouable en scène.

**Chaque changement s'écrit ici**, sous « À venir », dans le même commit que le changement lui-même : la CI refuse tout push qui touche au projet sans toucher à ce fichier (`npm run check:changelog`). Publier une version, c'est renommer « À venir » en numéro de version et poser le tag.

À ne pas confondre avec le **numéro affiché dans l'app** (en bas à gauche de la scène et dans les réglages) : celui-là est le nombre de commits, calculé au build, qui identifie précisément la version installée sur un téléphone. Le tableau ci-dessous donne la correspondance.

| Version | Commits | Date | En une phrase |
| --- | --- | --- | --- |
| [1.0.1](#101) | 18 | 2026-09-16 | Tests étendus à tous les cas |
| [1.0.0](#100) | 17 | 2026-09-15 | Toujours en portrait, écran allumé fiable, mises à jour sûres, via le kit |
| [0.11.0](#0110) | 16 | 2026-09-15 | Code découpé en dossiers et tests dans Chrome |
| [0.10.0](#0100) | 15 | 2026-09-15 | 4 zones = les 4 coins de l'écran |
| [0.9.0](#090) | 14 | 2026-09-15 | Double tap pour effacer, menu à 3 s, aides visuelles |
| [0.8.0](#080) | 12 | 2026-09-15 | Version sur la scène, mise à jour automatique, mode `?debug` |
| [0.7.0](#070) | 11 | 2026-09-15 | Réglages ouverts par un appui long |
| [0.6.0](#060) | 9 | 2026-09-15 | Numéro de version et cache hors-ligne nommé automatiquement |
| [0.5.0](#050) | 8 | 2026-09-15 | Outils : `npm run deploy` et serveur local en Node |
| [0.4.0](#040) | 5 | 2026-09-15 | TypeScript, Sass et déploiement par GitHub Actions |
| [0.3.0](#030) | 4 | 2026-09-15 | CSS et JS sortis de `index.html` |
| [0.2.0](#020) | 3 | 2026-09-15 | Tests lancés par GitHub Actions |
| [0.1.0](#010) | 1 | 2026-09-15 | Première version |

---

## À venir

Changements en place, pas encore publiés sous un numéro de version.

- **Journal des versions** : ce fichier, les tags git `vX.Y.Z` et les Releases GitHub correspondantes, pour les 18 commits déjà existants comme pour la suite.
- La CI vérifie à chaque push et chaque pull request que le journal a bien été mis à jour (`scripts/check-changelog.ts`, testé dans `tests/tools/`) : sinon, rien n'est publié.

## 1.0.1

**2026-09-16** — commit [`5a81270`](https://github.com/dezande/boule-de-cristal/commit/5a81270) — 18 commits

Aucun changement visible en scène : cette version couvre par des tests tout ce qui ne l'était pas encore.

- `tests/e2e/details.e2e.ts` : double tap pendant le délai, verrouillage pendant tout le fondu, taille du nombre selon ses chiffres, appui de 3 s pendant le délai, 4 coins et mode test téléphone tourné, libellés des curseurs, fondu et luminosité, valeur limitée à 6 caractères, Entrée dans un champ, informations de debug, barre d'état du mode test, message du chrono, mode `?debug`, souris, toucher interrompu par le système, menu contextuel, zoom et défilement bloqués, mise à jour pendant un tour.
- Outils de test communs extraits dans `tests/e2e/helpers.ts`.
- Kit mis à jour : tests du serveur local, de `check-dist` et de la configuration.

## 1.0.0

**2026-09-15** — commit [`393fe09`](https://github.com/dezande/boule-de-cristal/commit/393fe09) — 17 commits

Première version complète et fiable en scène. Le code commun aux accessoires passe dans un kit partagé.

- **Kit commun** : écran allumé, service worker, version, build, serveur local, déploiement et pilote de Chrome viennent du sous-module [kit-scene](https://github.com/dezande/kit-scene), monté dans `src/kit/`. Les copies locales sont supprimées.
- **Toujours en portrait** : sur iPhone, une page web ne peut pas bloquer la rotation ; l'app fait pivoter son affichage pour rester en portrait dans l'axe du téléphone. Zones, boule, particules et défilement des réglages suivent le téléphone.
- **Écran allumé** : la vidéo muette invisible reste active en même temps que l'API Screen Wake Lock (sur iPhone avant iOS 18.4, dans l'app installée, l'API seule ne suffit pas).
- **Correction** : une mise à jour supprimait les caches des autres apps de `dezande.github.io` (dont l'Analyseur Q), qui partagent la même origine. Seuls les anciens caches de la boule sont maintenant effacés.
- **Correction** : ouverte pour la première fois, l'app ne se rechargeait jamais pour prendre une mise à jour.
- La liste des fichiers mis en cache est calculée au build : un nouveau fichier dans `src/` n'a plus rien à déclarer.
- Tests dans Chrome ajoutés : téléphone tourné, écran allumé, publication d'une nouvelle version. La CI récupère le sous-module.

## 0.11.0

**2026-09-15** — commit [`d67f57e`](https://github.com/dezande/boule-de-cristal/commit/d67f57e) — 16 commits

Le fichier `src/app.ts` de 760 lignes est découpé ; les tests passent de la logique pure à l'app réelle.

- `src/` organisé par dossiers : `stage/` (gestes, boule, particules), `settings/` (validation, panneau), `rehearsal/` (mode test, chrono, diagnostic), `system/`, `logic/`.
- Commentaires sur chaque fichier et chaque fonction.
- Logique pure extraite et testée sous Node : suivi des gestes (`GestureTracker`) et validation des réglages, en plus des zones.
- **Tests de bout en bout dans Chrome** (`tests/e2e/`), sans dépendance : l'app compilée est pilotée dans Chrome sans interface, sur un écran de téléphone simulé, avec de vrais événements tactiles.
- GitHub Actions et `npm run deploy` lancent ces tests.

## 0.10.0

**2026-09-15** — commit [`a05779a`](https://github.com/dezande/boule-de-cristal/commit/a05779a) — 15 commits

Avec 4 zones, l'écran est coupé en 4 coins (haut gauche, haut droite, bas gauche, bas droite) au lieu de 4 bandes horizontales : les cibles sont plus grandes et plus faciles à viser sans regarder. Avec 2 ou 3 zones, les bandes horizontales restent inchangées. Le mode test montre les nouvelles limites.

## 0.9.0

**2026-09-15** — commits [`00b138e`](https://github.com/dezande/boule-de-cristal/commit/00b138e), [`61fdbb2`](https://github.com/dezande/boule-de-cristal/commit/61fdbb2) — 14 commits

Les gestes de scène prennent leur forme définitive.

- **Effacer** : double tap n'importe où quand un nombre est armé ou affiché, à la place de l'appui de 2 s dans le coin. Le tap qui arme ne compte pas, pour qu'un double tap à l'armement n'efface rien.
- **Réglages** : appui de 3 s (au lieu de 5 s) n'importe où sur l'écran, à tout moment, même avec un nombre affiché.
- **Aides visuelles** pour répéter, masquables dans les réglages et visibles par défaut : zone du menu en rouge et chrono qui compte la durée de l'appui.
- Logique des gestes isolée dans `src/gestures.ts`, testée avec des rythmes humains.
- Nettoyage : coin de réinitialisation, sonde des safe areas et repères associés supprimés.
- Les commentaires précisent que seul le magicien touche l'app : les gestes visent sa facilité, pas la résistance aux manipulations d'un spectateur.

## 0.8.0

**2026-09-15** — commit [`d85f2d5`](https://github.com/dezande/boule-de-cristal/commit/d85f2d5) — 12 commits

- La version (numéro et commit) s'affiche en petit en bas à gauche de la scène ; une option des réglages la masque.
- **Mise à jour automatique** : quand une nouvelle version est installée, l'app se recharge d'elle-même, à condition que personne n'ait touché l'écran depuis l'ouverture ou le retour au premier plan. Un tour en cours n'est jamais interrompu.
- **Mode diagnostic** : `?debug` dans l'adresse affiche un journal des touchers (appuis, durée, glissement, interruptions système, ouverture des réglages).

## 0.7.0

**2026-09-15** — commits [`d6fc22f`](https://github.com/dezande/boule-de-cristal/commit/d6fc22f), [`a20fb39`](https://github.com/dezande/boule-de-cristal/commit/a20fb39) — 11 commits

Le geste secret d'ouverture des réglages (tapotements puis appui maintenu) était trop difficile à réussir avec un vrai doigt : il échouait dès que les taps étaient un peu appuyés, qu'on hésitait, ou que le dernier contact était directement maintenu. Il a d'abord été recalibré et testé avec des rythmes humains, puis remplacé par un simple **appui maintenu de 5 s sur le socle** (glissement toléré de 40 px, marge de 24 px autour du socle).

`check-dist` vérifie aussi que chaque script du build est bien mis en cache hors-ligne.

## 0.6.0

**2026-09-15** — commit [`c381d9d`](https://github.com/dezande/boule-de-cristal/commit/c381d9d) — 9 commits

- Le build inscrit le numéro de version (nombre de commits) et le commit dans l'app. Les réglages les affichent, avec le cache hors-ligne en service et le mode d'affichage (app installée ou navigateur).
- **Le nom du cache est une empreinte du contenu du build** : plus rien à incrémenter à la main, un push sur `main` suffit pour que les téléphones prennent la mise à jour.
- `npm run deploy` n'incrémente plus rien : il vérifie, pousse et suit le déploiement.
- La CI récupère l'historique complet pour calculer le numéro de version.

## 0.5.0

**2026-09-15** — commits [`4584447`](https://github.com/dezande/boule-de-cristal/commit/4584447), [`debea53`](https://github.com/dezande/boule-de-cristal/commit/debea53), [`0fde495`](https://github.com/dezande/boule-de-cristal/commit/0fde495) — 8 commits

Les outils de travail, sans aucune dépendance ajoutée.

- `npm run deploy` : vérifie que `main` est propre et à jour, incrémente le cache hors-ligne, lance types, tests et build, commite, pousse, puis suit GitHub Actions jusqu'à la mise en ligne. Option `--dry-run`.
- `npm run serve` : serveur local en Node, avec les bons types MIME (indispensables pour les modules JS), sans cache, et qui refuse tout chemin hors de `dist/`. Python n'est plus nécessaire.

## 0.4.0

**2026-09-15** — commit [`e6ff9ad`](https://github.com/dezande/boule-de-cristal/commit/e6ff9ad) — 5 commits

Le socle technique du projet.

- Code typé en **TypeScript** strict (`src/app.ts`, `src/zone-logic.ts`) ; la logique des zones devient un module importé par l'app et par les tests.
- Service worker compilé depuis `src/sw/sw.ts` en script classique.
- Styles découpés en fichiers **Sass** (`src/styles/`), rendu identique (styles calculés comparés élément par élément).
- `public/` pour les fichiers statiques, `npm run build` génère `dist/`.
- La CI vérifie les types, lance les tests, compile, puis **publie `dist/` sur GitHub Pages**.

## 0.3.0

**2026-09-15** — commit [`b261a6a`](https://github.com/dezande/boule-de-cristal/commit/b261a6a) — 4 commits

`index.html` ne contient plus que la structure : les styles passent dans `style.css` et le code dans `app.js`. Comme il n'y a plus de code en ligne, la CSP n'autorise plus `'unsafe-inline'`. Les fichiers sont indentés avec des tabulations (`.editorconfig`), sauf le YAML qui les interdit.

## 0.2.0

**2026-09-15** — commits [`5d65d22`](https://github.com/dezande/boule-de-cristal/commit/5d65d22), [`159c8d8`](https://github.com/dezande/boule-de-cristal/commit/159c8d8) — 3 commits

GitHub Actions lance les tests de la logique des zones à chaque push et pull request, et vérifie que les icônes du manifest et les fichiers mis en cache par le service worker existent bien.

## 0.1.0

**2026-09-15** — commit [`81a9c16`](https://github.com/dezande/boule-de-cristal/commit/81a9c16) — 1 commit

Première version : une PWA mono-page, 100 % hors-ligne.

- Boule de cristal en CSS/SVG avec brume animée.
- Un toucher discret sur une des bandes de l'écran arme un nombre, qui apparaît après un délai réglable, puis l'écran se verrouille.
- Un appui long dans le coin réarme l'app ; les réglages sont cachés derrière un geste sur le socle.
- L'écran reste allumé grâce au Wake Lock, avec une vidéo muette en repli.
- Le service worker met tout en cache pour le mode avion.

---

## Publier une nouvelle version

À chaque changement, décrivez-le sous **« À venir »**, dans le commit qui le porte. La CI le vérifie (`npm run check:changelog`) : un push qui touche au projet sans toucher à ce fichier échoue, et rien n'est publié.

Le déploiement, lui, reste automatique : **chaque push sur `main` met l'app à jour** (voir le README). Le tag et la Release sont un geste à part, à faire quand le contenu d'« À venir » mérite d'être nommé : renommez la section en numéro de version, ajoutez sa date, son commit et le nombre de commits (`git rev-list --count HEAD`, le numéro affiché dans l'app), ajoutez la ligne au tableau du haut, puis :

```sh
git tag -a v1.1.0 -m "Titre de la version"   # sur le commit à publier
git push origin v1.1.0
gh release create v1.1.0 --title "v1.1.0 — Titre" --notes-file notes.md
```

- **Correctif** (`1.0.x`) : corrections, tests, rien de visible en scène.
- **Mineur** (`1.x.0`) : nouveau geste, nouveau réglage, changement visible sans tout casser.
- **Majeur** (`x.0.0`) : gestes ou réglages existants changés au point de devoir réapprendre le tour.
