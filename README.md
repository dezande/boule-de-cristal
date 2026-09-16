# Boule de cristal

Accessoire de scène : une PWA mono-page, 100 % hors-ligne, qui fait apparaître un nombre dans une boule de cristal. Le déclenchement se fait par un toucher discret sur l'écran.

## Utilisation

| Geste | Effet |
| --- | --- |
| Toucher le tiers **haut / central / bas** de l'écran | Arme **6 / 16 / 26**. Le nombre apparaît après le délai, puis l'écran se verrouille |
| **Double tap n'importe où**, quand un nombre est armé ou affiché | Le nombre s'estompe, l'app se réarme |
| **Appui de 3 s n'importe où** sur l'écran | Ouvre les réglages (et efface le nombre) |

Les réglages permettent de changer le nombre de zones, les valeurs, le délai (0–10 s), la durée du fondu et la luminosité. Avec 2 ou 3 zones, l'écran est coupé en bandes horizontales ; avec 4 zones, en 4 coins (haut gauche, haut droite, bas gauche, bas droite). Trois options y masquent les aides visuelles de la scène, toutes visibles par défaut : la zone du menu en rouge (tout l'écran), le chrono qui compte la durée d'un appui en haut de l'écran, et la petite version en bas à gauche. Masquez-les avant de jouer : le chrono apparaît aussi brièvement au toucher discret. Ils affichent aussi, pour le debug, l'état du maintien de l'écran allumé, le numéro de version (nombre de commits), le commit, le cache hors-ligne en service et le mode d'affichage (app installée ou navigateur). Le bouton **Test des zones** montre les limites des zones pour répéter.

### Diagnostic

Ajoutez `?debug` à l'adresse (https://dezande.github.io/boule-de-cristal/?debug) pour afficher en haut de l'écran un journal de ce que l'appareil reçoit : version, touchers, durée des appuis, glissements, interruptions par le système. À utiliser dans le navigateur, pas dans l'app installée.

## Installation

L'app doit être servie en HTTPS (GitHub Pages convient ; tous les chemins sont relatifs). Ouvrez la page une fois en ligne pour que le service worker mette tout en cache, puis :

- **iOS** : Safari → Partager → *Sur l'écran d'accueil*.
- **Android** : Chrome → menu → *Installer l'application*.

Pour vérifier le fonctionnement hors-ligne, relancez l'app en mode avion.

### Toujours en portrait, écran toujours allumé

- **Portrait** : l'app reste toujours en portrait. Sur Android, l'app installée verrouille l'orientation. Sur iPhone, une page web ne peut pas empêcher l'écran de basculer quand le téléphone est tourné sur le côté : l'app fait alors pivoter son affichage pour rester en portrait dans l'axe du téléphone. Les zones suivent le téléphone : la bande du haut reste celle du haut du téléphone.
- **Écran allumé** : l'API Screen Wake Lock et une vidéo muette invisible en boucle, actives en même temps (sur iPhone avant iOS 18.4, dans l'app installée, l'API seule ne suffit pas).
- **Réglages conservés** d'une version à l'autre : une mise à jour ne remplace que le cache hors-ligne. Elle ne supprime que les anciens caches de la boule, jamais ceux des autres apps de `dezande.github.io` (même origine, donc mêmes caches).

## Publication

`main` est protégée, comme dans le kit : **aucun push direct**, tout passe par une pull request, fusionnée **en rebase** et seulement si la CI est verte.

```sh
git switch -c mon-changement
# ... les changements, avec l'entrée sous « À venir » dans CHANGELOG.md
git push -u origin mon-changement
gh pr create --fill
gh pr merge --rebase --delete-branch   # refusé tant que la CI n'est pas verte
```

**Chaque fusion sur `main` met l'app à jour.** GitHub Actions vérifie le journal des versions et les types, lance les tests unitaires, compile, puis teste l'app compilée dans Chrome. Si tout passe, il déploie sur GitHub Pages ; sinon, rien n'est publié — et la pull request ne peut pas être fusionnée.

Les règles du dépôt, en détail :

| Règle | Effet |
| --- | --- |
| Pull request obligatoire | Personne ne pousse sur `main`, propriétaire compris. Aucune relecture exigée : on peut fusionner sa propre pull request |
| Historique linéaire, rebase seul | Pas de commit de fusion : la fusion en rebase est la seule proposée par GitHub |
| CI verte exigée | Le job « Types, tests, build et tests dans Chrome » doit passer, sur une branche à jour avec `main` |
| Discussions résolues | Les commentaires de la pull request doivent être clos avant la fusion |
| Ni force-push ni suppression | `main` ne peut pas être réécrite ni effacée |

Le nom du cache hors-ligne est calculé au build à partir du contenu de l'app, numéro de version compris. Il n'y a donc rien à incrémenter à la main : dès qu'une nouvelle version est publiée, les téléphones où elle est installée la récupèrent à la prochaine ouverture avec du réseau. L'app se recharge seule si personne n'a touché l'écran depuis l'ouverture et qu'aucun tour n'est en cours ; sinon à l'ouverture suivante.

Avant d'ouvrir la pull request, tout se vérifie en local (types, tests unitaires, build et tests dans Chrome) :

```sh
npm run deploy -- --dry-run # vérifications, build et tests seulement, sans push
```

