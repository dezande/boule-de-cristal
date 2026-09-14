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

Après toute modification d'un fichier, incrémentez `CACHE` dans `sw.js` pour que les appareils déjà installés récupèrent la nouvelle version.

## Développement

```sh
python3 -m http.server 8000      # puis http://localhost:8000
node --test "tests/**/*.test.mjs" # tests de la logique de découpage en zones
```

La logique « coordonnée Y → valeur » se trouve dans `index.html`, entre les marqueurs `ZONE-LOGIC:BEGIN` et `ZONE-LOGIC:END`. Les tests exécutent exactement ce code.
