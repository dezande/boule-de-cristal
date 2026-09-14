// Tests du geste secret (src/secret-gesture.ts), avec des rythmes de vrais doigts.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_GESTURE, SECRET_GESTURE, pressBase, releaseBase, type SecretGestureState } from '../src/secret-gesture.ts';

type Contact = { pause: number; duration: number; moved?: boolean };

/**
 * Rejoue une suite de contacts sur le socle : chacun commence `pause` ms après la fin du précédent
 * et dure `duration` ms. Renvoie true si le dernier contact ouvre les réglages.
 */
function opensSettings(contacts: Contact[]): boolean {
	let state: SecretGestureState = IDLE_GESTURE;
	let clock = 10_000;
	let opened = false;
	for (const { pause, duration, moved = false } of contacts) {
		clock += pause;
		const press = pressBase(state, clock);
		state = press.state;
		opened = press.armsHold && duration >= SECRET_GESTURE.holdMs && !moved;
		if (opened) return true;
		clock += duration;
		state = releaseBase(state, clock, duration, moved);
	}
	return opened;
}

const tap = (pause: number, duration = 150): Contact => ({ pause, duration });
const hold = (pause: number, duration = 1200): Contact => ({ pause, duration });

test('3 tapotements puis appui maintenu', () => {
	assert.equal(opensSettings([tap(0), tap(250), tap(250), hold(300)]), true);
});

test('2 tapotements puis appui maintenu (le 3e contact est l’appui)', () => {
	assert.equal(opensSettings([tap(0), tap(300), hold(300)]), true);
});

test('taps appuyés d’un doigt peu assuré (jusqu’à 0,6 s)', () => {
	assert.equal(opensSettings([tap(0, 450), tap(400, 550), tap(500, 600), hold(400)]), true);
});

test('hésitation d’une seconde avant l’appui maintenu', () => {
	assert.equal(opensSettings([tap(0), tap(700), tap(900), hold(1000)]), true);
});

test('rythme irrégulier et appui juste assez long', () => {
	assert.equal(opensSettings([tap(0, 90), tap(1200, 500), hold(1400, SECRET_GESTURE.holdMs)]), true);
});

test('un seul tap puis appui : pas d’ouverture', () => {
	assert.equal(opensSettings([tap(0), hold(300)]), false);
});

test('appui maintenu seul : pas d’ouverture', () => {
	assert.equal(opensSettings([hold(0, 3000)]), false);
});

test('pause trop longue : la séquence repart de zéro', () => {
	assert.equal(opensSettings([tap(0), tap(300), hold(SECRET_GESTURE.gapMs + 200)]), false);
});

test('appui relâché trop tôt : pas d’ouverture', () => {
	assert.equal(opensSettings([tap(0), tap(300), hold(300, 700)]), false);
});

test('doigt qui glisse franchement : la séquence est annulée', () => {
	assert.equal(opensSettings([tap(0), { pause: 300, duration: 150, moved: true }, hold(300)]), false);
	assert.equal(opensSettings([tap(0), tap(300), { pause: 300, duration: 1200, moved: true }]), false);
});

test('contact long au milieu : la séquence repart de zéro', () => {
	assert.equal(opensSettings([tap(0), { pause: 300, duration: 800 }, hold(300)]), false);
	assert.equal(opensSettings([tap(0), { pause: 300, duration: 800 }, tap(300), tap(300), hold(300)]), true);
});
