/* Réglages en cours et enregistrement sur l'appareil (localStorage). Validation : logic/settings.ts. */

import { sanitizeSettings, type Settings, type ZoneCount } from '../logic/settings.ts';

export type { Settings, ZoneCount };

const STORAGE_KEY = 'voyante:settings:v1';

/** Nom de chaque zone, dans l'ordre des zones (voir logic/zone-logic.ts). */
export const ZONE_NAMES: Record<ZoneCount, readonly string[]> = {
	2: ['Haut', 'Bas'],
	3: ['Haut', 'Milieu', 'Bas'],
	4: ['Haut gauche', 'Haut droite', 'Bas gauche', 'Bas droite'],
};

function loadSettings(): Settings {
	try {
		return sanitizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		return sanitizeSettings(null);
	}
}

/**
 * Réglages en cours. Les autres modules lisent ce binding (toujours à jour) et peuvent modifier
 * ses champs, puis appellent storeSettings() pour valider et enregistrer.
 */
export let settings = loadSettings();

/** Valide et enregistre les réglages. Avec `null` : rétablit les réglages par défaut. */
export function storeSettings(next: unknown = settings): void {
	settings = sanitizeSettings(next);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Stockage indisponible : réglages conservés pour la session.
	}
}
