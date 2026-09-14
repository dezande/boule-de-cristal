/*
 * Geste secret d'ouverture des réglages, sur le socle : quelques tapotements, puis un appui maintenu.
 * Calibré pour un vrai doigt : taps un peu appuyés, hésitations et léger glissement sont tolérés.
 * Ce qui rend le geste improbable par hasard, c'est sa structure (endroit + séquence + maintien),
 * pas des délais serrés.
 * Logique pure, sans DOM ni minuterie : testée dans tests/secret-gesture.test.ts.
 */

export const SECRET_GESTURE = {
	/** Tapotements avant l'appui maintenu. « tap, tap, appui » et « tap, tap, tap, appui » marchent tous les deux. */
	tapsBeforeHold: 2,
	/** Un contact plus court que ça compte comme un tapotement. */
	tapMaxMs: 600,
	/** Pause maximale entre la fin d'un tapotement et le contact suivant. */
	gapMs: 1500,
	/** Durée de l'appui maintenu qui ouvre les réglages. */
	holdMs: 900,
	/** Glissement toléré pendant un contact, en pixels CSS. */
	slopPx: 40,
} as const;

export interface SecretGestureState {
	taps: number;
	lastTapEnd: number;
}

export const IDLE_GESTURE: SecretGestureState = Object.freeze({ taps: 0, lastTapEnd: -Infinity });

/**
 * Un doigt se pose sur le socle à l'instant `now` (ms).
 * `armsHold` : si ce contact est maintenu `holdMs` sans glisser, les réglages s'ouvrent.
 */
export function pressBase(state: SecretGestureState, now: number): { state: SecretGestureState; armsHold: boolean } {
	const taps = now - state.lastTapEnd > SECRET_GESTURE.gapMs ? 0 : state.taps;
	return { state: { taps, lastTapEnd: state.lastTapEnd }, armsHold: taps >= SECRET_GESTURE.tapsBeforeHold };
}

/** Le doigt se lève du socle à `now`, après `durationMs` de contact ; `moved` s'il a glissé au-delà de `slopPx`. */
export function releaseBase(state: SecretGestureState, now: number, durationMs: number, moved: boolean): SecretGestureState {
	if (moved || durationMs > SECRET_GESTURE.tapMaxMs) return IDLE_GESTURE;
	return { taps: Math.min(state.taps + 1, SECRET_GESTURE.tapsBeforeHold), lastTapEnd: now };
}
