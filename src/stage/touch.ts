/*
 * Gestes sur la scène (doigt, ou souris pour répéter sur ordinateur).
 * Les décisions (armer, effacer, ouvrir les réglages, annuler) sont prises par GestureTracker
 * (logic/gestures.ts, testé sous Node) ; ce module relaie les événements du navigateur
 * et applique les effets : boule, chrono, réglages, journal de diagnostic.
 */

import { GestureTracker, HOLD, isMouseAfterTouch, type PointerId } from '../logic/gestures.ts';
import { zoneIndexForPoint } from '../logic/zone-logic.ts';
import { debugLog } from '../rehearsal/diagnostic.ts';
import { formatSeconds, startHoldTimer, stopHoldTimer } from '../rehearsal/hold-timer.ts';
import { flashZone } from '../rehearsal/test-mode.ts';
import { openSettings } from '../settings/panel.ts';
import { settings } from '../settings/store.ts';
import { stage } from '../system/dom.ts';
import { keepScreenAwake } from '../system/wake-lock.ts';
import { arm, fadeOut, isArmed, isLocked } from './ball.ts';

const gestures = new GestureTracker();
/** Minuterie de l'appui long du contact en cours ; 0 si aucune. */
let holdTimer = 0;
let lastTouchAt = -Infinity;
let touchedSinceShown = false;

/**
 * Un toucher a eu lieu depuis l'ouverture de l'app ou son retour au premier plan.
 * Tant que c'est le cas, une nouvelle version n'est pas chargée automatiquement (app.ts).
 */
export const wasTouchedSinceShown = (): boolean => touchedSinceShown;
export function forgetTouches(): void {
	touchedSinceShown = false;
}

function cancelHold(): void {
	clearTimeout(holdTimer);
	holdTimer = 0;
}

/** Doigt (ou clic) posé. */
function press(id: PointerId, clientX: number, clientY: number, fingers: number): void {
	void keepScreenAwake();
	touchedSinceShown = true;
	cancelHold();

	const now = performance.now();
	const action = gestures.press(id, clientX, clientY, fingers, now, { armed: isArmed(), locked: isLocked() });
	if (action === 'cancel') {
		debugLog(`toucher : ${fingers} doigts, geste annulé`);
		stopHoldTimer('plusieurs doigts : annulé');
		return;
	}

	// Tout doigt posé peut devenir l'appui long qui ouvre les réglages.
	debugLog(`posé (${Math.round(clientX)}, ${Math.round(clientY)}) : réglages dans ${HOLD.settingsMs / 1000} s si le doigt reste posé`);
	holdTimer = window.setTimeout(() => {
		if (gestures.holdCompleted(id)) openSettings();
	}, HOLD.settingsMs);
	startHoldTimer(now, HOLD.settingsMs);

	if (action === 'reset') {
		debugLog('double tap : la boule s\'efface');
		fadeOut();
	} else if (action === 'arm') {
		// Coordonnées relatives à la scène, comme attendu par logic/zone-logic.ts.
		const rect = stage.getBoundingClientRect();
		const index = zoneIndexForPoint(clientX - rect.left, clientY - rect.top, rect.width, rect.height, settings.zones);
		if (index >= 0) {
			arm(index);
			flashZone(index);
		}
	}
}

/** Doigt déplacé : au-delà de la tolérance, l'appui long est abandonné. */
function move(id: PointerId, clientX: number, clientY: number): void {
	const distance = gestures.move(id, clientX, clientY);
	if (distance === null) return;
	cancelHold();
	stopHoldTimer('doigt glissé : annulé');
	debugLog(`glissé de ${Math.round(distance)} px : appui annulé`);
}

/** Doigt levé, ou contact interrompu par le système. */
function release(id: PointerId, interrupted = false): void {
	const contact = gestures.release(id, performance.now(), interrupted);
	if (!contact) return;
	cancelHold();
	const reason = interrupted ? 'INTERROMPU par le système (touchcancel)' : 'levé';
	debugLog(`${reason} après ${(contact.durationMs / 1000).toFixed(1)} s, glissement max ${Math.round(contact.driftPx)} px`);
	if (!contact.moved) stopHoldTimer(interrupted ? 'interrompu par le système' : `relâché à ${formatSeconds(contact.durationMs)}`);
}

/* ---------- Écouteurs ---------- */

// preventDefault empêche le navigateur de simuler des clics souris, de zoomer ou de faire défiler.
stage.addEventListener('touchstart', (e) => {
	e.preventDefault();
	lastTouchAt = performance.now();
	const t = e.changedTouches[0];
	press(t.identifier, t.clientX, t.clientY, e.touches.length);
}, { passive: false });

stage.addEventListener('touchmove', (e) => {
	e.preventDefault();
	for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY);
}, { passive: false });

stage.addEventListener('touchend', (e) => {
	e.preventDefault();
	for (const t of e.changedTouches) release(t.identifier);
}, { passive: false });

stage.addEventListener('touchcancel', (e) => {
	for (const t of e.changedTouches) release(t.identifier, true);
}, { passive: false });

// Souris : pour répéter sur ordinateur.
stage.addEventListener('mousedown', (e) => {
	if (e.button !== 0 || isMouseAfterTouch(lastTouchAt, performance.now())) return;
	press('mouse', e.clientX, e.clientY, 1);
});
window.addEventListener('mousemove', (e) => move('mouse', e.clientX, e.clientY));
window.addEventListener('mouseup', () => release('mouse'));

/* ---------- Comportements du navigateur neutralisés ---------- */

// Pas de menu contextuel, de sélection, de zoom, de rebond ni de pull-to-refresh.
const elementOf = (target: EventTarget | null): Element | null =>
	target instanceof Element ? target : target instanceof Node ? target.parentElement : null;

document.addEventListener('contextmenu', (e) => {
	e.preventDefault();
	debugLog('menu contextuel (appui long système) bloqué');
});
document.addEventListener('selectstart', (e) => {
	// La sélection reste possible dans les champs de saisie des réglages.
	if (!elementOf(e.target)?.closest('input')) e.preventDefault();
});
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
	document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => {
	// Seul le panneau de réglages défile, et d'un seul doigt.
	if (e.touches.length > 1 || !elementOf(e.target)?.closest('.sheet')) e.preventDefault();
}, { passive: false });
