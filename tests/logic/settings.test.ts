// Tests de la validation des réglages (src/logic/settings.ts).
// Les réglages relus sur un téléphone peuvent venir d'une ancienne version de l'app ou être abîmés :
// l'app doit toujours démarrer avec des réglages utilisables.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, ROUTINE_IDS, ROUTINES, routineValues, sanitizeSettings, zoneCount } from '../../src/logic/settings.ts';

const defaults = { ...DEFAULTS };

/* ---------- Données absentes ou illisibles ---------- */

test('rien d’enregistré, ou pas un objet : réglages par défaut', () => {
	for (const raw of [null, undefined, 42, 'réglages', true, [], [1, 2]]) {
		assert.deepEqual(sanitizeSettings(raw), defaults, JSON.stringify(raw));
	}
});

test('réglages valides conservés tels quels', () => {
	const valid = { routine: 'arcane-systeme', delay: 2.5, fade: 0.8, brightness: 45, showHoldRing: false };
	assert.deepEqual(sanitizeSettings(valid), valid);
});

test('ancienne version sans l’option d’affichage : la jauge est visible par défaut', () => {
	const old = sanitizeSettings({ routine: 'arcane-systeme', delay: 1, fade: 2, brightness: 80 });
	assert.equal(old.routine, 'arcane-systeme');
	assert.equal(old.showHoldRing, true);
});

test('ancienne version avec nombre de zones et valeurs : ignorés, routine par défaut, autres réglages conservés', () => {
	const old = sanitizeSettings({ zones: 4, values: ['1', '1', '1', '1'], delay: 1, fade: 2, brightness: 80, showHoldRing: false });
	assert.deepEqual(old, { routine: DEFAULTS.routine, delay: 1, fade: 2, brightness: 80, showHoldRing: false });
});

test('options supprimées d’une ancienne version : ignorées', () => {
	const old = sanitizeSettings({ showVersion: false, showHoldTimer: false, showMenuZone: false });
	assert.deepEqual(Object.keys(old).filter((key) => key.startsWith('show')), ['showHoldRing']);
	assert.equal(old.showHoldRing, true);
});

/* ---------- Routines ---------- */

test('routines : Dany Daortiz en 3 bandes (6, 16, 26), Arcane Système en 4 coins (17, 19, 21, 23)', () => {
	const dany = sanitizeSettings({ routine: 'dany-daortiz' });
	assert.equal(zoneCount(dany), 3);
	assert.deepEqual(routineValues(dany), ['6', '16', '26']);
	const arcane = sanitizeSettings({ routine: 'arcane-systeme' });
	assert.equal(zoneCount(arcane), 4);
	assert.deepEqual(routineValues(arcane), ['17', '19', '21', '23']);
});

test('chaque routine a exactement une valeur par zone', () => {
	for (const id of ROUTINE_IDS) assert.equal(ROUTINES[id].values.length, ROUTINES[id].zones, id);
});

test('routine par défaut : Dany Daortiz', () => {
	assert.equal(DEFAULTS.routine, 'dany-daortiz');
});

test('routine inconnue ou d’un mauvais type : routine par défaut', () => {
	for (const routine of ['', 'arcane', 'toString', '__proto__', 3, null, {}]) {
		assert.equal(sanitizeSettings({ routine }).routine, DEFAULTS.routine, String(routine));
	}
});

/* ---------- Curseurs ---------- */

test('délai : borné entre 0 et 10 s, arrondi à la demi-seconde', () => {
	const delay = (v: unknown): number => sanitizeSettings({ delay: v }).delay;
	assert.deepEqual([-3, 0, 2.2, 2.3, 7.75, 10, 60].map(delay), [0, 0, 2, 2.5, 8, 10, 10]);
});

test('fondu : borné entre 0,5 et 6 s, arrondi au dixième', () => {
	const fade = (v: unknown): number => sanitizeSettings({ fade: v }).fade;
	assert.deepEqual([0, 0.5, 1.234, 1.25, 6, 9].map(fade), [0.5, 0.5, 1.2, 1.3, 6, 6]);
});

test('luminosité : bornée entre 30 et 100 %, arrondie à l’entier', () => {
	const brightness = (v: unknown): number => sanitizeSettings({ brightness: v }).brightness;
	assert.deepEqual([0, 30, 55.4, 55.6, 100, 150].map(brightness), [30, 30, 55, 56, 100, 100]);
});

test('curseurs qui ne sont pas des nombres finis : valeur par défaut', () => {
	for (const v of ['3', null, NaN, Infinity, -Infinity, true, {}]) {
		const s = sanitizeSettings({ delay: v, fade: v, brightness: v });
		assert.deepEqual([s.delay, s.fade, s.brightness], [DEFAULTS.delay, DEFAULTS.fade, DEFAULTS.brightness], String(v));
	}
});

/* ---------- Option d'affichage ---------- */

test('jauge de l’appui long : seulement de vrais booléens', () => {
	assert.equal(sanitizeSettings({ showHoldRing: false }).showHoldRing, false);
	for (const v of ['false', 0, null, 'non']) assert.equal(sanitizeSettings({ showHoldRing: v }).showHoldRing, true, String(v));
});

/* ---------- Propriétés générales ---------- */

test('valider deux fois ne change rien', () => {
	for (const raw of [null, { routine: 'x', delay: 3.3, fade: 'x', brightness: 12 }, { routine: 'arcane-systeme', delay: 11 }]) {
		const once = sanitizeSettings(raw);
		assert.deepEqual(sanitizeSettings(once), once);
	}
});

test('les réglages renvoyés sont une copie : les modifier ne touche pas aux valeurs par défaut', () => {
	const s = sanitizeSettings(null);
	s.routine = 'arcane-systeme';
	s.delay = 9;
	assert.equal(DEFAULTS.routine, 'dany-daortiz');
	assert.deepEqual(sanitizeSettings(null), defaults);
});

test('champs inconnus ignorés', () => {
	assert.deepEqual(Object.keys(sanitizeSettings({ extra: 1, zones: 2, values: ['1'] })).sort(), Object.keys(DEFAULTS).sort());
});
