import { zoneIndexForY, zoneBounds, isInCorner } from './zone-logic.ts';

/* ================= Types ================= */

type ZoneCount = 2 | 3 | 4;
type Phase = 'idle' | 'pending' | 'shown' | 'clearing';
type WakeMode = 'off' | 'lock' | 'video';
type PointerId = number | 'mouse';

interface Settings {
	zones: ZoneCount;
	values: string[];
	delay: number;
	fade: number;
	brightness: number;
}

interface Track {
	id: PointerId;
	x: number;
	y: number;
	start: number;
	moved: boolean;
	onBase: boolean;
	resetTimer: number;
	settingsTimer: number;
}

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/* ================= Éléments ================= */

function $<T extends Element = HTMLElement>(selector: string, parent: ParentNode = document): T {
	const element = parent.querySelector<T>(selector);
	if (!element) throw new Error(`Élément introuvable : ${selector}`);
	return element;
}

const root = document.documentElement;
const stage = $('#stage');
const altar = $('#altar');
const numberEl = $('#number');
const numberText = $('#number-text');
const baseEl = $<SVGSVGElement>('#base');
const settingsEl = $('#settings');
const zonesEl = $('#zones');
const testbar = $('#testbar');
const testState = $('#test-state');
const safeProbe = $('#safe-probe');
const video = $<HTMLVideoElement>('#keep-awake');

/* ================= Réglages ================= */

// Remplacés au build par scripts/stamp-build.ts ; affichés dans les réglages.
const BUILD = { version: '__APP_VERSION__', commit: '__APP_COMMIT__' };

const STORAGE_KEY = 'voyante:settings:v1';
const DEFAULTS: Readonly<Settings> = Object.freeze({ zones: 3, values: ['6', '16', '26', '36'], delay: 3, fade: 1.5, brightness: 100 });
const ZONE_NAMES: Record<ZoneCount, readonly string[]> = {
	2: ['Haut', 'Bas'],
	3: ['Haut', 'Milieu', 'Bas'],
	4: ['Haut', 'Centre haut', 'Centre bas', 'Bas'],
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
const isZoneCount = (v: unknown): v is ZoneCount => v === 2 || v === 3 || v === 4;

function sanitize(raw: unknown): Settings {
	const src: Partial<Record<keyof Settings, unknown>> = raw && typeof raw === 'object' ? raw : {};
	const values = DEFAULTS.values.map((fallback, i) => {
		const v: unknown = Array.isArray(src.values) ? src.values[i] : undefined;
		const s = typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, 6) : '';
		return s || fallback;
	});
	return {
		zones: isZoneCount(src.zones) ? src.zones : DEFAULTS.zones,
		values,
		delay: Math.round(num(src.delay, DEFAULTS.delay, 0, 10) * 2) / 2,
		fade: Math.round(num(src.fade, DEFAULTS.fade, 0.5, 6) * 10) / 10,
		brightness: Math.round(num(src.brightness, DEFAULTS.brightness, 30, 100)),
	};
}

function loadSettings(): Settings {
	try {
		return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		return sanitize(null);
	}
}

function saveSettings(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Stockage indisponible : réglages conservés pour la session.
	}
}

let settings = loadSettings();

function applySettings(): void {
	root.style.setProperty('--fade', `${settings.fade}s`);
	root.style.setProperty('--dim', String((100 - settings.brightness) / 100));
}

/* ================= Révélation ================= */

// idle → pending (délai, brume qui s'agite) → shown → clearing (fondu de sortie) → idle
const show: { phase: Phase; timer: number } = { phase: 'idle', timer: 0 };
const isLocked = (): boolean => show.phase !== 'idle';

function numberScale(value: string): number {
	const length = Array.from(value).length;
	return length <= 2 ? 0.42 : length === 3 ? 0.32 : length === 4 ? 0.25 : 0.2;
}

function setMistTiming(seconds: number): void {
	altar.style.setProperty('--mist-t', `${seconds}s`);
}

