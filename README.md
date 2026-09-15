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

## Publication

**Chaque push sur `main` met l'app à jour.** GitHub Actions vérifie les types, lance les tests unitaires, compile, puis teste l'app compilée dans Chrome. Si tout passe, il déploie sur GitHub Pages ; sinon, rien n'est publié.

Le nom du cache hors-ligne est calculé au build à partir du contenu de l'app. Il n'y a donc rien à incrémenter à la main : dès qu'un fichier de l'app change, les téléphones où elle est installée récupèrent la nouvelle version à la prochaine ouverture avec du réseau.

Pour publier en suivant le déploiement depuis le terminal :

```sh
npm run deploy              # vérifie en local, pousse, suit GitHub Actions et contrôle le site
npm run deploy -- --dry-run # vérifications, build et tests seulement, sans push
```

Le suivi utilise GitHub CLI (`gh`) s'il est installé. Sans lui, suivez le déploiement dans l'onglet Actions du dépôt.

## Développement

Il faut Node 24 ou plus récent. TypeScript et Sass servent uniquement au build : l'app publiée n'a aucune dépendance.

```sh
npm install
npm run serve       # build puis serveur local sur http://localhost:8000
npm test            # tests unitaires (quelques secondes)
npm run test:e2e    # tests dans Chrome de l'app compilée (environ 1 min, après npm run build)
npm run typecheck   # vérification des types
npm run build       # génère dist/
```

### Tests

- **Tests unitaires** (`tests/logic/`, `npm test`) : la logique pure de `src/logic/`, sous Node. Zone touchée (bandes ou coins), décision de chaque geste (armer, effacer, ouvrir les réglages, annuler), validation des réglages relus sur l'appareil.
- **Tests dans Chrome** (`tests/e2e/`, `npm run test:e2e`) : l'app compilée dans Chrome sans interface, sur un écran de téléphone simulé, avec de vrais événements tactiles. Chaque zone, double tap, appui de 3 s (et ses annulations), délai, réglages enregistrés et relus, réglages abîmés, mode test, fonctionnement serveur arrêté. Aucune dépendance à installer : il faut Google Chrome, trouvé automatiquement (sinon, indiquez son chemin dans `CHROME_PATH`).

Restent à vérifier sur un vrai téléphone : l'écran toujours allumé, le ressenti des gestes et l'installation sur l'écran d'accueil.

Ajouter un fichier dans `src/` impose de l'ajouter à la liste du cache hors-ligne (`src/sw/sw.ts`) : le build échoue en cas d'oubli.

| Dossier | Contenu |
| --- | --- |
| `public/` | `index.html`, manifest et icônes, copiés tels quels |
| `src/app.ts` | Point d'entrée : démarrage et mises à jour automatiques (organisation détaillée en tête du fichier) |
| `src/stage/` | La scène : gestes (`touch.ts`), phases de la boule (`ball.ts`), particules (`dust.ts`) |
| `src/settings/` | Réglages : validation et enregistrement (`store.ts`), panneau de réglages (`panel.ts`) |
| `src/rehearsal/` | Aides à la répétition : test des zones, chrono d'appui, version et journal `?debug` |
| `src/system/` | Services du navigateur : accès au DOM, écran toujours allumé |
| `src/logic/` | Logique pure testée sous Node : zone touchée (bandes ou 4 coins), gestes, validation des réglages |
| `src/sw/sw.ts` | Service worker (cache hors-ligne) |
| `src/styles/` | Styles Sass, compilés en `dist/style.css` |
| `tests/logic/` | Tests unitaires de `src/logic/` (`npm test`) |
| `tests/e2e/` | Tests dans Chrome (`npm run test:e2e`) et pilote de Chrome sans dépendance (`chrome.ts`) |
| `scripts/check-dist.ts` | Vérifie que le build contient tout ce que le service worker met en cache |
| `scripts/stamp-build.ts` | Inscrit le numéro de version et nomme le cache hors-ligne d’après le contenu du build |
| `scripts/serve.ts`, `scripts/static-server.ts` | Serveur local de `dist/` (`npm run serve`), réutilisé par les tests dans Chrome |
| `scripts/deploy.ts` | Push sur `main` avec vérifications et suivi du déploiement (`npm run deploy`) |
