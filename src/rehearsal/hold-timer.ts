/*
 * Chrono d'appui : compte la durée pendant laquelle le doigt reste posé, pour s'entraîner
 * à l'appui qui ouvre les réglages. Masquable dans les réglages : il apparaît aussi,
 * brièvement, au toucher discret d'un tour.
 */

import { settings } from '../settings/store.ts';
import { $ } from '../system/dom.ts';

const holdTimerEl = $('#hold-timer');
/** Image d'animation en attente (mise à jour du compteur). */
let frame = 0;
/** Minuterie qui masque le chrono après le message final. */
let hideTimer = 0;

/** Durée en secondes à la française, une décimale (« 2,4 s »). */
export const formatSeconds = (ms: number): string =>
	`${(ms / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/** Affiche le chrono et le met à jour à chaque image, jusqu'à stopHoldTimer ou hideHoldTimer. */
export function startHoldTimer(start: number, targetMs: number): void {
	hideHoldTimer();
	if (!settings.showHoldTimer) return;
	holdTimerEl.hidden = false;
	const tick = (): void => {
		holdTimerEl.textContent = `${formatSeconds(performance.now() - start)} / ${targetMs / 1000} s`;
		frame = requestAnimationFrame(tick);
	};
	tick();
}

/** Fige le chrono sur un message, puis le masque peu après. */
export function stopHoldTimer(message: string): void {
	cancelAnimationFrame(frame);
	if (holdTimerEl.hidden) return;
	holdTimerEl.textContent = message;
	clearTimeout(hideTimer);
	hideTimer = window.setTimeout(() => {
		holdTimerEl.hidden = true;
	}, 1500);
}

/** Masque le chrono immédiatement. */
export function hideHoldTimer(): void {
	cancelAnimationFrame(frame);
	clearTimeout(hideTimer);
	holdTimerEl.hidden = true;
}