function arm(zoneIndex: number): void {
	const value = settings.values[zoneIndex];
	show.phase = 'pending';
	numberText.textContent = value;
	numberEl.style.setProperty('--num-k', String(numberScale(value)));
	// Montée lente (ease-in) : rien de perceptible à l'instant du toucher.
	setMistTiming(Math.max(settings.delay, 1));
	altar.classList.add('stirring');
	clearTimeout(show.timer);
	show.timer = window.setTimeout(reveal, settings.delay * 1000);
	onPhaseChange();
}

function reveal(): void {
	show.phase = 'shown';
	setMistTiming(settings.fade * 1.6);
	altar.classList.remove('stirring');
	altar.classList.add('revealed');
	numberEl.classList.add('shown');
	onPhaseChange();
}

function fadeOut(): void {
	clearTimeout(show.timer);
	show.phase = 'clearing';
	setMistTiming(settings.fade);
	altar.classList.remove('stirring', 'revealed');
	numberEl.classList.remove('shown');
	// Reste verrouillé tant que le nombre n'a pas totalement disparu.
	show.timer = window.setTimeout(() => {
		show.phase = 'idle';
		onPhaseChange();
	}, settings.fade * 1000 + 150);
	onPhaseChange();
}

function hardReset(): void {
	clearTimeout(show.timer);
	show.phase = 'idle';
	altar.classList.add('instant');
	altar.classList.remove('stirring', 'revealed');
	numberEl.classList.remove('shown');
	void altar.offsetWidth;
	altar.classList.remove('instant');
	onPhaseChange();
}

/* ================= Gestes ================= */

const RESET_HOLD_MS = 2000;
const SECRET = { tapMaxMs: 300, gapMs: 700, holdMs: 1000, slopPx: 24 } as const;
const secret = { taps: 0, lastTapEnd: -Infinity };
let track: Track | null = null;

function readSafeArea(): { right: number; bottom: number } {
	const style = getComputedStyle(safeProbe);
	return { right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
}

function cornerSize(rect: DOMRect): { w: number; h: number } {
	const safe = readSafeArea();
	const side = clamp(Math.min(rect.width, rect.height) * 0.22, 80, 150);
	return { w: side + safe.right, h: side + safe.bottom };
}

function baseHitRect(): Box {
	const r = baseEl.getBoundingClientRect();
	const pad = 10;
	return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };
}

function inRect(x: number, y: number, box: Box): boolean {
	return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function cancelTrackTimers(): void {
	if (!track) return;
	clearTimeout(track.resetTimer);
	clearTimeout(track.settingsTimer);
	track.resetTimer = track.settingsTimer = 0;
}

function press(id: PointerId, clientX: number, clientY: number, fingers: number): void {
	void wake.ensure();
	// Plusieurs doigts : rien ne se déclenche, et tout geste en cours est abandonné.
	if (fingers !== 1) {
		cancelTrackTimers();
		track = null;
		secret.taps = 0;
		return;
	}

	const now = performance.now();
	const rect = stage.getBoundingClientRect();
	const x = clientX - rect.left;
	const y = clientY - rect.top;
	const corner = cornerSize(rect);

	cancelTrackTimers();
	const current: Track = {
		id,
		x: clientX,
		y: clientY,
		start: now,
		moved: false,
		onBase: inRect(clientX, clientY, baseHitRect()),
		resetTimer: 0,
		settingsTimer: 0,
	};
	track = current;

	if (current.onBase) {
		if (now - secret.lastTapEnd > SECRET.gapMs) secret.taps = 0;
		if (secret.taps >= 3) current.settingsTimer = window.setTimeout(openSettings, SECRET.holdMs);
	} else {
		secret.taps = 0;
	}

	const canReset = show.phase === 'pending' || show.phase === 'shown';
	if (!isLocked()) {
		const index = zoneIndexForY(y, rect.height, settings.zones);
		if (index >= 0) {
			arm(index);
			if (testMode) flashZone(index);
		}
	} else if (canReset && isInCorner(x, y, rect.width, rect.height, corner.w, corner.h)) {
		current.resetTimer = window.setTimeout(() => {
			current.resetTimer = 0;
			fadeOut();
		}, RESET_HOLD_MS);
	}
}

function move(id: PointerId, clientX: number, clientY: number): void {
	if (!track || track.id !== id || track.moved) return;
	if (Math.hypot(clientX - track.x, clientY - track.y) > SECRET.slopPx) {
		track.moved = true;
		cancelTrackTimers();
	}
}

function release(id: PointerId, cancelled: boolean): void {
	if (!track || track.id !== id) return;
	cancelTrackTimers();
	if (track.onBase && !track.moved && !cancelled) {
		const now = performance.now();
		if (now - track.start <= SECRET.tapMaxMs) {
			secret.taps = Math.min(secret.taps + 1, 3);
			secret.lastTapEnd = now;
		} else {
			secret.taps = 0;
		}
	} else if (track.onBase) {
		secret.taps = 0;
	}
	track = null;
}

let lastTouchAt = -Infinity;

stage.addEventListener('touchstart', (e) => {
	e.preventDefault();
	lastTouchAt = performance.now();
	const t = e.changedTouches[0];
	press(t.identifier, t.clientX, t.clientY, e.touches.length);
}, { passive: false });

stage.addEventListener('touchmove', (e) => {
	e.preventDefault();
	for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY);
}, { passive: false });

