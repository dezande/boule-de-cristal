// Tests de bout en bout : l'app compilée (dist/) dans un vrai Chrome sans interface,
// sur un écran de téléphone, pilotée par de vrais événements tactiles.
// Lancer : npm run build && npm run test:e2e
//
// Ce qui reste à vérifier sur un vrai téléphone : l'écran toujours allumé, le ressenti des gestes
// et l'installation sur l'écran d'accueil.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { startStaticServer, type StaticServer } from '../../scripts/static-server.ts';
import { Browser, SCREEN, type Page, type Point } from './chrome.ts';

/** Clé d'enregistrement des réglages (src/settings/store.ts). */
const STORAGE_KEY = 'voyante:settings:v1';
/** Réglages rapides pour les tests : apparition immédiate, fondu court. */
const FAST = { delay: 0, fade: 0.5 };
/** Durée du fondu de sortie avec FAST, marge comprise : l'app est ensuite réarmée. */
const FADE_OUT_MS = 900;
const TEST_TIMEOUT = { timeout: 60_000 };

/** Points de toucher, à l'écart des bords et du centre. */
const TOP_LEFT: Point = { x: 60, y: 150 };
const TOP_RIGHT: Point = { x: SCREEN.width - 60, y: 150 };
const BOTTOM_LEFT: Point = { x: 60, y: SCREEN.height - 150 };
const BOTTOM_RIGHT: Point = { x: SCREEN.width - 60, y: SCREEN.height - 150 };
const CENTER: Point = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
/** Milieu horizontal de la bande `index` sur `count` bandes. */
const band = (index: number, count: number): Point => ({ x: SCREEN.width / 2, y: ((index + 0.5) * SCREEN.height) / count });

let server: StaticServer;
let browser: Browser;

before(async () => {
	if (!existsSync('dist/index.html')) throw new Error('dist/ absent : lancez « npm run build » avant les tests dans Chrome.');
	server = await startStaticServer('dist', 0);
	browser = await Browser.launch();
});

after(async () => {
	await browser?.close();
	await server?.close();
});

/* ================= Outils ================= */

/**
 * Ouvre l'app dans un nouvel onglet avec les réglages `stored` déjà enregistrés
 * (objet, texte brut pour simuler des données abîmées, ou undefined pour aucun réglage),
 * lance `run`, puis vérifie qu'aucune erreur JavaScript n'a eu lieu.
 */
async function withApp(stored: object | string | undefined, run: (page: Page) => Promise<void>): Promise<void> {
	const page = await browser.newPage();
	try {
		await page.goto(server.url);
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
const NUMBER = `({ text: document.querySelector('#number-text').textContent, shown: document.querySelector('#number').classList.contains('shown') })`;

async function expectShown(page: Page, value: string, timeoutMs = 3000): Promise<void> {
	await page.waitFor(`${NUMBER}.shown && ${NUMBER}.text === ${JSON.stringify(value)}`, `« ${value} » affiché`, timeoutMs, NUMBER);
}

async function expectCleared(page: Page): Promise<void> {
	await page.waitFor(`!${NUMBER}.shown`, 'nombre effacé', 3000, NUMBER);
}

/** Double tap pour effacer, puis attente de la fin du fondu : l'app est de nouveau prête. */
async function resetBall(page: Page): Promise<void> {
	await page.doubleTap(CENTER);
	await expectCleared(page);
	await sleep(FADE_OUT_MS);
}

const isSettingsOpen = `!document.querySelector('#settings').hidden`;

/** Appui maintenu au centre jusqu'à l'ouverture des réglages. */
async function openSettings(page: Page): Promise<void> {
	await page.touchStart(CENTER);
	await page.waitFor(isSettingsOpen, 'réglages ouverts par l\'appui de 3 s', 5000);
	await page.touchEnd();
}

/** Réglages enregistrés sur l'appareil. */
const storedSettings = (page: Page): Promise<Record<string, unknown>> =>
	page.evaluate(`JSON.parse(localStorage.getItem('${STORAGE_KEY}'))`);

/** Modifie un champ du panneau comme le ferait l'utilisateur (valeur puis événement). */
const setField = (page: Page, selector: string, value: string, event = 'input'): Promise<unknown> =>
	page.evaluate(`(() => { const el = document.querySelector('${selector}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('${event}', { bubbles: true })); })()`);

const click = (page: Page, selector: string): Promise<unknown> =>
	page.evaluate(`document.querySelector('${selector}').click()`);

const text = (page: Page, selector: string): Promise<string> =>
	page.evaluate(`document.querySelector('${selector}').textContent`);

/* ================= Démarrage ================= */

test('démarrage : tous les modules se chargent, sans erreur JavaScript', TEST_TIMEOUT, async () => {
	await withApp(undefined, async (page) => {
		assert.match(await text(page, '#version-badge'), /^v\S+ · /);
		assert.equal(await page.evaluate(`document.querySelectorAll('#dust .mote').length`), 18);
		assert.equal(await page.evaluate(isSettingsOpen), false);
		assert.deepEqual(await page.evaluate(NUMBER), { text: '', shown: false });
	});
});

test('réglages abîmés : l’app démarre avec les réglages par défaut', TEST_TIMEOUT, async () => {
	for (const stored of ['{pas du JSON', '"texte"', JSON.stringify({ zones: 9, values: 'x', delay: -5, fade: 'lent' })]) {
		await withApp(stored, async (page) => {
			// Par défaut : 3 bandes, 6 en haut.
			await page.tap(band(0, 3));
			await expectShown(page, '6', 5000);
		});
	}
});

/* ================= Zones ================= */

test('2 et 3 bandes : chaque bande fait apparaître sa valeur', TEST_TIMEOUT, async () => {
	for (const zones of [2, 3]) {
		await withApp({ ...FAST, zones, values: ['6', '16', '26', '36'] }, async (page) => {
			for (let i = 0; i < zones; i++) {
				await page.tap(band(i, zones));
				await expectShown(page, ['6', '16', '26'][i]);
				await resetBall(page);
			}
		});
	}
});

test('4 coins : chaque coin fait apparaître sa valeur', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4, values: ['6', '16', '26', '36'] }, async (page) => {
		for (const [point, value] of [[TOP_LEFT, '6'], [TOP_RIGHT, '16'], [BOTTOM_LEFT, '26'], [BOTTOM_RIGHT, '36']] as const) {
			await page.tap(point);
			await expectShown(page, value);
			await resetBall(page);
		}
	});
});