`npm run deploy` sans option pousse sur `main` : il n'a plus cours ici, `main` le refuse. Suivez la CI avec `gh pr checks --watch`, ou dans l'onglet Actions du dépôt.

En local, tirez toujours en rebase pour garder l'historique linéaire (`git config pull.rebase true`, déjà réglé après un clone si vous le lancez une fois) :

```sh
git pull --rebase origin main
```

Chaque changement se note dans le [journal des versions](CHANGELOG.md), sous « À venir », dans le commit qui le porte : la CI refuse un push qui touche au projet sans toucher à ce fichier, et rien n'est publié. Les versions nommées (tags git `vX.Y.Z` et Releases GitHub) y sont décrites une par une.

## Développement

Il faut Node 24 ou plus récent. TypeScript et Sass servent uniquement au build : l'app publiée n'a aucune dépendance.

Le code commun aux accessoires de scène (écran allumé, portrait, hors-ligne et mises à jour, build, déploiement, pilotage de Chrome) vient du kit **[kit-scene](https://github.com/dezande/kit-scene)**, sous-module git monté dans `src/kit/`. L'app utilise une version précise du kit ; pour prendre la dernière, voir le README du kit.

```sh
git submodule update --init   # après un clone : récupère le kit
npm install
npm run serve       # build puis serveur local sur http://localhost:8000
npm test            # tests unitaires (quelques secondes)
npm run test:e2e    # tests dans Chrome de l'app compilée (environ 1 min, après npm run build)
npm run typecheck   # vérification des types
npm run check:changelog # le journal des versions a-t-il été mis à jour ?
npm run build       # génère dist/
```

### Tests

- **Tests unitaires** (`tests/logic/`, `npm test`) : la logique pure de `src/logic/`, sous Node. Zone touchée (bandes ou coins), décision de chaque geste (armer, effacer, ouvrir les réglages, annuler), validation des réglages relus sur l'appareil.
- **Règle du journal** (`tests/tools/`, lancé par `npm test`) : tout changement doit s'accompagner d'une entrée dans `CHANGELOG.md`.
- **Tests dans Chrome** (`tests/e2e/`, `npm run test:e2e`) : l'app compilée dans Chrome sans interface, sur un écran de téléphone simulé, avec de vrais événements tactiles. Il faut Google Chrome, trouvé automatiquement (sinon, indiquez son chemin dans `CHROME_PATH`). Outils communs dans `helpers.ts`.
  - `app.e2e.ts`, le tour de base : chaque zone, double tap, appui de 3 s (et ses annulations), délai, réglages enregistrés et relus, réglages abîmés, mode test, téléphone tourné (app pivotée, boule de la même taille, zones et défilement des réglages dans l'axe du téléphone), écran allumé (verrou et vidéo), nouvelle version publiée (nouveau cache, cache d'une autre app intact, réglages conservés, rechargement automatique), fonctionnement serveur arrêté.
  - `details.e2e.ts`, les cas limites : double tap pendant le délai, verrouillage pendant tout le fondu, taille du nombre selon ses chiffres, appui de 3 s pendant le délai, 4 coins et mode test téléphone tourné, libellés des curseurs, fondu et luminosité, valeur limitée à 6 caractères, Entrée dans un champ, informations de debug, barre d'état du mode test, message du chrono, mode `?debug`, souris, toucher interrompu par le système, menu contextuel, zoom et défilement bloqués, nouvelle version publiée pendant un tour (pas de rechargement).

Restent à vérifier sur un vrai téléphone : l'écran toujours allumé, le ressenti des gestes et l'installation sur l'écran d'accueil.

La liste des fichiers mis en cache hors-ligne est calculée au build : un nouveau fichier dans `src/` n'a rien à déclarer.

| Dossier | Contenu |
| --- | --- |
| `public/` | `index.html`, manifest et icônes, copiés tels quels |
| `src/app.ts` | Point d'entrée : démarrage et mises à jour automatiques (organisation détaillée en tête du fichier) |
| `src/stage/` | La scène : gestes (`touch.ts`), phases de la boule (`ball.ts`), particules (`dust.ts`) |
| `src/settings/` | Réglages : validation et enregistrement (`store.ts`), panneau de réglages (`panel.ts`) |
| `src/rehearsal/` | Aides à la répétition : test des zones, chrono d'appui, version et journal `?debug` |
| `src/system/` | Accès au DOM et scène |
| `src/kit/` | Kit commun [kit-scene](https://github.com/dezande/kit-scene) (sous-module) : écran allumé, portrait, service worker et mises à jour, version, styles `#app`, outils de build, déploiement et pilote de Chrome |
| `src/logic/` | Logique pure testée sous Node : zone touchée (bandes ou 4 coins), gestes, validation des réglages |
| `src/sw/` | Compilation du service worker du kit (`src/kit/sw/sw.ts`) |
| `src/styles/` | Styles Sass, compilés en `dist/style.css` |
| `tests/logic/` | Tests unitaires de `src/logic/` (`npm test`) |
| `tests/e2e/` | Tests dans Chrome (`npm run test:e2e`) |
| `tests/tools/` | Tests des outils du dépôt (`npm test`) |
| `scripts/` | Outils propres à l'app : vérification du journal des versions |
