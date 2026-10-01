/*
 * Réglages : forme, valeurs par défaut et validation.
 * Fonctions pures, sans DOM ni localStorage : testées sous Node (tests/logic/settings.test.ts).
 * Les réglages lus sur l'appareil peuvent venir d'une ancienne version de l'app ou être abîmés :
 * tout passe par sanitizeSettings() avant d'être utilisé.
 */

/** 3 : bandes horizontales ; 4 : les 4 coins. */
export type ZoneCount = 3 | 4;

export type RoutineId = 'dany-daortiz' | 'arcane-systeme';

export interface Routine {
	/** Nom affiché dans les réglages. */
	name: string;
	zones: ZoneCount;
	/** Une valeur par zone, dans l'ordre des zones. */
	values: readonly string[];
}

/**
 * Routines jouables, chacune avec son découpage de l'écran et ses valeurs.
 * Elles sont fixées ici : les réglages ne font que choisir la routine.
 */
export const ROUTINES: Readonly<Record<RoutineId, Routine>> = Object.freeze({
	'dany-daortiz': { name: 'Dany Daortiz', zones: 3, values: ['6', '16', '26'] },
	'arcane-systeme': { name: 'Arcane Système', zones: 4, values: ['17', '19', '21', '23'] },
});

export const ROUTINE_IDS = Object.keys(ROUTINES) as RoutineId[];

export interface Settings {
	/** Routine jouée : elle fixe le découpage de l'écran et les valeurs. */
	routine: RoutineId;
	/** Délai entre le toucher et l'apparition du nombre, en secondes. */
	delay: number;
	/** Durée du fondu d'apparition et de disparition, en secondes. */
	fade: number;
	/** Luminosité de la scène, en pourcentage. */
	brightness: number;
	/** Jauge de l'appui long sur la scène : aide à la répétition, à masquer avant de jouer. */
	showHoldRing: boolean;
}

export const DEFAULTS: Readonly<Settings> = Object.freeze({
	routine: 'dany-daortiz',
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
const isRoutineId = (v: unknown): v is RoutineId => typeof v === 'string' && Object.hasOwn(ROUTINES, v);

/** Nombre de zones de la routine jouée. */
export const zoneCount = (s: Settings): ZoneCount => ROUTINES[s.routine].zones;
/** Valeurs de la routine jouée, une par zone. */
export const routineValues = (s: Settings): readonly string[] => ROUTINES[s.routine].values;

/**
 * Réglages valides à partir de n'importe quelle donnée (JSON enregistré, réglages en cours…) :
 * chaque champ absent ou invalide reprend sa valeur par défaut, les nombres sont bornés et arrondis
 * au pas des curseurs.
 */
export function sanitizeSettings(raw: unknown): Settings {
	const src: Partial<Record<keyof Settings, unknown>> = raw && typeof raw === 'object' ? raw : {};
	// Les anciennes versions enregistraient un nombre de zones et des valeurs : ils sont ignorés.
	return {
		routine: isRoutineId(src.routine) ? src.routine : DEFAULTS.routine,
		delay: Math.round(num(src.delay, DEFAULTS.delay, 0, 10) * 2) / 2,
		fade: Math.round(num(src.fade, DEFAULTS.fade, 0.5, 6) * 10) / 10,
		brightness: Math.round(num(src.brightness, DEFAULTS.brightness, 30, 100)),
		showHoldRing: bool(src.showHoldRing, DEFAULTS.showHoldRing),
	};
}
