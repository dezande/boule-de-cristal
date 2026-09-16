/*
 * Réglages : forme, valeurs par défaut et validation.
 * Fonctions pures, sans DOM ni localStorage : testées sous Node (tests/logic/settings.test.ts).
 * Les réglages lus sur l'appareil peuvent venir d'une ancienne version de l'app ou être abîmés :
 * tout passe par sanitizeSettings() avant d'être utilisé.
 */

export type ZoneCount = 2 | 3 | 4;

export interface Settings {
	/** 2 ou 3 : bandes horizontales ; 4 : les 4 coins. */
	zones: ZoneCount;
	/** Une valeur par zone, dans l'ordre des zones (toujours 4 : les dernières sont ignorées avec moins de zones). */
	values: string[];
	/** Délai entre le toucher et l'apparition du nombre, en secondes. */
	delay: number;
	/** Durée du fondu d'apparition et de disparition, en secondes. */
	fade: number;
	/** Luminosité de la scène, en pourcentage. */
	brightness: number;
	/** Jauge de l'appui long sur la scène : aide à la répétition, à masquer avant de jouer. */
	showHoldRing: boolean;
}

/** Longueur maximale d'une valeur (le champ de saisie a le même maxlength). */
export const MAX_VALUE_LENGTH = 6;

export const DEFAULTS: Readonly<Settings> = Object.freeze({
	zones: 3,
	values: ['6', '16', '26', '36'],
	delay: 3,
	fade: 1.5,
	brightness: 100,
	showHoldRing: true,
});

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** Nombre borné entre lo et hi, ou la valeur par défaut si ce n'est pas un nombre. */
const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const isZoneCount = (v: unknown): v is ZoneCount => v === 2 || v === 3 || v === 4;

/**
 * Réglages valides à partir de n'importe quelle donnée (JSON enregistré, réglages en cours…) :
 * chaque champ absent ou invalide reprend sa valeur par défaut, les nombres sont bornés et arrondis
 * au pas des curseurs.
 */
export function sanitizeSettings(raw: unknown): Settings {
	const src: Partial<Record<keyof Settings, unknown>> = raw && typeof raw === 'object' ? raw : {};
	const values = DEFAULTS.values.map((fallback, i) => {
		const v: unknown = Array.isArray(src.values) ? src.values[i] : undefined;
		const s = typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, MAX_VALUE_LENGTH) : '';
		return s || fallback;
	});
	return {
		zones: isZoneCount(src.zones) ? src.zones : DEFAULTS.zones,
		values,
		delay: Math.round(num(src.delay, DEFAULTS.delay, 0, 10) * 2) / 2,
		fade: Math.round(num(src.fade, DEFAULTS.fade, 0.5, 6) * 10) / 10,
		brightness: Math.round(num(src.brightness, DEFAULTS.brightness, 30, 100)),
		showHoldRing: bool(src.showHoldRing, DEFAULTS.showHoldRing),
	};
}
