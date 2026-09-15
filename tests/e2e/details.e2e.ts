// Tests dans Chrome complémentaires (app.e2e.ts couvre le tour de base) : cas limites du tour,
// téléphone tourné en 4 coins et en mode test, détails des réglages, aides à la répétition,
// souris, touchers interrompus, comportements du navigateur neutralisés, mise à jour pendant un tour.
// Lancer : npm run build && npm run test:e2e
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Browser, SCREEN, type Page, type Point } from '../../src/kit/node/chrome.ts';
import { startStaticServer, type StaticServer } from '../../src/kit/node/static-server.ts';
import {
	band, BOTTOM_LEFT, BOTTOM_RIGHT, CENTER, click, expectCleared, expectShown, FADE_OUT_MS, FAST, isSettingsOpen, NUMBER,
	openApp, openSettings, resetBall, setField, storedSettings, TEST_TIMEOUT, text, TOP_LEFT, TOP_RIGHT, turnPhone,
} from './helpers.ts';

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

const withApp = (stored: object | undefined, run: (page: Page) => Promise<void>, url = server.url): Promise<void> =>
	openApp(browser, url, stored, run);

const phaseClasses = `document.querySelector('#altar').className`;

/* ================= Le tour : cas limites ================= */

test('double tap pendant le délai : le nombre n’apparaît jamais, puis l’app se réarme', TEST_TIMEOUT, async () => {
	await withApp({ delay: 2, fade: 0.5 }, async (page) => {
		await page.tap(band(0, 3));
		await page.waitFor(`${phaseClasses}.includes('stirring')`, 'brume qui s\'agite pendant le délai', 1000, phaseClasses);
		await sleep(400);
		await page.doubleTap(CENTER);
		await sleep(2500);
		assert.equal((await page.evaluate<{ shown: boolean }>(NUMBER)).shown, false, 'le nombre armé n\'apparaît pas');
		assert.equal(await page.evaluate(`${phaseClasses}.includes('stirring')`), false);
		await page.tap(band(2, 3));
		await expectShown(page, '26', 3000);
	});
});

test('fondu : l’app reste verrouillée pendant toute la durée du fondu réglé', TEST_TIMEOUT, async () => {
	await withApp({ delay: 0, fade: 2 }, async (page) => {
		assert.equal(await page.evaluate(`document.documentElement.style.getPropertyValue('--fade')`), '2s');
		await page.tap(band(0, 3));
		await expectShown(page, '6');
		await page.doubleTap(CENTER);
		await expectCleared(page);
		await sleep(800);
		await page.tap(band(2, 3));
		await sleep(300);
		assert.deepEqual(await page.evaluate(NUMBER), { text: '6', shown: false }, 'toucher ignoré pendant le fondu');
		await sleep(1600);
		await page.tap(band(2, 3));
		await expectShown(page, '26');
	});
});

test('taille du nombre : plus il a de chiffres, plus il est petit, sans jamais sortir de la boule', TEST_TIMEOUT, async () => {
	const cases: [Point, string, string][] = [[TOP_LEFT, '7', '0.42'], [TOP_RIGHT, '123', '0.32'], [BOTTOM_LEFT, '1234', '0.25'], [BOTTOM_RIGHT, '123456', '0.2']];
	await withApp({ ...FAST, zones: 4, values: cases.map(([, value]) => value) }, async (page) => {
		for (const [point, value, scale] of cases) {
			await page.tap(point);
			await expectShown(page, value);
			assert.equal(await page.evaluate(`document.querySelector('#number').style.getPropertyValue('--num-k')`), scale, value);
			const fits = await page.evaluate<boolean>(`document.querySelector('#number-text').getBoundingClientRect().width <= document.querySelector('.globe').getBoundingClientRect().width`);
			assert.ok(fits, `« ${value} » tient dans la boule`);
			await resetBall(page);
		}
	});
});

