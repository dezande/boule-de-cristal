/*
 * Découpage de la surface tactile en zones.
 *
 * - 2 ou 3 zones : bandes horizontales, numérotées de haut en bas.
 * - 4 zones : les 4 coins (2 colonnes × 2 lignes), numérotés dans le sens de lecture :
 *   0 = haut gauche, 1 = haut droite, 2 = bas gauche, 3 = bas droite.
 *
 * Fonctions pures, sans DOM : testées sous Node (tests/zone-logic.test.ts).
 * Les coordonnées sont relatives à la surface : (0, 0) est son coin haut gauche.
 */

/** Tronçon [start, end) d'un axe (horizontal ou vertical) découpé en parts égales. */
export interface Segment {
	index: number;
	start: number;
	end: number;
}

/** Rectangle [left, right) × [top, bottom) d'une zone. */
export interface ZoneRect {
	index: number;
	left: number;
	top: number;
	right: number;
	bottom: number;
}

const isValidLength = (length: number): boolean => Number.isFinite(length) && length > 0;
const isValidCount = (count: number): boolean => Number.isInteger(count) && count >= 1;

/**
 * Indice du tronçon contenant `position` sur un axe de longueur `length` coupé en `count` parts,
 * ou -1 si les paramètres sont invalides. Une position hors de l'axe (doigt posé sur le bord,
 * au-delà de la surface) est ramenée au premier ou au dernier tronçon.
 */
export function segmentIndex(position: number, length: number, count: number): number {
	if (!Number.isFinite(position) || !isValidLength(length) || !isValidCount(count)) return -1;
	const i = Math.floor((position * count) / length);
	return Math.min(count - 1, Math.max(0, i));
}

/** Tronçons d'un axe de longueur `length` coupé en `count` parts égales ; vide si invalide. */
export function segments(length: number, count: number): Segment[] {
	if (!isValidLength(length) || !isValidCount(count)) return [];
	return Array.from({ length: count }, (_, i) => ({
		index: i,
		start: (length * i) / count,
		end: (length * (i + 1)) / count,
	}));
}

/** Nombre de colonnes et de lignes de la grille pour un nombre de zones. */
export function gridFor(count: number): { cols: number; rows: number } {
	return count === 4 ? { cols: 2, rows: 2 } : { cols: 1, rows: count };
}

/** Indice de la zone contenant le point (x, y), ou -1 si les paramètres sont invalides. */
export function zoneIndexForPoint(x: number, y: number, width: number, height: number, count: number): number {
	const { cols, rows } = gridFor(count);
	const row = segmentIndex(y, height, rows);
	// En bandes (une seule colonne), la position horizontale est ignorée.
	const col = cols === 1 ? 0 : segmentIndex(x, width, cols);
	return row < 0 || col < 0 ? -1 : row * cols + col;
}

/** Rectangles de toutes les zones, dans l'ordre des indices ; vide si les paramètres sont invalides. */
export function zoneRects(width: number, height: number, count: number): ZoneRect[] {
	const { cols, rows } = gridFor(count);
	// Parcours ligne par ligne, puis colonne par colonne : l'ordre produit suit les indices.
	return segments(height, rows).flatMap((row) =>
		segments(width, cols).map((col) => ({
			index: row.index * cols + col.index,
			left: col.start,
			top: row.start,
			right: col.end,
			bottom: row.end,
		})),
	);
}
