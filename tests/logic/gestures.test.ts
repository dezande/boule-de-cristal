// Tests des gestes (src/logic/gestures.ts), avec des rythmes de vrais doigts.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOUBLE_TAP, GestureTracker, HOLD, MOUSE_AFTER_TOUCH_MS, completesResetDoubleTap, isMouseAfterTouch, type StageState, type TapRecord } from '../../src/logic/gestures.ts';

/* ================= Double tap (règle seule) ================= */

const tapAt = (end: number, durationMs = 120, whileArmed = true, moved = false): TapRecord => ({ end, durationMs, moved, whileArmed });

test('double tap rapide avec un nombre armé', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000), 1150, true), true);
});

test('double tap d’un doigt peu assuré : taps appuyés et courte hésitation', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000, 450), 1600, true), true);
	assert.equal(completesResetDoubleTap(tapAt(1000, DOUBLE_TAP.maxTapMs), 1000 + DOUBLE_TAP.maxGapMs, true), true);
});

test('pause trop longue entre les deux taps', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000), 1000 + DOUBLE_TAP.maxGapMs + 50, true), false);
});

test('premier contact trop long (appui, pas un tap)', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000, 900), 1200, true), false);
});

test('premier contact qui a glissé', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000, 120, true, true), 1200, true), false);
});

test('le tap qui arme le nombre ne compte pas : taper deux fois vite pour armer n’efface rien', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000, 120, false), 1200, true), false);
});

test('aucun nombre armé : pas de réinitialisation', () => {
	assert.equal(completesResetDoubleTap(tapAt(1000), 1200, false), false);
	assert.equal(completesResetDoubleTap(null, 1200, true), false);
});

/* ================= Suivi des contacts (GestureTracker) ================= */

const IDLE: StageState = { armed: false, locked: false };
/** Nombre armé ou affiché. */
const ARMED: StageState = { armed: true, locked: true };
/** Fondu de sortie en cours : verrouillé, mais plus rien d'armé. */
const CLEARING: StageState = { armed: false, locked: true };

/** Tap d'un doigt : posé à `at`, levé `duration` ms plus tard. Renvoie l'action décidée à la pose. */
function tap(g: GestureTracker, at: number, stage: StageState, duration = 100, id = 1) {
	const action = g.press(id, 100, 100, 1, at, stage);
	g.release(id, at + duration);
	return action;
}

test('app au repos : un toucher arme la zone', () => {
	assert.equal(tap(new GestureTracker(), 0, IDLE), 'arm');
});

test('tour en cours : un toucher simple n’arme rien', () => {
	assert.equal(tap(new GestureTracker(), 0, ARMED), 'none');
	assert.equal(tap(new GestureTracker(), 0, CLEARING), 'none');
});

test('un tour complet : armer, double tap pour effacer, réarmer', () => {
	const g = new GestureTracker();
	assert.equal(tap(g, 0, IDLE), 'arm');
	// Nombre affiché : le magicien fait un double tap quelques secondes plus tard.
	assert.equal(tap(g, 5000, ARMED), 'none');
	assert.equal(tap(g, 5250, ARMED), 'reset');
	// Fondu terminé : l'app est de nouveau au repos.
	assert.equal(tap(g, 8000, IDLE), 'arm');
});

test('deux taps rapides pour armer n’effacent pas le nombre', () => {
	const g = new GestureTracker();
	assert.equal(tap(g, 0, IDLE), 'arm');
	assert.equal(tap(g, 200, ARMED), 'none');
});

test('trois taps rapides : un seul effacement', () => {
	const g = new GestureTracker();
	assert.equal(tap(g, 0, ARMED), 'none');
	assert.equal(tap(g, 200, ARMED), 'reset');
	assert.equal(tap(g, 400, CLEARING), 'none');
	assert.equal(tap(g, 600, CLEARING), 'none');
});

test('double tap trop lent : pas d’effacement', () => {
	const g = new GestureTracker();
	tap(g, 0, ARMED);
	assert.equal(tap(g, 100 + DOUBLE_TAP.maxGapMs + 1, ARMED), 'none');
});