test('appui de 3 s pendant le délai : réglages ouverts, et le nombre armé n’apparaît pas ensuite', TEST_TIMEOUT, async () => {
	await withApp({ delay: 3, fade: 0.5 }, async (page) => {
		await page.tap(band(0, 3));
		await page.touchStart(CENTER);
		await page.waitFor(isSettingsOpen, 'réglages ouverts', 5000);
		await page.touchEnd();
		await click(page, '#close-btn');
		await sleep(1500);
		assert.equal((await page.evaluate<{ shown: boolean }>(NUMBER)).shown, false);
		await page.tap(band(1, 3));
		await expectShown(page, '16', 4000);
	});
});

/* ================= Téléphone tourné ================= */

test('téléphone tourné : les 4 coins suivent le téléphone, dans les deux sens', TEST_TIMEOUT, async () => {
	const W = SCREEN.height; // largeur de l'écran en paysage
	const H = SCREEN.width;
	const center: Point = { x: W / 2, y: H / 2 };
	// Coins de l'app (haut gauche, haut droite, bas gauche, bas droite) vus sur l'écran.
	const corners: Record<90 | 270, Point[]> = {
		// Haut de l'app à gauche de l'écran, gauche de l'app en bas.
		90: [{ x: 60, y: H - 60 }, { x: 60, y: 60 }, { x: W - 60, y: H - 60 }, { x: W - 60, y: 60 }],
		// Haut de l'app à droite de l'écran, gauche de l'app en haut.
		270: [{ x: W - 60, y: 60 }, { x: W - 60, y: H - 60 }, { x: 60, y: 60 }, { x: 60, y: H - 60 }],
	};
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		for (const angle of [90, 270] as const) {
			await turnPhone(page, angle);
			for (const [i, point] of corners[angle].entries()) {
				await page.tap(point);
				await expectShown(page, ['6', '16', '26', '36'][i]);
				await resetBall(page, center);
			}
		}
		await turnPhone(page, 0);
	});
});

test('téléphone tourné : le mode test dessine les zones dans l’axe du téléphone et signale le bon coin', TEST_TIMEOUT, async () => {
	await withApp({ ...FAST, zones: 4 }, async (page) => {
		await openSettings(page);
		await click(page, '#test-btn');
		await turnPhone(page, 90);
		await sleep(200);
		const zones = await page.evaluate<string[]>(`[...document.querySelectorAll('#zones .zone')].map((z) => [z.style.left, z.style.top, z.style.width, z.style.height].join(' '))`);
		const halfW = SCREEN.width / 2;
		const halfH = SCREEN.height / 2;
		assert.deepEqual(zones, [
			`0px 0px ${halfW}px ${halfH}px`,
			`${halfW}px 0px ${halfW}px ${halfH}px`,
			`0px ${halfH}px ${halfW}px ${halfH}px`,
			`${halfW}px ${halfH}px ${halfW}px ${halfH}px`,
		], 'zones dans le repère de l\'app (portrait)');
		// Haut droite de l'app : en haut à gauche de l'écran.
		await page.tap({ x: 60, y: 60 });
		await page.waitFor(`document.querySelectorAll('#zones .zone')[1].classList.contains('hit')`, 'coin haut droite signalé', 2000);
		await turnPhone(page, 0);
	});
});

/* ================= Réglages ================= */

test('réglages : libellés des curseurs, fondu et luminosité appliqués, valeur limitée à 6 caractères, Entrée ferme le clavier', TEST_TIMEOUT, async () => {
	await withApp(FAST, async (page) => {
		await openSettings(page);
		await setField(page, '#delay', '0');
		assert.equal(await text(page, '#delay-out'), 'immédiat');
		await setField(page, '#delay', '2.5');
		assert.equal(await text(page, '#delay-out'), '2,5 s');
		await setField(page, '#fade', '1.5');
		assert.equal(await text(page, '#fade-out'), '1,5 s');
		assert.equal(await page.evaluate(`document.documentElement.style.getPropertyValue('--fade')`), '1.5s');
		await setField(page, '#brightness', '30');
		assert.equal(await text(page, '#brightness-out'), '30 %');
		assert.equal(await page.evaluate(`document.documentElement.style.getPropertyValue('--dim')`), '0.7');

		assert.equal(await page.evaluate(`document.querySelector('#v0').maxLength`), 6);
		await setField(page, '#v0', '1234567890');
		assert.equal(((await storedSettings(page)).values as string[])[0], '123456');

		await page.evaluate(`document.querySelector('#v1').focus()`);
		assert.equal(await page.evaluate(`document.activeElement.id`), 'v1');
		await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
		await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
		assert.notEqual(await page.evaluate(`document.activeElement.id`), 'v1', 'Entrée quitte le champ');
	});
});

