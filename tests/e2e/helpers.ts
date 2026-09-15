// Outils communs aux tests dans Chrome : ouverture de l'app, nombre dans la boule, réglages, rotation.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { SCREEN, type Browser, type Page, type Point } from '../../src/kit/node/chrome.ts';

/** Clé d'enregistrement des réglages (src/settings/store.ts). */
export const STORAGE_KEY = 'voyante:settings:v1';
/** Réglages rapides pour les tests : apparition immédiate, fondu court. */
export const FAST = { delay: 0, fade: 0.5 };
/** Durée du fondu de sortie avec FAST, marge comprise : l'app est ensuite réarmée. */
export const FADE_OUT_MS = 900;
export const TEST_TIMEOUT = { timeout: 60_000 };

/** Points de toucher, à l'écart des bords et du centre. */
export const TOP_LEFT: Point = { x: 60, y: 150 };
export const TOP_RIGHT: Point = { x: SCREEN.width - 60, y: 150 };
export const BOTTOM_LEFT: Point = { x: 60, y: SCREEN.height - 150 };
export const BOTTOM_RIGHT: Point = { x: SCREEN.width - 60, y: SCREEN.height - 150 };
export const CENTER: Point = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
/** Milieu horizontal de la bande `index` sur `count` bandes. */
export const band = (index: number, count: number): Point => ({ x: SCREEN.width / 2, y: ((index + 0.5) * SCREEN.height) / count });

/**
 * Ouvre l'app à `url` dans un nouvel onglet avec les réglages `stored` déjà enregistrés
 * (objet, texte brut pour simuler des données abîmées, ou undefined pour aucun réglage),
 * lance `run`, puis vérifie qu'aucune erreur JavaScript n'a eu lieu.
 */
export async function openApp(browser: Browser, url: string, stored: object | string | undefined, run: (page: Page) => Promise<void>): Promise<void> {
	const page = await browser.newPage();
	try {
		await page.goto(url);
		const raw = typeof stored === 'string' ? stored : JSON.stringify(stored);
		await page.evaluate(`localStorage.clear(); ${stored === undefined ? '' : `localStorage.setItem('${STORAGE_KEY}', ${JSON.stringify(raw)})`}`);
		await page.reload();
		await page.waitFor(`document.querySelector('#version-badge').textContent`, 'démarrage de l\'app');
		await run(page);
		assert.deepEqual(page.errors, [], 'erreurs JavaScript dans la page');
	} finally {
		await page.close();
	}
}

/** Nombre dans la boule : texte et visibilité. */
export const NUMBER = `({ text: document.querySelector('#number-text').textContent, shown: document.querySelector('#number').classList.contains('shown') })`;

export async function expectShown(page: Page, value: string, timeoutMs = 3000): Promise<void> {
	await page.waitFor(`${NUMBER}.shown && ${NUMBER}.text === ${JSON.stringify(value)}`, `« ${value} » affiché`, timeoutMs, NUMBER);
}

export async function expectCleared(page: Page): Promise<void> {
	await page.waitFor(`!${NUMBER}.shown`, 'nombre effacé', 3000, NUMBER);
}

/** Double tap pour effacer (au point `at`), puis attente de la fin du fondu : l'app est de nouveau prête. */
export async function resetBall(page: Page, at: Point = CENTER): Promise<void> {
	await page.doubleTap(at);
	await expectCleared(page);
	await sleep(FADE_OUT_MS);
}

export const isSettingsOpen = `!document.querySelector('#settings').hidden`;

/** Appui maintenu au centre jusqu'à l'ouverture des réglages. */
export async function openSettings(page: Page): Promise<void> {
	await page.touchStart(CENTER);
	await page.waitFor(isSettingsOpen, 'réglages ouverts par l\'appui de 3 s', 5000);
	await page.touchEnd();
}

/** Réglages enregistrés sur l'appareil. */
export const storedSettings = (page: Page): Promise<Record<string, unknown>> =>
	page.evaluate(`JSON.parse(localStorage.getItem('${STORAGE_KEY}'))`);

/** Modifie un champ du panneau comme le ferait l'utilisateur (valeur puis événement). */
export const setField = (page: Page, selector: string, value: string, event = 'input'): Promise<unknown> =>
	page.evaluate(`(() => { const el = document.querySelector('${selector}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('${event}', { bubbles: true })); })()`);

export const click = (page: Page, selector: string): Promise<unknown> =>
	page.evaluate(`document.querySelector('${selector}').click()`);

export const text = (page: Page, selector: string): Promise<string> =>
	page.evaluate(`document.querySelector('${selector}').textContent`);

/** Téléphone tourné : vers la gauche (angle 90), vers la droite (angle 270), ou droit (0). */
export async function turnPhone(page: Page, angle: 0 | 90 | 270): Promise<void> {
	const landscape = angle !== 0;
	await page.send('Emulation.setDeviceMetricsOverride', {
		width: landscape ? SCREEN.height : SCREEN.width,
		height: landscape ? SCREEN.width : SCREEN.height,
		deviceScaleFactor: 3,
		mobile: true,
		screenOrientation: { type: angle === 0 ? 'portraitPrimary' : angle === 90 ? 'landscapePrimary' : 'landscapeSecondary', angle },
	});
	await page.waitFor(`document.querySelector('#app').dataset.rotation === '${angle === 0 ? 0 : angle === 90 ? -90 : 90}'`, `rotation pour l'angle ${angle}`, 3000);
}

/** Attend que la page ait été rechargée (marqueur __avant disparu) et l'app redémarrée. */
export async function waitForReload(page: Page, timeoutMs = 15_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			if (await page.evaluate<boolean>(`!window.__avant && Boolean(document.querySelector('#version-badge').textContent)`)) return;
		} catch {
			// Page en cours de remplacement.
		}
		await sleep(100);
	}
	throw new Error('Attente dépassée : rechargement automatique après la mise à jour');
}

