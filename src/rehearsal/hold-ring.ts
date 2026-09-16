/*
 * Jauge de l'appui long : un anneau qui se remplit sous le doigt jusqu'à l'ouverture des réglages.
 * Elle n'apparaît qu'une fois passée la durée d'un tap, pour qu'un toucher de tour ne la montre jamais.
 * Masquable dans les réglages : c'est une aide à la répétition, pas un élément de la scène.
 * Le remplissage est une animation CSS (styles/_hold-ring.scss) : rien à calculer à chaque image.
 */

import { DOUBLE_TAP } from '../logic/gestures.ts';
import { settings } from '../settings/store.ts';
import { $ } from '../system/dom.ts';

const ringEl = $('#hold-ring');

/** Rien avant ce délai : un tap, même un peu appuyé, ne fait pas apparaître la jauge. */
const DELAY_MS = DOUBLE_TAP.maxTapMs;

/**
 * Montre la jauge au point touché (repère de la scène, qui peut être pivotée) et la remplit
 * jusqu'à `targetMs`. Sans effet si l'aide est masquée dans les réglages.
 */
export function showHoldRing(x: number, y: number, targetMs: number): void {
	hideHoldRing();
	if (!settings.showHoldRing || targetMs <= DELAY_MS) return;
	ringEl.style.left = `${x}px`;
	ringEl.style.top = `${y}px`;
	ringEl.style.setProperty('--ring-delay', `${DELAY_MS}ms`);
	ringEl.style.setProperty('--ring-duration', `${targetMs - DELAY_MS}ms`);
	ringEl.hidden = false;
	// Relance l'animation depuis le début, même si la jauge vient d'être montrée.
	void ringEl.offsetWidth;
	ringEl.classList.add('run');
}

/** Masque la jauge immédiatement (doigt levé ou glissé, geste annulé, réglages ouverts). */
export function hideHoldRing(): void {
	ringEl.hidden = true;
	ringEl.classList.remove('run');
}