stage.addEventListener('touchend', (e) => {
	e.preventDefault();
	for (const t of e.changedTouches) release(t.identifier, false);
}, { passive: false });

stage.addEventListener('touchcancel', (e) => {
	for (const t of e.changedTouches) release(t.identifier, true);
}, { passive: false });

// Souris (répétition sur ordinateur) ; ignorée juste après un vrai toucher.
stage.addEventListener('mousedown', (e) => {
	if (e.button !== 0 || performance.now() - lastTouchAt < 1000) return;
	press('mouse', e.clientX, e.clientY, 1);
});
window.addEventListener('mousemove', (e) => move('mouse', e.clientX, e.clientY));
window.addEventListener('mouseup', () => release('mouse', false));

// Pas de menu contextuel, de sélection, de zoom, de rebond ni de pull-to-refresh.
const elementOf = (target: EventTarget | null): Element | null =>
	target instanceof Element ? target : target instanceof Node ? target.parentElement : null;

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => {
	if (!elementOf(e.target)?.closest('input')) e.preventDefault();
});
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
	document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => {
	if (e.touches.length > 1 || !elementOf(e.target)?.closest('.sheet')) e.preventDefault();
}, { passive: false });

/* ================= Écran toujours allumé ================= */

const wake = (() => {
	const dot = $('#wake-dot');
	const text = $('#wake-text');
	const detail = $('#wake-detail');
	let sentinel: WakeLockSentinel | null = null;
	let requesting = false;
	let mode: WakeMode = 'off';

	video.muted = true;
	video.addEventListener('pause', () => {
		if (mode === 'video') setMode('off');
	});
	video.addEventListener('playing', () => {
		if (!sentinel) setMode('video');
	});
	// Certains navigateurs ignorent « loop » sur les médias très courts.
	video.addEventListener('timeupdate', () => {
		if (video.duration && video.currentTime > video.duration - 0.4) video.currentTime = 0;
	});

	function setMode(next: WakeMode): void {
		mode = next;
		dot.className = `dot ${next}`;
		if (next === 'lock') {
			text.textContent = 'Écran : verrou actif';
			detail.textContent = 'Screen Wake Lock API';
		} else if (next === 'video') {
			text.textContent = 'Écran : verrou actif';
			detail.textContent = 'Repli : vidéo muette en boucle';
		} else {
			text.textContent = 'Écran : verrou inactif';
			detail.textContent = 'Touchez la scène pour le réactiver';
		}
	}

	function playVideo(): void {
		if (!video.paused) return;
		video.play().catch(() => {
			if (!sentinel) setMode('off');
		});
	}

	async function ensure(): Promise<void> {
		if (document.visibilityState !== 'visible' || requesting) return;
		if (sentinel && !sentinel.released) return;
		if ('wakeLock' in navigator && navigator.wakeLock) {
			requesting = true;
			try {
				const s = await navigator.wakeLock.request('screen');
				sentinel = s;
				s.addEventListener('release', () => {
					if (sentinel !== s) return;
					sentinel = null;
					setMode(video.paused ? 'off' : 'video');
				});
				setMode('lock');
				video.pause();
				return;
			} catch {
				// Refusé (pas de geste utilisateur, économie d'énergie…) : repli vidéo.
			} finally {
				requesting = false;
			}
		}
		playVideo();
	}

	setMode('off');
	return { ensure };
})();

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') void wake.ensure();
});
window.addEventListener('pageshow', () => void wake.ensure());
window.addEventListener('focus', () => void wake.ensure());

