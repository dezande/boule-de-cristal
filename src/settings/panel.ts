/*
 * Panneau de réglages : formulaire, informations de debug, ouverture et fermeture.
 * Il s'ouvre par un appui de 3 s sur la scène (stage/touch.ts).
 */

import { describeWake, keepScreenAwake, onWakeChange } from '../kit/web/wake-lock.ts';
import { MAX_VALUE_LENGTH } from '../logic/settings.ts';
import { BUILD, debugLog } from '../rehearsal/diagnostic.ts';
import { hideHoldTimer } from '../rehearsal/hold-timer.ts';
import { setTestMode } from '../rehearsal/test-mode.ts';
import { hardReset } from '../stage/ball.ts';
import { $ } from '../system/dom.ts';
import { settings, storeSettings, ZONE_NAMES, type ZoneCount } from './store.ts';

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

const form = {
	/** Boutons 2 / 3 / 4 zones. */
	seg: settingsEl.querySelectorAll<HTMLButtonElement>('[data-zones]'),
	/** Lignes des valeurs (une par zone, 4 au maximum). */
	rows: settingsEl.querySelectorAll<HTMLElement>('.value-row'),
	labels: settingsEl.querySelectorAll<HTMLLabelElement>('.value-row label'),
	inputs: settingsEl.querySelectorAll<HTMLInputElement>('.value-row input'),
	zonesHint: $('#zones-hint'),
	valuesHint: $('#values-hint'),
};

/** Curseurs : réglage piloté et texte affiché à côté. */
const SLIDERS = [
	{ key: 'delay', input: $<HTMLInputElement>('#delay'), output: $<HTMLOutputElement>('#delay-out'), label: (v: number) => (v === 0 ? 'immédiat' : `${fmt(v)} s`) },
	{ key: 'fade', input: $<HTMLInputElement>('#fade'), output: $<HTMLOutputElement>('#fade-out'), label: (v: number) => `${fmt(v)} s` },
	{ key: 'brightness', input: $<HTMLInputElement>('#brightness'), output: $<HTMLOutputElement>('#brightness-out'), label: (v: number) => `${v} %` },
] as const;

/** Cases à cocher des aides visuelles sur la scène. */
const TOGGLES = [
	{ key: 'showVersion', input: $<HTMLInputElement>('#show-version') },
	{ key: 'showHoldTimer', input: $<HTMLInputElement>('#show-hold-timer') },
	{ key: 'showMenuZone', input: $<HTMLInputElement>('#show-menu-zone') },
] as const;

/* ---------- Affichage ---------- */

const root = document.documentElement;
const versionBadge = $('#version-badge');
const menuZoneEl = $('#menu-zone');

/** Répercute les réglages sur la scène : fondu, luminosité et aides visuelles. */
export function applySettings(): void {
	root.style.setProperty('--fade', `${settings.fade}s`);
	root.style.setProperty('--dim', String((100 - settings.brightness) / 100));
	versionBadge.hidden = !settings.showVersion;
	menuZoneEl.hidden = !settings.showMenuZone;
	if (!settings.showHoldTimer) hideHoldTimer();
}

/** Remplit le panneau avec les réglages en cours. */
function renderForm(): void {
	const corners = settings.zones === 4;
	form.seg.forEach((button) => button.setAttribute('aria-checked', String(Number(button.dataset.zones) === settings.zones)));
	form.zonesHint.textContent = corners ? '4 coins de l\'écran' : 'bandes horizontales';
	form.valuesHint.textContent = corners ? 'coin par coin' : 'de haut en bas';
	form.rows.forEach((row, i) => {
		row.hidden = i >= settings.zones;
	});
	form.labels.forEach((label, i) => {
		label.textContent = ZONE_NAMES[settings.zones][i] ?? '';
	});
	form.inputs.forEach((input, i) => {
		// Ne pas réécrire le champ en cours de saisie : le curseur sauterait.
		if (document.activeElement !== input) input.value = settings.values[i];
	});
	for (const { key, input, output, label } of SLIDERS) {
		input.value = String(settings[key]);
		output.textContent = label(settings[key]);
	}
	for (const { key, input } of TOGGLES) input.checked = settings[key];
}

/** Remplit la carte d'informations de debug : version, cache hors-ligne, mode d'affichage. */
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
	settings.zones = Number(button.dataset.zones) as ZoneCount;
	commit();
}));

form.inputs.forEach((input, i) => {
	input.addEventListener('input', () => {
		const v = input.value.trim().slice(0, MAX_VALUE_LENGTH);
		// Champ vidé : on garde l'ancienne valeur, restaurée à la sortie du champ.
		if (!v) return;
		settings.values[i] = v;
		commit();
	});
	input.addEventListener('blur', () => {
		input.value = settings.values[i];
	});
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') input.blur();
	});
});

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
	debugLog('réglages ouverts');
	hideHoldTimer();
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
