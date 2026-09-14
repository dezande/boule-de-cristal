// Tests du double tap de réinitialisation (src/gestures.ts), avec des rythmes de vrais doigts.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOUBLE_TAP, completesResetDoubleTap, type TapRecord } from '../src/gestures.ts';

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
