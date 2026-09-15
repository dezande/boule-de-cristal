/*
 * Boule de cristal : point d'entrée de l'app.
 *
 * Déroulé d'un tour :
 *   1. le magicien touche discrètement une zone de l'écran (bande ou coin) ;
 *   2. la valeur de cette zone est « armée » : la brume s'agite pendant le délai réglé ;
 *   3. le nombre apparaît dans la boule, l'écran reste verrouillé (plus aucun toucher n'arme) ;
 *   4. un double tap efface le nombre, l'app se réarme pour le tour suivant.
 * Un appui de 3 s n'importe où ouvre les réglages, à tout moment.
 *
 * Organisation de src/ :
 *   app.ts       ce fichier : démarrage et mises à jour automatiques
 *   stage/       la scène vue par le public
 *     touch.ts     gestes : toucher d'une zone, double tap, appui long
 *     ball.ts      phases de la boule : armé, affiché, effacé
 *     dust.ts      particules dorées
 *   settings/    réglages
 *     store.ts     réglages en cours, enregistrement sur l'appareil
 *     panel.ts     panneau de réglages
 *   rehearsal/   aides à la répétition, à masquer avant de jouer
 *     test-mode.ts   mode « Test des zones »
 *     hold-timer.ts  chrono d'appui
 *     diagnostic.ts  version du build et journal ?debug
 *   system/      services du navigateur
 *     dom.ts         accès au DOM et scène
 *   kit/         code commun des accessoires de scène (sous-module kit-scene, voir son README) :
 *                écran allumé, portrait, hors-ligne et mises à jour, version
 *   logic/       logique pure, sans DOM, testée sous Node (tests/logic/)
 *     zone-logic.ts  zone touchée (bandes ou 4 coins)
 *     gestures.ts    décision de chaque geste : armer, effacer, ouvrir les réglages, annuler
 *     settings.ts    forme et validation des réglages
 *   sw/          compilation du service worker du kit (kit/sw/sw.ts)
 *   styles/      styles Sass
 *
 * Importer un module installe ses écouteurs : ce fichier ne fait que le démarrage.
 */

// En premier : la rotation (verrou portrait) est calculée avant que les autres modules mesurent l'écran.
import './kit/web/orientation.ts';
import { setupUpdates } from './kit/web/updates.ts';
import { keepScreenAwake } from './kit/web/wake-lock.ts';
import { BUILD, debugLog } from './rehearsal/diagnostic.ts';
import { applySettings, isSettingsOpen } from './settings/panel.ts';
import { getPhase } from './stage/ball.ts';
import { spawnDust } from './stage/dust.ts';
import { forgetTouches, wasTouchedSinceShown } from './stage/touch.ts';
import { $ } from './system/dom.ts';

$('#version-badge').textContent = `v${BUILD.version} · ${BUILD.commit}`;
applySettings();
spawnDust(18);
void keepScreenAwake();

/* ---------- Mises à jour ---------- */

/** Aucun tour en cours ni réglages ouverts. */
const isIdle = (): boolean => getPhase() === 'idle' && !isSettingsOpen();

// Nouvelle version installée : rechargement seulement si personne n'a touché l'écran depuis
// l'ouverture (ou le retour au premier plan) et hors tour ; sinon à l'ouverture suivante.
setupUpdates({
	canReload: () => !wasTouchedSinceShown() && isIdle(),
	// Retour au premier plan hors tour : une mise à jour éventuelle pourra s'appliquer.
	onVisible: () => {
		if (isIdle()) forgetTouches();
	},
	log: debugLog,
});