/* ================= Panneau de réglages ================= */

let testMode = false;

const form = {
	seg: settingsEl.querySelectorAll<HTMLButtonElement>('[data-zones]'),
	rows: settingsEl.querySelectorAll<HTMLElement>('.value-row'),
	labels: settingsEl.querySelectorAll<HTMLLabelElement>('.value-row label'),
	inputs: settingsEl.querySelectorAll<HTMLInputElement>('.value-row input'),
	delay: $<HTMLInputElement>('#delay'),
	delayOut: $<HTMLOutputElement>('#delay-out'),
	fade: $<HTMLInputElement>('#fade'),
	fadeOut: $<HTMLOutputElement>('#fade-out'),
	brightness: $<HTMLInputElement>('#brightness'),
	brightnessOut: $<HTMLOutputElement>('#brightness-out'),
};
const fmt = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

function blurActiveElement(): void {
	if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function renderForm(): void {
	form.seg.forEach((button) => button.setAttribute('aria-checked', String(Number(button.dataset.zones) === settings.zones)));
	form.rows.forEach((row, i) => {
		row.hidden = i >= settings.zones;
	});
	form.labels.forEach((label, i) => {
		label.textContent = ZONE_NAMES[settings.zones][i] ?? '';
	});
	form.inputs.forEach((input, i) => {
		if (document.activeElement !== input) input.value = settings.values[i];
	});
	form.delay.value = String(settings.delay);
	form.delayOut.textContent = settings.delay === 0 ? 'immédiat' : `${fmt(settings.delay)} s`;
	form.fade.value = String(settings.fade);
	form.fadeOut.textContent = `${fmt(settings.fade)} s`;
	form.brightness.value = String(settings.brightness);
	form.brightnessOut.textContent = `${settings.brightness} %`;
}

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

function commit(): void {
	settings = sanitize(settings);
	saveSettings();
	applySettings();
	renderForm();
}

form.seg.forEach((button) => button.addEventListener('click', () => {
	settings.zones = Number(button.dataset.zones) as ZoneCount;
	commit();
}));
form.inputs.forEach((input, i) => {
	input.addEventListener('input', () => {
		const v = input.value.trim().slice(0, 6);
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
form.delay.addEventListener('input', () => {
	settings.delay = Number(form.delay.value);
	commit();
});
form.fade.addEventListener('input', () => {
	settings.fade = Number(form.fade.value);
	commit();
});
form.brightness.addEventListener('input', () => {
	settings.brightness = Number(form.brightness.value);
	commit();
});

function openSettings(): void {
	cancelTrackTimers();
	secret.taps = 0;
	hardReset();
	setTestMode(false);
	renderForm();
	renderAbout();
	settingsEl.hidden = false;
	$('.sheet', settingsEl).scrollTop = 0;
}

function closeSettings(): void {
	blurActiveElement();
	settingsEl.hidden = true;
	setTestMode(false);
	hardReset();
	saveSettings();
	void wake.ensure();
}

function startTest(): void {
	blurActiveElement();
	settingsEl.hidden = true;
	hardReset();
	setTestMode(true);
}

function setTestMode(on: boolean): void {
	testMode = on;
	testbar.hidden = !on;
	zonesEl.hidden = !on;
	if (on) renderZones();
	else zonesEl.textContent = '';
}

function tag(label: string, value?: string): HTMLSpanElement {
	const element = document.createElement('span');
	element.className = 'tag';
	element.append(label);
	if (value !== undefined) {
		const b = document.createElement('b');
		b.textContent = value;
		element.append(b);
	}
	return element;
}

function hotspot(className: string, box: Box, label: string): HTMLDivElement {
	const spot = document.createElement('div');
	spot.className = className;
	Object.assign(spot.style, {
		left: `${box.left}px`,
		top: `${box.top}px`,
		width: `${box.right - box.left}px`,
		height: `${box.bottom - box.top}px`,
	});
	spot.append(tag(label));
	return spot;
}

function renderZones(): void {
	zonesEl.textContent = '';
	const rect = stage.getBoundingClientRect();
	for (const b of zoneBounds(rect.height, settings.zones)) {
		const zone = document.createElement('div');
		zone.className = 'zone';
		zone.style.top = `${rect.top + b.top}px`;
		zone.style.height = `${b.bottom - b.top}px`;
		zone.append(tag(`${ZONE_NAMES[settings.zones][b.index]} →`, settings.values[b.index]));
		zonesEl.append(zone);
	}

	zonesEl.append(hotspot('hotspot', baseHitRect(), 'Socle : 3 taps + appui 1 s'));

	const corner = cornerSize(rect);
	const cornerBox = { left: rect.right - corner.w, top: rect.bottom - corner.h, right: rect.right, bottom: rect.bottom };
	const cornerSpot = hotspot('hotspot corner', cornerBox, 'Réarmer : appui 2 s');
	cornerSpot.style.borderRadius = '14px 0 0 0';
	zonesEl.append(cornerSpot);
}

function flashZone(index: number): void {
	const zone = zonesEl.querySelectorAll('.zone')[index];
	if (!zone) return;
	zone.classList.remove('hit');
	void zonesEl.offsetWidth;
	zone.classList.add('hit');
}

const PHASE_LABELS: Record<Phase, string> = {
	idle: 'Prêt',
	pending: 'Armé · verrouillé',
	shown: 'Affiché · verrouillé',
	clearing: 'Réarmement…',
};

function onPhaseChange(): void {
	if (testMode) testState.textContent = PHASE_LABELS[show.phase];
}

$('#close-btn').addEventListener('click', closeSettings);
$('#test-btn').addEventListener('click', startTest);
$('#test-back').addEventListener('click', openSettings);
$('#test-quit').addEventListener('click', closeSettings);
$('#defaults-btn').addEventListener('click', () => {
	settings = sanitize(null);
	commit();
});

window.addEventListener('resize', () => {
	if (testMode) renderZones();
});

/* ================= Particules ================= */

function spawnDust(count: number): void {
	const dust = $('#dust');
	const fragment = document.createDocumentFragment();
	for (let i = 0; i < count; i++) {
		const mote = document.createElement('i');
		mote.className = 'mote';
		const duration = 26 + Math.random() * 30;
		mote.style.cssText = [
			`left:${(Math.random() * 100).toFixed(2)}%`,
			`--s:${(1.2 + Math.random() * 2.4).toFixed(2)}px`,
			`--dur:${duration.toFixed(1)}s`,
			`--delay:${(-Math.random() * duration).toFixed(1)}s`,
			`--dx:${((Math.random() * 2 - 1) * 8).toFixed(2)}vw`,
			`--tw:${(3 + Math.random() * 5).toFixed(1)}s`,
			`--o:${(0.35 + Math.random() * 0.5).toFixed(2)}`,
		].join(';');
		fragment.append(mote);
	}
	dust.append(fragment);
}

/* ================= Démarrage ================= */

applySettings();
spawnDust(18);
void wake.ensure();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('sw.js').catch(() => {});
	});
}
