/*
 * Gestes sur la scène (doigt, ou souris pour répéter sur ordinateur).
 * Les décisions (armer, effacer, ouvrir les réglages, annuler) sont prises par GestureTracker
 * (logic/gestures.ts, testé sous Node) ; ce module relaie les événements du navigateur
 * et applique les effets : boule, jauge de l'appui long, réglages.
 */

import { appPoint } from '../kit/web/orientation.ts';
import { keepScreenAwake } from '../kit/web/wake-lock.ts';
import { GestureTracker, HOLD, isMouseAfterTouch, type PointerId } from '../logic/gestures.ts';
import { zoneIndexForPoint } from '../logic/zone-logic.ts';
import { hideHoldRing, showHoldRing } from '../rehearsal/hold-ring.ts';
import { flashZone } from '../rehearsal/test-mode.ts';
import { openSettings } from '../settings/panel.ts';
import { settings } from '../settings/store.ts';
import { stage } from '../system/dom.ts';
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
		hideHoldRing();
		return;
	}

	// Coordonnées dans le repère de la scène, qui peut être pivotée (kit/web/orientation.ts),
	// comme attendu par logic/zone-logic.ts : « haut » reste le haut du téléphone.
	const point = appPoint(clientX, clientY);

	// Tout doigt posé peut devenir l'appui long qui ouvre les réglages.
	holdTimer = window.setTimeout(() => {
		if (gestures.holdCompleted(id)) openSettings();
	}, HOLD.settingsMs);
	showHoldRing(point.x, point.y, HOLD.settingsMs);

	if (action === 'reset') {
		fadeOut();
	} else if (action === 'arm') {
		const index = zoneIndexForPoint(point.x, point.y, stage.clientWidth, stage.clientHeight, settings.zones);
		if (index >= 0) {
			arm(index);
			flashZone(index);
		}
	}
}

/** Doigt déplacé : au-delà de la tolérance, l'appui long est abandonné. */
function move(id: PointerId, clientX: number, clientY: number): void {
	if (gestures.move(id, clientX, clientY) === null) return;
	cancelHold();
	hideHoldRing();
}

/** Doigt levé, ou contact interrompu par le système. */
function release(id: PointerId, interrupted = false): void {
	if (!gestures.release(id, performance.now(), interrupted)) return;
	cancelHold();
	hideHoldRing();
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

document.addEventListener('contextmenu', (e) => e.preventDefault());
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
