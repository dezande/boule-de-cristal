/*
 * Découpage de la surface tactile en zones : bandes horizontales, ou 4 coins.
 * Fonctions pures : aucune dépendance au DOM, testées sous Node (tests/zone-logic.test.ts).
 * Toutes les coordonnées sont relatives à la surface (0 = bord haut de la surface).
 */

export interface ZoneBound {
	index: number;
	top: number;
	bottom: number;
}

/** Indice (0 = haut) de la bande contenant y, ou -1 si les paramètres sont invalides. */
export function zoneIndexForY(y: number, height: number, count: number): number {
	if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return -1;
	if (!Number.isInteger(count) || count < 1) return -1;
	const i = Math.floor((y * count) / height);
	return i < 0 ? 0 : i >= count ? count - 1 : i;
}

/** Valeur associée à y ; une valeur par bande, de haut en bas. null si invalide. */
export function valueForY<T>(y: number, height: number, values: readonly T[]): T | null {
	const i = zoneIndexForY(y, height, values.length);
	return i < 0 ? null : values[i];
}

/** Limites [top, bottom) de chaque bande, en unités de la surface. */
export function zoneBounds(height: number, count: number): ZoneBound[] {
	if (!Number.isFinite(height) || height <= 0 || !Number.isInteger(count) || count < 1) return [];
	const bounds: ZoneBound[] = [];
	for (let i = 0; i < count; i++) {
		bounds.push({ index: i, top: (height * i) / count, bottom: (height * (i + 1)) / count });
	}
	return bounds;
}

/*
 * Grille complète : 2 ou 3 zones restent des bandes horizontales,
 * 4 zones deviennent les 4 coins (2 colonnes × 2 lignes).
 * Indices en lecture : haut gauche, haut droite, bas gauche, bas droite.
 */

export interface ZoneRect {
	index: number;
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Colonnes et lignes de la grille pour un nombre de zones. */
export function gridFor(count: number): { cols: number; rows: number } {
	return count === 4 ? { cols: 2, rows: 2 } : { cols: 1, rows: count };
}

/** Indice de la zone contenant (x, y), ou -1 si les paramètres sont invalides. */
export function zoneIndexForPoint(x: number, y: number, width: number, height: number, count: number): number {
	if (!Number.isInteger(count) || count < 1) return -1;
	const { cols, rows } = gridFor(count);
	const row = zoneIndexForY(y, height, rows);
	const col = cols === 1 ? 0 : zoneIndexForY(x, width, cols);
	return row < 0 || col < 0 ? -1 : row * cols + col;
}

/** Rectangles [left, right) × [top, bottom) de chaque zone, en unités de la surface. */
export function zoneRects(width: number, height: number, count: number): ZoneRect[] {
	if (!Number.isFinite(width) || width <= 0) return [];
	const { cols, rows } = gridFor(count);
	const rects: ZoneRect[] = [];
	for (const r of zoneBounds(height, rows)) {
		for (const c of zoneBounds(width, cols)) {
			rects.push({ index: r.index * cols + c.index, left: c.top, top: r.top, right: c.bottom, bottom: r.bottom });
		}
	}
	return rects;
}