/* ================= Déroulé d'un tour ================= */

test('délai : le nombre n’apparaît qu’après le délai réglé', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, delay: 2 }, async (page) => {
		await page.tap(band(1, 3));
		await sleep(1200);
		assert.equal((await page.evaluate<{ shown: boolean }>(NUMBER)).shown, false, 'nombre déjà visible avant le délai');
		await expectShown(page, '16', 3000);
	});
});

test('tour en cours : toucher une autre zone ne change pas le nombre', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		await page.tap(TOP_RIGHT);
		await expectShown(page, '16');
		// Au-delà du délai du double tap : un simple toucher.
		await sleep(1000);
		await page.tap(BOTTOM_LEFT);
		await sleep(600);
		assert.deepEqual(await page.evaluate(NUMBER), { text: '16', shown: true });
	});
});

test('double tap : efface le nombre, puis l’app se réarme', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		await page.tap(TOP_LEFT);
		await expectShown(page, '6');
		await sleep(1000);
		await page.doubleTap(BOTTOM_RIGHT);
		await expectCleared(page);
		await sleep(FADE_OUT_MS);
		await page.tap(BOTTOM_RIGHT);
		await expectShown(page, '36');
	});
});

test('deux taps rapides pour armer : le nombre n’est pas effacé', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, delay: 1 }, async (page) => {
		await page.doubleTap(band(2, 3));
		await expectShown(page, '26', 3000);
		await sleep(500);
		assert.equal((await page.evaluate<{ shown: boolean }>(NUMBER)).shown, true);
	});
});

/* ================= Appui long ================= */

test('appui de 3 s : ouvre les réglages et efface la boule, même pendant un tour', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		await page.tap(TOP_RIGHT);
		await expectShown(page, '16');
		await sleep(1000);
		await openSettings(page);
		assert.equal((await page.evaluate<{ shown: boolean }>(NUMBER)).shown, false);
	});
});

test('appui long annulé : doigt levé trop tôt, doigt qui glisse, deuxième doigt', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, showHoldTimer: false }, async (page) => {
		// Levé au bout d'une seconde.
		await page.tap(CENTER, 1000);
		await sleep(2800);
		assert.equal(await page.evaluate(isSettingsOpen), false, 'doigt levé trop tôt');

		// Glissement au-delà de la tolérance (40 px), doigt maintenu 3,5 s.
		await page.touchStart(CENTER);
		await page.touchMove({ x: CENTER.x, y: CENTER.y + 80 });
		await sleep(3500);
		assert.equal(await page.evaluate(isSettingsOpen), false, 'doigt qui glisse');
		await page.touchEnd();

		// Deuxième doigt posé pendant l'appui.
		await page.touchStart(CENTER);
		await sleep(200);
		await page.touchStart(CENTER, TOP_LEFT);
		await sleep(3500);
		assert.equal(await page.evaluate(isSettingsOpen), false, 'deuxième doigt');
		await page.touchEnd();
	});
});

