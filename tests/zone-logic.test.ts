// Tests de la logique de découpage en zones (src/zone-logic.ts).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneIndexForY, valueForY, zoneBounds, zoneIndexForPoint, zoneRects } from '../src/zone-logic.ts';

const VALUES = ['6', '16', '26'] as const;

test('tiers supérieur, central, inférieur', () => {
	const h = 900;
	assert.equal(valueForY(0, h, VALUES), '6');
	assert.equal(valueForY(299.9, h, VALUES), '6');
	assert.equal(valueForY(300, h, VALUES), '16');
	assert.equal(valueForY(599.9, h, VALUES), '16');
	assert.equal(valueForY(600, h, VALUES), '26');
	assert.equal(valueForY(900, h, VALUES), '26');
});

test('indépendant de la hauteur d’écran', () => {
	for (const h of [480, 568, 667, 740.5, 812, 844, 852, 926, 932, 1024, 1366]) {
		assert.equal(valueForY(h * 0.1, h, VALUES), '6', `h=${h}`);
		assert.equal(valueForY(h * 0.5, h, VALUES), '16', `h=${h}`);
		assert.equal(valueForY(h * 0.9, h, VALUES), '26', `h=${h}`);
	}
});

test('coordonnées hors surface ramenées à la bande la plus proche', () => {
	assert.equal(valueForY(-40, 800, VALUES), '6');
	assert.equal(valueForY(830, 800, VALUES), '26');
});

test('2, 3 ou 4 bandes', () => {
	assert.deepEqual([0, 399, 400, 799].map((y) => zoneIndexForY(y, 800, 2)), [0, 0, 1, 1]);
	assert.deepEqual([0, 199, 200, 399, 400, 599, 600, 800].map((y) => zoneIndexForY(y, 800, 4)), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test('zoneBounds est cohérent avec zoneIndexForY', () => {
	for (const h of [667, 844, 931]) {
		for (const count of [2, 3, 4]) {
			const bounds = zoneBounds(h, count);
			assert.equal(bounds.length, count);
			assert.equal(bounds[0].top, 0);
			assert.equal(bounds[count - 1].bottom, h);
			for (const b of bounds) {
				assert.equal(zoneIndexForY((b.top + b.bottom) / 2, h, count), b.index);
				assert.equal(zoneIndexForY(b.top + 0.01, h, count), b.index);
				assert.equal(zoneIndexForY(b.bottom - 0.01, h, count), b.index);
			}
		}
	}
});

test('entrées invalides', () => {
	assert.equal(zoneIndexForY(10, 0, 3), -1);
	assert.equal(zoneIndexForY(10, -5, 3), -1);
	assert.equal(zoneIndexForY(NaN, 800, 3), -1);
	assert.equal(zoneIndexForY(10, 800, 0), -1);
	assert.equal(zoneIndexForY(10, 800, 2.5), -1);
	assert.equal(valueForY(10, 800, []), null);
	assert.equal(zoneBounds(0, 3).length, 0);
});


test('4 zones : les 4 coins', () => {
	const w = 390;
	const h = 844;
	assert.equal(zoneIndexForPoint(10, 10, w, h, 4), 0);
	assert.equal(zoneIndexForPoint(380, 10, w, h, 4), 1);
	assert.equal(zoneIndexForPoint(10, 834, w, h, 4), 2);
	assert.equal(zoneIndexForPoint(380, 834, w, h, 4), 3);
	assert.equal(zoneIndexForPoint(194.9, 421.9, w, h, 4), 0);
	assert.equal(zoneIndexForPoint(195, 422, w, h, 4), 3);
	assert.equal(zoneIndexForPoint(-20, 900, w, h, 4), 2);
});

test('2 et 3 zones restent des bandes, quelle que soit la position horizontale', () => {
	for (const x of [0, 200, 389]) {
		assert.equal(zoneIndexForPoint(x, 100, 390, 900, 3), 0);
		assert.equal(zoneIndexForPoint(x, 450, 390, 900, 3), 1);
		assert.equal(zoneIndexForPoint(x, 800, 390, 900, 2), 1);
	}
});

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
	assert.equal(zoneRects(0, 800, 4).length, 0);
	assert.equal(zoneIndexForPoint(NaN, 10, 390, 844, 4), -1);
	assert.equal(zoneIndexForPoint(10, 10, 390, 844, 0), -1);
});
