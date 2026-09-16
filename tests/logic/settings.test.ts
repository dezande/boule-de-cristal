// Tests de la validation des réglages (src/logic/settings.ts).
// Les réglages relus sur un téléphone peuvent venir d'une ancienne version de l'app ou être abîmés :
// l'app doit toujours démarrer avec des réglages utilisables.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, MAX_VALUE_LENGTH, sanitizeSettings } from '../../src/logic/settings.ts';

const defaults = { ...DEFAULTS, values: [...DEFAULTS.values] };

/* ---------- Données absentes ou illisibles ---------- */

test('rien d’enregistré, ou pas un objet : réglages par défaut', () => {
	for (const raw of [null, undefined, 42, 'réglages', true, [], [1, 2]]) {
		assert.deepEqual(sanitizeSettings(raw), defaults, JSON.stringify(raw));
	}
});

test('réglages valides conservés tels quels', () => {
	const valid = { zones: 4, values: ['1', '22', '333', '4444'], delay: 2.5, fade: 0.8, brightness: 45, showHoldRing: false };
	assert.deepEqual(sanitizeSettings(valid), valid);
});

test('ancienne version sans l’option d’affichage : la jauge est visible par défaut', () => {
	const old = sanitizeSettings({ zones: 2, values: ['7', '8'], delay: 1, fade: 2, brightness: 80 });
	assert.equal(old.zones, 2);
	assert.deepEqual(old.values, ['7', '8', '26', '36']);
	assert.equal(old.showHoldRing, true);
});

test('options supprimées d’une ancienne version : ignorées', () => {
	const old = sanitizeSettings({ showVersion: false, showHoldTimer: false, showMenuZone: false });
	assert.deepEqual(Object.keys(old).filter((key) => key.startsWith('show')), ['showHoldRing']);
	assert.equal(old.showHoldRing, true);
});

/* ---------- Nombre de zones ---------- */

test('nombre de zones : seulement 2, 3 ou 4', () => {
	for (const zones of [2, 3, 4] as const) assert.equal(sanitizeSettings({ zones }).zones, zones);
	for (const zones of [0, 1, 5, 2.5, '4', null, NaN]) assert.equal(sanitizeSettings({ zones }).zones, DEFAULTS.zones, String(zones));
});

/* ---------- Valeurs ---------- */

test('valeurs : espaces retirés, longueur limitée, nombres acceptés', () => {
	const { values } = sanitizeSettings({ values: ['  12 ', '1234567890', 99, ''] });
	assert.deepEqual(values, ['12', '1234567890'.slice(0, MAX_VALUE_LENGTH), '99', DEFAULTS.values[3]]);
});

test('valeurs vides, manquantes ou d’un mauvais type : valeur par défaut de la zone', () => {
	assert.deepEqual(sanitizeSettings({ values: ['   ', null, { v: 1 }] }).values, defaults.values);
	assert.deepEqual(sanitizeSettings({ values: '6,16,26' }).values, defaults.values);
});

test('toujours 4 valeurs : les valeurs en trop sont ignorées', () => {
	assert.deepEqual(sanitizeSettings({ values: ['1', '2', '3', '4', '5', '6'] }).values, ['1', '2', '3', '4']);
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
	for (const raw of [null, { zones: 9, values: [' 5 ', 12], delay: 3.3, fade: 'x', brightness: 12 }, { zones: 4, delay: 11 }]) {
		const once = sanitizeSettings(raw);
		assert.deepEqual(sanitizeSettings(once), once);
	}
});

test('les réglages renvoyés sont une copie : les modifier ne touche pas aux valeurs par défaut', () => {
	const s = sanitizeSettings(null);
	s.values[0] = '999';
	s.delay = 9;
	assert.equal(DEFAULTS.values[0], '6');
	assert.deepEqual(sanitizeSettings(null), defaults);
});

test('champs inconnus ignorés', () => {
	assert.deepEqual(Object.keys(sanitizeSettings({ extra: 1, zones: 2 })).sort(), Object.keys(DEFAULTS).sort());
});