test('premier tap qui a glissé : pas de double tap', () => {
	const g = new GestureTracker();
	g.press(1, 100, 100, 1, 0, ARMED);
	g.move(1, 100 + HOLD.slopPx + 1, 100);
	g.release(1, 100);
	assert.equal(tap(g, 200, ARMED), 'none');
});

test('premier contact interrompu par le système : pas de double tap', () => {
	const g = new GestureTracker();
	g.press(1, 100, 100, 1, 0, ARMED);
	g.release(1, 100, true);
	assert.equal(tap(g, 200, ARMED), 'none');
});

test('plusieurs doigts : geste annulé, et le tap précédent est oublié', () => {
	const g = new GestureTracker();
	tap(g, 0, ARMED);
	assert.equal(g.press(2, 50, 50, 2, 150, ARMED), 'cancel');
	assert.equal(g.holdCompleted(2), false);
	assert.equal(tap(g, 300, ARMED), 'none');
});

test('plusieurs doigts au repos : rien n’est armé', () => {
	assert.equal(new GestureTracker().press(1, 0, 0, 2, 0, IDLE), 'cancel');
});

/* ---------- Appui long ---------- */

test('appui long : ouvre les réglages si le doigt reste posé, même pendant un tour', () => {
	for (const stage of [IDLE, ARMED, CLEARING]) {
		const g = new GestureTracker();
		g.press(1, 100, 100, 1, 0, stage);
		assert.equal(g.holdCompleted(1), true);
	}
});

test('appui long : un petit tremblement du doigt est toléré', () => {
	const g = new GestureTracker();
	g.press(1, 100, 100, 1, 0, IDLE);
	assert.equal(g.move(1, 100 + HOLD.slopPx, 100), null);
	assert.equal(g.move(1, 120, 125), null);
	assert.equal(g.holdCompleted(1), true);
});

test('appui long : annulé si le doigt glisse au-delà de la tolérance', () => {
	const g = new GestureTracker();
	g.press(1, 100, 100, 1, 0, IDLE);
	const distance = g.move(1, 130, 140);
	assert.equal(distance, 50);
	assert.equal(g.holdCompleted(1), false);
	// Le glissement n'est signalé qu'une fois, et revenir au point de départ ne rétablit pas l'appui.
	assert.equal(g.move(1, 200, 200), null);
	assert.equal(g.move(1, 100, 100), null);
	assert.equal(g.holdCompleted(1), false);
});

test('appui long : annulé si le doigt est levé ou si un autre doigt se pose', () => {
	const lifted = new GestureTracker();
	lifted.press(1, 100, 100, 1, 0, IDLE);
	lifted.release(1, 2000);
	assert.equal(lifted.holdCompleted(1), false);

	const replaced = new GestureTracker();
	replaced.press(1, 100, 100, 1, 0, IDLE);
	replaced.press(2, 200, 200, 1, 1000, ARMED);
	assert.equal(replaced.holdCompleted(1), false);
	assert.equal(replaced.holdCompleted(2), true);
});

/* ---------- Doigts inconnus et bilan ---------- */

test('mouvements et levers d’un doigt non suivi : ignorés', () => {
	const g = new GestureTracker();
	assert.equal(g.move(7, 500, 500), null);
	assert.equal(g.release(7, 100), null);
	g.press(1, 100, 100, 1, 0, IDLE);
	assert.equal(g.move(7, 500, 500), null);
	assert.equal(g.release(7, 100), null);
	assert.equal(g.holdCompleted(1), true);
});

test('bilan du contact : durée, glissement maximal, glissé ou non', () => {
	const g = new GestureTracker();
	g.press('mouse', 10, 10, 1, 1000, IDLE);
	g.move('mouse', 30, 10);
	g.move('mouse', 15, 10);
	assert.deepEqual(g.release('mouse', 1800), { durationMs: 800, driftPx: 20, moved: false });
});

/* ---------- Souris ---------- */

test('souris : ignorée juste après un vrai toucher', () => {
	assert.equal(isMouseAfterTouch(1000, 1300), true);
	assert.equal(isMouseAfterTouch(1000, 1000 + MOUSE_AFTER_TOUCH_MS), false);
	assert.equal(isMouseAfterTouch(-Infinity, 50), false);
});
