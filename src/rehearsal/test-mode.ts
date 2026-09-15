/*
 * Mode « Test des zones » : limites des zones dessinées sur la scène et barre d'état,
 * pour répéter le tour. Styles dans _test-mode.scss.
 */

import { zoneRects } from '../logic/zone-logic.ts';
import { settings, ZONE_NAMES } from '../settings/store.ts';
import { onPhaseChange, type Phase } from '../stage/ball.ts';
import { $, stage } from '../system/dom.ts';

const zonesEl = $('#zones');
const testbar = $('#testbar');
const testState = $('#test-state');

let testMode = false;

export const isTestMode = (): boolean => testMode;

const PHASE_LABELS: Record<Phase, string> = {
	idle: 'Prêt',
	pending: 'Armé · verrouillé',
	shown: 'Affiché · verrouillé',
	clearing: 'Réarmement…',
};

export function setTestMode(on: boolean): void {
	testMode = on;
	testbar.hidden = !on;
	zonesEl.hidden = !on;
	if (on) renderZones();
	else zonesEl.textContent = '';
}

/** Étiquette d'une zone : « label » suivi de la valeur en gros. */
function tag(label: string, value: string): HTMLSpanElement {
	const element = document.createElement('span');
	element.className = 'tag';
	const b = document.createElement('b');
	b.textContent = value;
	element.append(label, b);
	return element;
}

/** Dessine les limites des zones, alignées sur la scène. */
function renderZones(): void {
	zonesEl.textContent = '';
	const rect = stage.getBoundingClientRect();
	for (const r of zoneRects(rect.width, rect.height, settings.zones)) {
		const zone = document.createElement('div');
		zone.className = 'zone';
		// Colonne de droite des 4 coins : trait vertical et étiquette à droite.
		zone.classList.toggle('right', r.left > 0);
		zone.style.left = `${rect.left + r.left}px`;
		zone.style.top = `${rect.top + r.top}px`;
		zone.style.width = `${r.right - r.left}px`;
		zone.style.height = `${r.bottom - r.top}px`;
		zone.append(tag(`${ZONE_NAMES[settings.zones][r.index]} →`, settings.values[r.index]));
		zonesEl.append(zone);
	}
}

/** Fait clignoter la zone touchée. Sans effet hors mode test. */
export function flashZone(index: number): void {
	const zone = testMode ? zonesEl.querySelectorAll('.zone')[index] : undefined;
	if (!zone) return;
	// Retirer puis remettre la classe relance l'animation, même sur des touchers rapprochés.
	zone.classList.remove('hit');
	void zonesEl.offsetWidth;
	zone.classList.add('hit');
}

onPhaseChange((phase) => {
	if (testMode) testState.textContent = PHASE_LABELS[phase];
});

// Rotation de l'écran, barre d'adresse qui apparaît… : les zones suivent la scène.
window.addEventListener('resize', () => {
	if (testMode) renderZones();
});
