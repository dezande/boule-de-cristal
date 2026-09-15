// Tests du découpage en zones (src/logic/zone-logic.ts).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentIndex, segments, zoneIndexForPoint, zoneRects } from '../../src/logic/zone-logic.ts';

/* ---------- Bandes horizontales (2 ou 3 zones) ---------- */

test('3 bandes : tiers supérieur, central, inférieur', () => {
	const h = 900;
	const band = (y: number): number => zoneIndexForPoint(200, y, 390, h, 3);
	assert.deepEqual([0, 299.9, 300, 599.9, 600, 900].map(band), [0, 0, 1, 1, 2, 2]);
});

test('indépendant de la hauteur d’écran', () => {
	for (const h of [480, 568, 667, 740.5, 812, 844, 852, 926, 932, 1024, 1366]) {
		assert.equal(zoneIndexForPoint(0, h * 0.1, 390, h, 3), 0, `h=${h}`);
		assert.equal(zoneIndexForPoint(0, h * 0.5, 390, h, 3), 1, `h=${h}`);
		assert.equal(zoneIndexForPoint(0, h * 0.9, 390, h, 3), 2, `h=${h}`);
	}
});

test('2 et 3 bandes : la position horizontale ne compte pas', () => {
	for (const x of [-10, 0, 200, 389, 500]) {
		assert.equal(zoneIndexForPoint(x, 100, 390, 900, 3), 0);
		assert.equal(zoneIndexForPoint(x, 450, 390, 900, 3), 1);
		assert.equal(zoneIndexForPoint(x, 800, 390, 900, 2), 1);
	}
});

/* ---------- 4 coins ---------- */

test('4 zones : les 4 coins', () => {
	const w = 390;
	const h = 844;
	assert.equal(zoneIndexForPoint(10, 10, w, h, 4), 0);
	assert.equal(zoneIndexForPoint(380, 10, w, h, 4), 1);
	assert.equal(zoneIndexForPoint(10, 834, w, h, 4), 2);
	assert.equal(zoneIndexForPoint(380, 834, w, h, 4), 3);
	// Juste avant et juste sur le centre de l'écran.
	assert.equal(zoneIndexForPoint(194.9, 421.9, w, h, 4), 0);
	assert.equal(zoneIndexForPoint(195, 422, w, h, 4), 3);
});

/* ---------- Découpage d'un axe ---------- */

test('coordonnées hors surface ramenées au tronçon le plus proche', () => {
	assert.equal(segmentIndex(-40, 800, 3), 0);
	assert.equal(segmentIndex(830, 800, 3), 2);
	assert.equal(zoneIndexForPoint(-20, 900, 390, 844, 4), 2);
});

test('segments est cohérent avec segmentIndex', () => {
	for (const length of [375, 667, 844, 931]) {
		for (const count of [1, 2, 3, 4]) {
			const parts = segments(length, count);
			assert.equal(parts.length, count);
			assert.equal(parts[0].start, 0);
			assert.equal(parts[count - 1].end, length);
			for (const p of parts) {
				assert.equal(segmentIndex(p.start + 0.01, length, count), p.index);
				assert.equal(segmentIndex(p.end - 0.01, length, count), p.index);
			}
		}
	}
});

/* ---------- Rectangles du mode test ---------- */

test('zoneRects est cohérent avec zoneIndexForPoint', () => {
	for (const [w, h] of [[375, 667], [390, 844], [1024, 1366]]) {
		for (const count of [2, 3, 4]) {
			const rects = zoneRects(w, h, count);
			assert.equal(rects.length, count);
			assert.deepEqual(rects.map((r) => r.index), [...Array(count).keys()]);
			for (const r of rects) {
				assert.equal(zoneIndexForPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2, w, h, count), r.index);
				assert.equal(zoneIndexForPoint(r.left + 0.01, r.top + 0.01, w, h, count), r.index);
				assert.equal(zoneIndexForPoint(r.right - 0.01, r.bottom - 0.01, w, h, count), r.index);
			}
		}
	}
});

/* ---------- Entrées invalides ---------- */

test('entrées invalides', () => {
	assert.equal(segmentIndex(10, 0, 3), -1);
	assert.equal(segmentIndex(10, -5, 3), -1);
	assert.equal(segmentIndex(NaN, 800, 3), -1);
	assert.equal(segmentIndex(10, 800, 0), -1);
	assert.equal(segmentIndex(10, 800, 2.5), -1);
	assert.equal(segments(0, 3).length, 0);
	assert.equal(zoneIndexForPoint(NaN, 10, 390, 844, 4), -1);
	assert.equal(zoneIndexForPoint(10, 10, 390, 844, 0), -1);
	assert.equal(zoneRects(0, 800, 4).length, 0);
	assert.equal(zoneRects(390, 800, 0).length, 0);
});