test('chrono d’appui : visible pendant l’appui, masquable dans les réglages', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST }, async (page) => {
		await page.touchStart(CENTER);
		await page.waitFor(`!document.querySelector('#hold-timer').hidden && document.querySelector('#hold-timer').textContent.includes('/ 3 s')`, 'chrono affiché');
		await page.touchEnd();
		await page.waitFor(`document.querySelector('#hold-timer').textContent.startsWith('relâché à')`, 'chrono figé au relâchement');
	});
	await withApp({ ...FAST, showHoldTimer: false }, async (page) => {
		await page.touchStart(CENTER);
		await sleep(500);
		assert.equal(await page.evaluate(`document.querySelector('#hold-timer').hidden`), true);
		await page.touchEnd();
	});
});

/* ================= Réglages ================= */

test('réglages : chaque modification est appliquée, enregistrée et relue au redémarrage', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST }, async (page) => {
		await openSettings(page);

		await click(page, '[data-zones="4"]');
		assert.equal(await text(page, '#zones-hint'), '4 coins de l\'écran');
		assert.equal(await text(page, '#values-hint'), 'coin par coin');
		assert.deepEqual(
			await page.evaluate(`[...document.querySelectorAll('.value-row')].filter((row) => !row.hidden).map((row) => row.querySelector('label').textContent)`),
			['Haut gauche', 'Haut droite', 'Bas gauche', 'Bas droite'],
		);

		await setField(page, '#v1', ' 42 ');
		await setField(page, '#delay', '1');
		assert.equal(await text(page, '#delay-out'), '1 s');
		await setField(page, '#brightness', '50');
		assert.equal(await text(page, '#brightness-out'), '50 %');
		assert.equal(await page.evaluate(`document.documentElement.style.getPropertyValue('--dim')`), '0.5');

		await click(page, '#show-version');
		await click(page, '#show-menu-zone');
		assert.equal(await page.evaluate(`document.querySelector('#version-badge').hidden`), true);
		assert.equal(await page.evaluate(`document.querySelector('#menu-zone').hidden`), true);

		const stored = await storedSettings(page);
		assert.equal(stored.zones, 4);
		assert.deepEqual(stored.values, ['6', '42', '26', '36']);
		assert.equal(stored.delay, 1);
		assert.equal(stored.brightness, 50);
		assert.equal(stored.showVersion, false);

		// Fermeture, puis redémarrage de l'app : les réglages sont conservés et utilisés.
		await click(page, '#close-btn');
		assert.equal(await page.evaluate(isSettingsOpen), false);
		await page.reload();
		await page.waitFor(`document.querySelector('#version-badge').textContent`, 'redémarrage');
		assert.equal(await page.evaluate(`document.querySelector('#version-badge').hidden`), true);
		await page.tap(TOP_RIGHT);
		await expectShown(page, '42', 3000);
	});
});

test('réglages : valeur vidée conservée, réglages par défaut rétablis', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4, values: ['1', '2', '3', '4'] }, async (page) => {
		await openSettings(page);
		await page.evaluate(`document.querySelector('#v0').focus()`);
		await setField(page, '#v0', '   ');
		await page.evaluate(`document.querySelector('#v0').blur()`);
		assert.equal(await page.evaluate(`document.querySelector('#v0').value`), '1');
		assert.deepEqual((await storedSettings(page)).values, ['1', '2', '3', '4']);

		await click(page, '#defaults-btn');
		const stored = await storedSettings(page);
		assert.equal(stored.zones, 3);
		assert.deepEqual(stored.values, ['6', '16', '26', '36']);
		assert.equal(await page.evaluate(`document.querySelector('[data-zones="3"]').getAttribute('aria-checked')`), 'true');
	});
});

/* ================= Mode test ================= */

/** Zones dessinées : position, colonne de droite ou non, texte de l'étiquette. */
const DRAWN_ZONES = `[...document.querySelectorAll('#zones .zone')].map((zone) => {
	const r = zone.getBoundingClientRect();
	return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), right: zone.classList.contains('right'), label: zone.textContent };
})`;

