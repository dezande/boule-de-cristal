/*
 * La boule de cristal : apparition et disparition du nombre.
 *
 * Phases : idle → pending (délai, la brume s'agite) → shown → clearing (fondu de sortie) → idle.
 * Hors de idle, l'écran est verrouillé : aucun toucher n'arme de nouveau nombre.
 * L'apparence de chaque phase est portée par des classes CSS (_ball.scss) :
 * .stirring et .revealed sur l'autel, .shown sur le nombre.
 */

import { settings } from '../settings/store.ts';
import { $ } from '../system/dom.ts';

export type Phase = 'idle' | 'pending' | 'shown' | 'clearing';

const altar = $('#altar');
const numberEl = $('#number');
const numberText = $('#number-text');

let phase: Phase = 'idle';
/** Minuterie de la phase en cours (apparition ou fin du fondu). */
let timer = 0;
const listeners: ((phase: Phase) => void)[] = [];

export const getPhase = (): Phase => phase;
/** Un tour est en cours : les touchers n'arment plus rien. */
export const isLocked = (): boolean => phase !== 'idle';
/** Un nombre est armé ou affiché (le double tap peut l'effacer). */
export const isArmed = (): boolean => phase === 'pending' || phase === 'shown';

/** Abonne une fonction aux changements de phase (barre du mode test). */
export function onPhaseChange(listener: (phase: Phase) => void): void {
	listeners.push(listener);
}

function setPhase(next: Phase): void {
	phase = next;
	for (const listener of listeners) listener(next);
}

/** Taille du nombre relative à la boule : plus il a de chiffres, plus il est petit. */
function numberScale(value: string): number {
	const length = Array.from(value).length;
	return length <= 2 ? 0.42 : length === 3 ? 0.32 : length === 4 ? 0.25 : 0.2;
}

/** Durée des transitions de la brume et des halos (variable CSS --mist-t). */
function setMistTiming(seconds: number): void {
	altar.style.setProperty('--mist-t', `${seconds}s`);
}

/** Arme la valeur d'une zone : la brume s'agite, le nombre apparaîtra après le délai. */
export function arm(zoneIndex: number): void {
	const value = settings.values[zoneIndex];
	numberText.textContent = value;
	numberEl.style.setProperty('--num-k', String(numberScale(value)));
	// Montée lente (ease-in) : rien de perceptible à l'instant du toucher.
	setMistTiming(Math.max(settings.delay, 1));
	altar.classList.add('stirring');
	clearTimeout(timer);
	timer = window.setTimeout(reveal, settings.delay * 1000);
	setPhase('pending');
}

/** Fait apparaître le nombre dans la boule. */
function reveal(): void {
	setMistTiming(settings.fade * 1.6);
	altar.classList.remove('stirring');
	altar.classList.add('revealed');
	numberEl.classList.add('shown');
	setPhase('shown');
}

/** Efface le nombre en fondu, puis réarme l'app une fois le fondu terminé. */
export function fadeOut(): void {
	clearTimeout(timer);
	setMistTiming(settings.fade);
	altar.classList.remove('stirring', 'revealed');
	numberEl.classList.remove('shown');
	// Reste verrouillé tant que le nombre n'a pas totalement disparu.
	timer = window.setTimeout(() => setPhase('idle'), settings.fade * 1000 + 150);
	setPhase('clearing');
}

/** Remet la boule au repos sans animation (ouverture et fermeture des réglages). */
export function hardReset(): void {
	clearTimeout(timer);
	// .instant coupe les transitions le temps de retirer les classes d'état.
	altar.classList.add('instant');
	altar.classList.remove('stirring', 'revealed');
	numberEl.classList.remove('shown');
	// Lecture de la mise en page : force le navigateur à appliquer l'état sans transition
	// avant de les réactiver.
	void altar.offsetWidth;
	altar.classList.remove('instant');
	setPhase('idle');
}