test('réglages : informations de debug remplies (version, commit, cache, affichage, écran)', TEST_TIMEOUT, async () => {
	await withApp(FAST, async (page) => {
		await openSettings(page);
		assert.match(await text(page, '#about-version'), /^\S+$/);
		assert.doesNotMatch(await text(page, '#about-version'), /__APP/);
		assert.match(await text(page, '#about-commit'), /^\S+/);
		await page.waitFor(`document.querySelector('#about-cache').textContent !== ''`, 'cache affiché');
		assert.match(await text(page, '#about-cache'), /^(voyante-\S+|pas encore installé|indisponible)/);
		assert.equal(await text(page, '#about-display'), 'navigateur');
		assert.match(await text(page, '#wake-text'), /^Écran : verrou (actif|inactif)$/);
	});
});

/* ================= Aides à la répétition ================= */

test('mode test : la barre d’état suit chaque phase du tour', TEST_TIMEOUT, async () => {
	await withApp({ delay: 1, fade: 0.5 }, async (page) => {
		await openSettings(page);
		await click(page, '#test-btn');
		const state = `document.querySelector('#test-state').textContent`;
		assert.equal(await page.evaluate(state), 'Prêt');
		await page.tap(band(0, 3));
		await page.waitFor(`${state} === 'Armé · verrouillé'`, 'armé', 1000, state);
		await page.waitFor(`${state} === 'Affiché · verrouillé'`, 'affiché', 2500, state);
		await page.doubleTap(CENTER);
		await page.waitFor(`${state} === 'Réarmement…'`, 'réarmement', 1000, state);
		await page.waitFor(`${state} === 'Prêt'`, 'de nouveau prêt', FADE_OUT_MS + 1000, state);
	});
});

test('chrono d’appui : message au relâchement, puis masqué', TEST_TIMEOUT, async () => {
	await withApp({ delay: 5, fade: 0.5, showHoldTimer: true }, async (page) => {
		await page.touchStart(CENTER);
		await sleep(1200);
		await page.touchEnd();
		const timer = `document.querySelector('#hold-timer')`;
		assert.match(await page.evaluate<string>(`${timer}.textContent`), /^relâché à 1,[0-9] s$/);
		await page.waitFor(`${timer}.hidden`, 'chrono masqué', 3000);
	});
});

test('mode ?debug : journal affiché et alimenté ; absent sans ?debug', TEST_TIMEOUT, async () => {
	await withApp(FAST, async (page) => {
		assert.equal(await page.evaluate(`document.querySelector('#debug-log')`), null);
	});
	await withApp(FAST, async (page) => {
		await page.tap(band(0, 3));
		await page.waitFor(`document.querySelector('#debug-log')?.textContent.includes('posé')`, 'toucher journalisé', 2000, `document.querySelector('#debug-log')?.textContent`);
		assert.match(await text(page, '#debug-log'), /^Version \S+ \(.+\) · SW actif : (oui|non)/);
	}, `${server.url}?debug`);
});

/* ================= Souris et touchers interrompus ================= */

test('souris (répétition sur ordinateur) : un clic arme la zone, un appui de 3 s ouvre les réglages', TEST_TIMEOUT, async () => {
	await withApp(FAST, async (page) => {
		const mouse = (type: string, point: Point): Promise<unknown> =>
			page.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
		const bottom = band(2, 3);
		await mouse('mousePressed', bottom);
		await mouse('mouseReleased', bottom);
		await expectShown(page, '26');
		await resetBall(page);
		// Juste après un toucher, la souris est ignorée (faux clics des téléphones, voir MOUSE_AFTER_TOUCH_MS).
		await sleep(1200);

		await mouse('mousePressed', CENTER);
		await page.waitFor(isSettingsOpen, 'réglages ouverts à la souris', 5000);
		await mouse('mouseReleased', CENTER);
	});
});

