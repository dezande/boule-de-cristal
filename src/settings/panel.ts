/*
 * Panneau de réglages : formulaire, informations sur l'app, ouverture et fermeture.
 * Il s'ouvre par un appui de 3 s sur la scène (stage/touch.ts).
 */

import { BUILD } from '../kit/web/build.ts';
import { describeWake, keepScreenAwake, onWakeChange } from '../kit/web/wake-lock.ts';
import { ROUTINE_IDS, ROUTINES } from '../logic/settings.ts';
import { hideHoldRing } from '../rehearsal/hold-ring.ts';
import { setTestMode } from '../rehearsal/test-mode.ts';
import { hardReset } from '../stage/ball.ts';
import { $ } from '../system/dom.ts';
import { routineValues, settings, storeSettings, ZONE_NAMES, zoneCount, type RoutineId } from './store.ts';

const settingsEl = $('#settings');
const sheet = $('.sheet', settingsEl);

// État du maintien de l'écran allumé (kit/web/wake-lock.ts), affiché dans les réglages.
onWakeChange((state) => {
	const wake = describeWake(state);
	$('#wake-dot').className = `dot ${state.lock ? 'lock' : state.video ? 'video' : 'off'}`;
	$('#wake-text').textContent = wake.text;
	$('#wake-detail').textContent = wake.detail;
});

/** Nombre à la française, une décimale au plus (« 1,5 »). */
const fmt = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/* ---------- Champs ---------- */

// Un bouton par routine, dans l'ordre de ROUTINES.
$('#routines').append(...ROUTINE_IDS.map((id) => {
	const button = document.createElement('button');
	button.type = 'button';
	button.setAttribute('role', 'radio');
	button.dataset.routine = id;
	button.textContent = ROUTINES[id].name;
	return button;
}));

const form = {
	/** Boutons des routines. */
	seg: settingsEl.querySelectorAll<HTMLButtonElement>('[data-routine]'),
	zonesHint: $('#zones-hint'),
	/** Rappel des valeurs de la routine, zone par zone (lecture seule). */
	values: $('#routine-values'),
};

/** Curseurs : réglage piloté et texte affiché à côté. */
const SLIDERS = [
	{ key: 'delay', input: $<HTMLInputElement>('#delay'), output: $<HTMLOutputElement>('#delay-out'), label: (v: number) => (v === 0 ? 'immédiat' : `${fmt(v)} s`) },
	{ key: 'fade', input: $<HTMLInputElement>('#fade'), output: $<HTMLOutputElement>('#fade-out'), label: (v: number) => `${fmt(v)} s` },
	{ key: 'brightness', input: $<HTMLInputElement>('#brightness'), output: $<HTMLOutputElement>('#brightness-out'), label: (v: number) => `${v} %` },
] as const;

/** Cases à cocher des aides à la répétition. */
const TOGGLES = [
	{ key: 'showHoldRing', input: $<HTMLInputElement>('#show-hold-ring') },
] as const;

/* ---------- Affichage ---------- */

const root = document.documentElement;

/** Répercute les réglages sur la scène : fondu, luminosité et aide à la répétition. */
export function applySettings(): void {
	root.style.setProperty('--fade', `${settings.fade}s`);
	root.style.setProperty('--dim', String((100 - settings.brightness) / 100));
	if (!settings.showHoldRing) hideHoldRing();
}

/** Remplit le panneau avec les réglages en cours. */
function renderForm(): void {
	const zones = zoneCount(settings);
	const corners = zones === 4;
	const values = routineValues(settings);
	form.seg.forEach((button) => button.setAttribute('aria-checked', String(button.dataset.routine === settings.routine)));
	form.zonesHint.textContent = corners ? '4 coins de l\'écran' : '3 bandes horizontales';
	form.values.replaceChildren(...values.map((value, i) => {
		const row = document.createElement('div');
		row.className = 'value-row';
		const name = document.createElement('span');
		name.textContent = ZONE_NAMES[zones][i] ?? '';
		const b = document.createElement('b');
		b.textContent = value;
		row.append(name, b);
		return row;
	}));
	for (const { key, input, output, label } of SLIDERS) {
		input.value = String(settings[key]);
		output.textContent = label(settings[key]);
	}
	for (const { key, input } of TOGGLES) input.checked = settings[key];
}

/** Remplit la carte d'informations : version, cache hors-ligne, mode d'affichage. */
function renderAbout(): void {
	$('#about-version').textContent = BUILD.version;
	$('#about-commit').textContent = BUILD.commit;

	const standalone = matchMedia('(display-mode: standalone)').matches
		|| (navigator as Navigator & { standalone?: boolean }).standalone === true;
	$('#about-display').textContent = standalone ? 'app installée' : 'navigateur';

	const cacheEl = $('#about-cache');
	if (!('caches' in window)) {
		cacheEl.textContent = 'indisponible';
		return;
	}
	caches.keys()
		.then((keys) => {
			cacheEl.textContent = keys.filter((key) => key.startsWith('voyante-')).join(', ') || 'pas encore installé';
		})
		.catch(() => {
			cacheEl.textContent = 'indisponible';
		});
}

/** Valide, enregistre et applique les réglages après chaque modification. `null` : réglages par défaut. */
function commit(next: unknown = settings): void {
	storeSettings(next);
	applySettings();
	renderForm();
}

/* ---------- Modifications ---------- */

form.seg.forEach((button) => button.addEventListener('click', () => {
	settings.routine = button.dataset.routine as RoutineId;
	commit();
}));

for (const { key, input } of SLIDERS) {
	input.addEventListener('input', () => {
		settings[key] = Number(input.value);
		commit();
	});
}

for (const { key, input } of TOGGLES) {
	input.addEventListener('change', () => {
		settings[key] = input.checked;
		commit();
	});
}

$('#defaults-btn').addEventListener('click', () => commit(null));

/* ---------- Ouverture et fermeture ---------- */

export const isSettingsOpen = (): boolean => !settingsEl.hidden;

/** Ferme le clavier virtuel s'il est ouvert. */
function blurActiveElement(): void {
	if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/** Ouvre les réglages : efface la boule et quitte le mode test. */
export function openSettings(): void {
	hideHoldRing();
	hardReset();
	setTestMode(false);
	renderForm();
	renderAbout();
	settingsEl.hidden = false;
	sheet.scrollTop = 0;
}

/** Ferme les réglages (ou quitte le mode test) et revient à la scène, prête pour un tour. */
function closeSettings(): void {
	blurActiveElement();
	settingsEl.hidden = true;
	setTestMode(false);
	hardReset();
	storeSettings();
	void keepScreenAwake();
}

/** Passe des réglages au mode « Test des zones ». */
function startTest(): void {
	blurActiveElement();
	settingsEl.hidden = true;
	hardReset();
	setTestMode(true);
}

$('#close-btn').addEventListener('click', closeSettings);
$('#test-btn').addEventListener('click', startTest);
// Boutons de la barre du mode test.
$('#test-back').addEventListener('click', openSettings);
$('#test-quit').addEventListener('click', closeSettings);
