/*
 * Découpage de la surface tactile en bandes horizontales.
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
