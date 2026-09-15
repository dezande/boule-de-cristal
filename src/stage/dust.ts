/* Particules dorées qui montent lentement sur la scène (animations dans _stage.scss). */

import { $ } from '../system/dom.ts';

/** Crée `count` particules, chacune avec une position, une taille et un rythme aléatoires. */
export function spawnDust(count: number): void {
	const random = (min: number, max: number): number => min + Math.random() * (max - min);
	const fragment = document.createDocumentFragment();
	for (let i = 0; i < count; i++) {
		const mote = document.createElement('i');
		mote.className = 'mote';
		const duration = random(26, 56);
		mote.style.cssText = [
			`left:${random(0, 100).toFixed(2)}%`,
			`--s:${random(1.2, 3.6).toFixed(2)}px`, // taille
			`--dur:${duration.toFixed(1)}s`, // durée de la montée
			`--delay:${(-random(0, duration)).toFixed(1)}s`, // négatif : la particule part déjà en cours de montée
			`--dx:${random(-8, 8).toFixed(2)}vw`, // amplitude du balancement horizontal
			`--tw:${random(3, 8).toFixed(1)}s`, // rythme du scintillement
			`--o:${random(0.35, 0.85).toFixed(2)}`, // opacité maximale
		].join(';');
		fragment.append(mote);
	}
	$('#dust').append(fragment);
}
