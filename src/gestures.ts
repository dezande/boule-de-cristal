/*
 * Double tap qui efface la boule, n'importe où sur l'écran.
 * Seul le magicien touche l'app : le geste est calibré pour être facile à réussir d'un vrai
 * doigt (taps un peu appuyés, courte hésitation), pas pour résister aux spectateurs.
 * Logique pure, sans DOM ni minuterie : testée dans tests/gestures.test.ts.
 */

export const DOUBLE_TAP = {
	/** Un contact plus court que ça compte comme un tap. */
	maxTapMs: 500,
	/** Pause maximale entre la fin du premier tap et le début du second. */
	maxGapMs: 700,
} as const;

/** Contact terminé, mémorisé pour reconnaître un double tap. */
export interface TapRecord {
	/** Fin du contact (ms). */
	end: number;
	durationMs: number;
	/** Le doigt a glissé au-delà de la tolérance. */
	moved: boolean;
	/** Un nombre était déjà armé ou affiché quand ce contact a commencé. */
	whileArmed: boolean;
}

/**
 * Le contact qui commence à `now` complète-t-il un double tap de réinitialisation ?
 * Les deux taps doivent avoir lieu alors qu'un nombre est armé ou affiché : le tap qui arme
 * un nombre ne peut donc pas servir de premier tap, et taper deux fois vite pour armer
 * n'efface rien.
 */
export function completesResetDoubleTap(previous: TapRecord | null, now: number, armedNow: boolean): boolean {
	if (!previous || !armedNow || !previous.whileArmed || previous.moved) return false;
	return previous.durationMs <= DOUBLE_TAP.maxTapMs && now - previous.end <= DOUBLE_TAP.maxGapMs;
}