test('toucher interrompu par le système (appel, notification) : l’appui long n’ouvre pas les réglages', TEST_TIMEOUT, async () => {
	await withApp({ delay: 10, fade: 0.5, showHoldTimer: true }, async (page) => {
		await page.touchStart(CENTER);
		await sleep(1500);
		await page.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
		assert.equal(await text(page, '#hold-timer'), 'interrompu par le système');
		await sleep(2500);
		assert.equal(await page.evaluate(isSettingsOpen), false);
	});
});

test('comportements du navigateur neutralisés : menu contextuel, zoom, double clic et défilement hors réglages', TEST_TIMEOUT, async () => {
	await withApp(FAST, async (page) => {
		const prevented = (target: string, event: string): Promise<boolean> =>
			page.evaluate(`!document.querySelector('${target}').dispatchEvent(${event})`);
		assert.equal(await prevented('#stage', `new MouseEvent('contextmenu', { bubbles: true, cancelable: true })`), true, 'menu contextuel');
		assert.equal(await prevented('#stage', `new MouseEvent('dblclick', { bubbles: true, cancelable: true })`), true, 'double clic (zoom)');
		assert.equal(await prevented('#stage', `new Event('gesturestart', { bubbles: true, cancelable: true })`), true, 'pincement (zoom Safari)');
		const touchmove = `new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [] })`;
		assert.equal(await prevented('.velvet', touchmove), true, 'défilement de la scène');
		await openSettings(page);
		assert.equal(await prevented('#settings .sheet .card', touchmove), false, 'les réglages défilent');
	});
});

/* ================= Mise à jour pendant un tour ================= */

test('nouvelle version publiée pendant un tour : pas de rechargement, nombre toujours affiché ; nouvelle version à l’ouverture suivante', TEST_TIMEOUT, async () => {
	const dir = mkdtempSync(join(tmpdir(), 'boule-update-tour-'));
	cpSync('dist', dir, { recursive: true });
	const site = await startStaticServer(dir, 0);
	try {
		await withApp({ ...FAST, zones: 3 }, async (page) => {
			await page.waitFor(`navigator.serviceWorker.controller`, 'service worker actif', 15_000);
			await page.tap(band(0, 3)); // tour en cours
			await expectShown(page, '6');
			await page.evaluate(`window.__avant = true`);

			const sw = join(dir, 'sw.js');
			const oldCache = readFileSync(sw, 'utf8').match(/const CACHE = '([^']+)'/)?.[1] ?? '';
			const newCache = 'voyante-pendant-le-tour';
			writeFileSync(sw, readFileSync(sw, 'utf8').replace(oldCache, newCache));
			const build = join(dir, 'kit', 'web', 'build.js');
			writeFileSync(build, readFileSync(build, 'utf8').replace(/version: '[^']*'/, "version: '8888'"));

			await page.evaluate(`navigator.serviceWorker.getRegistration().then((r) => r.update())`);
			await page.waitFor(`caches.keys().then((keys) => keys.length === 1 && keys[0] === ${JSON.stringify(newCache)})`, 'nouvelle version installée', 15_000);
			await sleep(1000);
			assert.equal(await page.evaluate(`window.__avant === true`), true, 'pas de rechargement pendant le tour');
			assert.deepEqual(await page.evaluate(NUMBER), { text: '6', shown: true }, 'nombre toujours affiché');

			await page.reload();
			await page.waitFor(`document.querySelector('#version-badge').textContent.startsWith('v8888 ')`, 'nouvelle version à l\'ouverture suivante', 5000, `document.querySelector('#version-badge').textContent`);
		}, site.url);
	} finally {
		await site.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