test('mode test : 4 coins dessinés, touchers signalés, retour aux réglages et sortie', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		await openSettings(page);
		await click(page, '#test-btn');
		assert.equal(await page.evaluate(isSettingsOpen), false);

		const w = SCREEN.width / 2;
		const h = SCREEN.height / 2;
		assert.deepEqual(await page.evaluate(DRAWN_ZONES), [
			{ left: 0, top: 0, width: w, height: h, right: false, label: 'Haut gauche →6' },
			{ left: w, top: 0, width: w, height: h, right: true, label: 'Haut droite →16' },
			{ left: 0, top: h, width: w, height: h, right: false, label: 'Bas gauche →26' },
			{ left: w, top: h, width: w, height: h, right: true, label: 'Bas droite →36' },
		]);

		assert.equal(await text(page, '#test-state'), 'Prêt');
		await page.tap(BOTTOM_RIGHT);
		await page.waitFor(`document.querySelectorAll('#zones .zone')[3].classList.contains('hit')`, 'coin touché signalé');
		await page.waitFor(`document.querySelector('#test-state').textContent === 'Affiché · verrouillé'`, 'état affiché');
		await sleep(1000);
		await page.doubleTap(CENTER);
		await page.waitFor(`document.querySelector('#test-state').textContent === 'Réarmement…'`, 'état réarmement');
		await page.waitFor(`document.querySelector('#test-state').textContent === 'Prêt'`, 'état prêt', 3000);

		await click(page, '#test-back');
		assert.equal(await page.evaluate(isSettingsOpen), true);
		await click(page, '#test-btn');
		await click(page, '#test-quit');
		assert.equal(await page.evaluate(`document.querySelector('#testbar').hidden && document.querySelector('#zones').children.length === 0`), true);
		assert.equal(await page.evaluate(isSettingsOpen), false);
	});
});

test('mode test : 3 bandes sur toute la largeur', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 3 }, async (page) => {
		await openSettings(page);
		await click(page, '#test-btn');
		const zones = await page.evaluate<{ left: number; width: number; right: boolean; label: string }[]>(DRAWN_ZONES);
		assert.deepEqual(zones.map((z) => [z.left, z.width, z.right, z.label]), [
			[0, SCREEN.width, false, 'Haut →6'],
			[0, SCREEN.width, false, 'Milieu →16'],
			[0, SCREEN.width, false, 'Bas →26'],
		]);
	});
});

/* ================= Hors-ligne ================= */

test('hors-ligne : tous les fichiers sont en cache et l’app fonctionne serveur arrêté', TEST_TIMEOUT, async () => {
	// Serveur dédié, arrêté en cours de test : c'est le seul moyen fiable de couper le réseau,
	// la coupure simulée par Chrome ne s'appliquant pas aux requêtes du service worker.
	// Son port différent en fait une autre origine : service worker et cache y partent de zéro.
	const offlineServer = await startStaticServer('dist', 0);
	const page = await browser.newPage();
	try {
		await page.goto(offlineServer.url);
		await page.evaluate(`localStorage.setItem('${STORAGE_KEY}', ${JSON.stringify(JSON.stringify({ ...FAST, zones: 4 }))})`);
		await page.waitFor(`navigator.serviceWorker.controller`, 'service worker actif', 15_000);

		// Chaque fichier listé par le service worker est bien en cache.
		const missing = await page.evaluate<string[]>(`(async () => {
			const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('voyante-')));
			const sw = await (await fetch('sw.js')).text();
			const assets = [...sw.matchAll(/'\\.\\/([^']*)'/g)].map((m) => './' + m[1]);
			if (assets.length === 0) return ['aucun fichier trouvé dans sw.js'];
			const results = await Promise.all(assets.map(async (asset) => (await cache.match(asset)) ? null : asset));
			return results.filter(Boolean);
		})()`);
		assert.deepEqual(missing, [], 'fichiers absents du cache hors-ligne');

		await offlineServer.close();
		assert.equal(await page.evaluate(`fetch('${offlineServer.url}inexistant.js').then(() => 'joignable', () => 'injoignable')`), 'injoignable', 'le serveur devrait être arrêté');

		await page.reload();
		await page.waitFor(`document.querySelector('#version-badge').textContent`, 'redémarrage serveur arrêté');
		await page.tap(BOTTOM_LEFT);
		await expectShown(page, '26');
		assert.deepEqual(page.errors, [], 'erreurs JavaScript dans la page');
	} finally {
		await page.close();
		await offlineServer.close();
	}
});
