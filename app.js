/* ZONE-LOGIC:BEGIN */
/*
 * Découpage de la surface tactile en bandes horizontales.
 * Fonctions pures : aucune dépendance au DOM, testables sous Node (tests/zone-logic.test.mjs).
 * Toutes les coordonnées sont relatives à la surface (0 = bord haut de la surface).
 */
(function (root) {
	'use strict';

	/** Indice (0 = haut) de la bande contenant y, ou -1 si les paramètres sont invalides. */
	function zoneIndexForY(y, height, count) {
		if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return -1;
		if (!Number.isInteger(count) || count < 1) return -1;
		const i = Math.floor((y * count) / height);
		return i < 0 ? 0 : i >= count ? count - 1 : i;
	}

	/** Valeur associée à y ; une valeur par bande, de haut en bas. null si invalide. */
	function valueForY(y, height, values) {
		const i = zoneIndexForY(y, height, Array.isArray(values) ? values.length : 0);
		return i < 0 ? null : values[i];
	}

	/** Limites [top, bottom) de chaque bande, en unités de la surface. */
	function zoneBounds(height, count) {
		if (!Number.isFinite(height) || height <= 0 || !Number.isInteger(count) || count < 1) return [];
		const bounds = [];
		for (let i = 0; i < count; i++) {
			bounds.push({ index: i, top: (height * i) / count, bottom: (height * (i + 1)) / count });
		}
		return bounds;
	}

	/** Le point (x, y) est-il dans le coin inférieur droit de taille cornerW × cornerH ? */
	function isInCorner(x, y, width, height, cornerW, cornerH) {
		if (![x, y, width, height, cornerW].every(Number.isFinite)) return false;
		const ch = Number.isFinite(cornerH) ? cornerH : cornerW;
		return x >= width - cornerW && y >= height - ch;
	}

	const api = { zoneIndexForY, valueForY, zoneBounds, isInCorner };
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	root.ZoneLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
/* ZONE-LOGIC:END */

(function () {
	'use strict';

	const $ = (sel) => document.querySelector(sel);
	const root = document.documentElement;
	const stage = $('#stage');
	const altar = $('#altar');
	const numberEl = $('#number');
	const numberText = $('#number-text');
	const baseEl = $('#base');
	const settingsEl = $('#settings');
	const zonesEl = $('#zones');
	const testbar = $('#testbar');
	const testState = $('#test-state');
	const safeProbe = $('#safe-probe');
	const video = $('#keep-awake');
	const { zoneIndexForY, zoneBounds, isInCorner } = window.ZoneLogic;

	/* ================= Réglages ================= */

	const STORAGE_KEY = 'voyante:settings:v1';
	const DEFAULTS = Object.freeze({ zones: 3, values: ['6', '16', '26', '36'], delay: 3, fade: 1.5, brightness: 100 });
	const ZONE_NAMES = {
		2: ['Haut', 'Bas'],
		3: ['Haut', 'Milieu', 'Bas'],
		4: ['Haut', 'Centre haut', 'Centre bas', 'Bas'],
	};
	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const num = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

	function sanitize(raw) {
		const src = raw && typeof raw === 'object' ? raw : {};
		const zones = [2, 3, 4].includes(src.zones) ? src.zones : DEFAULTS.zones;
		const values = DEFAULTS.values.map((d, i) => {
			const v = Array.isArray(src.values) ? src.values[i] : undefined;
			const s = typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, 6) : '';
			return s || d;
		});
		return {
			zones,
			values,
			delay: Math.round(num(src.delay, DEFAULTS.delay, 0, 10) * 2) / 2,
			fade: Math.round(num(src.fade, DEFAULTS.fade, 0.5, 6) * 10) / 10,
			brightness: Math.round(num(src.brightness, DEFAULTS.brightness, 30, 100)),
		};
	}

	function loadSettings() {
		try {
			return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
		} catch (_) {
			return sanitize(null);
		}
	}

	function saveSettings() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch (_) { /* stockage indisponible : réglages conservés pour la session */ }
	}

	let settings = loadSettings();

	function applySettings() {
		root.style.setProperty('--fade', settings.fade + 's');
		root.style.setProperty('--dim', String((100 - settings.brightness) / 100));
	}

	/* ================= Révélation ================= */

	// idle → pending (délai, brume qui s'agite) → shown → clearing (fondu de sortie) → idle
	const show = { phase: 'idle', timer: 0 };
	const isLocked = () => show.phase !== 'idle';

	function numberScale(value) {
		const len = Array.from(String(value)).length;
		return len <= 2 ? 0.42 : len === 3 ? 0.32 : len === 4 ? 0.25 : 0.2;
	}

	function setMistTiming(seconds) {
		altar.style.setProperty('--mist-t', seconds + 's');
	}

	function arm(zoneIndex) {
		const value = settings.values[zoneIndex];
		show.phase = 'pending';
		numberText.textContent = value;
		numberEl.style.setProperty('--num-k', String(numberScale(value)));
		// Montée lente (ease-in) : rien de perceptible à l'instant du toucher.
		setMistTiming(Math.max(settings.delay, 1));
		altar.classList.add('stirring');
		clearTimeout(show.timer);
		show.timer = setTimeout(reveal, settings.delay * 1000);
		onPhaseChange();
	}

	function reveal() {
		show.phase = 'shown';
		setMistTiming(settings.fade * 1.6);
		altar.classList.remove('stirring');
		altar.classList.add('revealed');
		numberEl.classList.add('shown');
		onPhaseChange();
	}

	function fadeOut() {
		clearTimeout(show.timer);
		show.phase = 'clearing';
		setMistTiming(settings.fade);
		altar.classList.remove('stirring', 'revealed');
		numberEl.classList.remove('shown');
		// Reste verrouillé tant que le nombre n'a pas totalement disparu.
		show.timer = setTimeout(() => {
			show.phase = 'idle';
			onPhaseChange();
		}, settings.fade * 1000 + 150);
		onPhaseChange();
	}

	function hardReset() {
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
	const SECRET = { tapMaxMs: 300, gapMs: 700, holdMs: 1000, slopPx: 24 };
	const secret = { taps: 0, lastTapEnd: -Infinity };
	let track = null;

	function readSafeArea() {
		const cs = getComputedStyle(safeProbe);
		return { right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
	}

	function cornerSize(rect) {
		const safe = readSafeArea();
		const side = clamp(Math.min(rect.width, rect.height) * 0.22, 80, 150);
		return { w: side + safe.right, h: side + safe.bottom };
	}

	function baseHitRect() {
		const r = baseEl.getBoundingClientRect();
		const pad = 10;
		return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };
	}

	function inRect(x, y, r) {
		return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	}

	function cancelTrackTimers() {
		if (!track) return;
		clearTimeout(track.resetTimer);
		clearTimeout(track.settingsTimer);
		track.resetTimer = track.settingsTimer = 0;
	}

	function press(id, clientX, clientY, fingers) {
		wake.ensure();
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
		track = {
			id,
			x: clientX,
			y: clientY,
			start: now,
			moved: false,
			onBase: inRect(clientX, clientY, baseHitRect()),
			resetTimer: 0,
			settingsTimer: 0,
		};

		if (track.onBase) {
			if (now - secret.lastTapEnd > SECRET.gapMs) secret.taps = 0;
			if (secret.taps >= 3) track.settingsTimer = setTimeout(openSettings, SECRET.holdMs);
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
			const t = track;
			t.resetTimer = setTimeout(() => {
				t.resetTimer = 0;
				fadeOut();
			}, RESET_HOLD_MS);
		}
	}

	function move(id, clientX, clientY) {
		if (!track || track.id !== id || track.moved) return;
		if (Math.hypot(clientX - track.x, clientY - track.y) > SECRET.slopPx) {
			track.moved = true;
			cancelTrackTimers();
		}
	}

	function release(id, cancelled) {
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
	const elementOf = (target) => (target instanceof Element ? target : target && target.parentElement);
	document.addEventListener('contextmenu', (e) => e.preventDefault());
	document.addEventListener('selectstart', (e) => {
		const el = elementOf(e.target);
		if (!el || !el.closest('input')) e.preventDefault();
	});
	document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
	for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
		document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
	}
	document.addEventListener('touchmove', (e) => {
		const el = elementOf(e.target);
		if (e.touches.length > 1 || !el || !el.closest('.sheet')) e.preventDefault();
	}, { passive: false });

	/* ================= Écran toujours allumé ================= */

	const wake = (() => {
		const dot = $('#wake-dot');
		const text = $('#wake-text');
		const detail = $('#wake-detail');
		let sentinel = null;
		let requesting = false;
		let mode = 'off';

		video.muted = true;
		video.addEventListener('pause', () => { if (mode === 'video') setMode('off'); });
		video.addEventListener('playing', () => { if (!sentinel) setMode('video'); });
		// Certains navigateurs ignorent « loop » sur les médias très courts.
		video.addEventListener('timeupdate', () => {
			if (video.duration && video.currentTime > video.duration - 0.4) video.currentTime = 0;
		});

		function setMode(next) {
			mode = next;
			dot.className = 'dot ' + next;
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

		function playVideo() {
			if (!video.paused) return;
			const p = video.play();
			if (p && typeof p.catch === 'function') p.catch(() => { if (!sentinel) setMode('off'); });
		}

		async function ensure() {
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
				} catch (_) {
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
		if (document.visibilityState === 'visible') wake.ensure();
	});
	window.addEventListener('pageshow', () => wake.ensure());
	window.addEventListener('focus', () => wake.ensure());

	/* ================= Panneau de réglages ================= */

	let testMode = false;

	const form = {
		seg: settingsEl.querySelectorAll('[data-zones]'),
		rows: settingsEl.querySelectorAll('.value-row'),
		labels: settingsEl.querySelectorAll('.value-row label'),
		inputs: settingsEl.querySelectorAll('.value-row input'),
		delay: $('#delay'),
		delayOut: $('#delay-out'),
		fade: $('#fade'),
		fadeOut: $('#fade-out'),
		brightness: $('#brightness'),
		brightnessOut: $('#brightness-out'),
	};
	const fmt = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

	function renderForm() {
		form.seg.forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.zones) === settings.zones)));
		form.rows.forEach((row, i) => { row.hidden = i >= settings.zones; });
		form.labels.forEach((label, i) => { label.textContent = ZONE_NAMES[settings.zones][i] || ''; });
		form.inputs.forEach((input, i) => {
			if (document.activeElement !== input) input.value = settings.values[i];
		});
		form.delay.value = String(settings.delay);
		form.delayOut.textContent = settings.delay === 0 ? 'immédiat' : fmt(settings.delay) + ' s';
		form.fade.value = String(settings.fade);
		form.fadeOut.textContent = fmt(settings.fade) + ' s';
		form.brightness.value = String(settings.brightness);
		form.brightnessOut.textContent = settings.brightness + ' %';
	}

	function commit() {
		settings = sanitize(settings);
		saveSettings();
		applySettings();
		renderForm();
	}

	form.seg.forEach((b) => b.addEventListener('click', () => {
		settings.zones = Number(b.dataset.zones);
		commit();
	}));
	form.inputs.forEach((input, i) => {
		input.addEventListener('input', () => {
			const v = input.value.trim().slice(0, 6);
			if (!v) return;
			settings.values[i] = v;
			commit();
		});
		input.addEventListener('blur', () => { input.value = settings.values[i]; });
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
	});
	form.delay.addEventListener('input', () => { settings.delay = Number(form.delay.value); commit(); });
	form.fade.addEventListener('input', () => { settings.fade = Number(form.fade.value); commit(); });
	form.brightness.addEventListener('input', () => { settings.brightness = Number(form.brightness.value); commit(); });

	function openSettings() {
		cancelTrackTimers();
		secret.taps = 0;
		hardReset();
		setTestMode(false);
		renderForm();
		settingsEl.hidden = false;
		settingsEl.querySelector('.sheet').scrollTop = 0;
	}

	function closeSettings() {
		if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
		settingsEl.hidden = true;
		setTestMode(false);
		hardReset();
		saveSettings();
		wake.ensure();
	}

	function startTest() {
		if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
		settingsEl.hidden = true;
		hardReset();
		setTestMode(true);
	}

	function setTestMode(on) {
		testMode = on;
		testbar.hidden = !on;
		zonesEl.hidden = !on;
		if (on) renderZones();
		else zonesEl.textContent = '';
	}

	function tag(label, value) {
		const el = document.createElement('span');
		el.className = 'tag';
		el.append(label);
		if (value !== undefined) {
			const b = document.createElement('b');
			b.textContent = value;
			el.append(b);
		}
		return el;
	}

	function renderZones() {
		zonesEl.textContent = '';
		const rect = stage.getBoundingClientRect();
		for (const b of zoneBounds(rect.height, settings.zones)) {
			const zone = document.createElement('div');
			zone.className = 'zone';
			zone.style.top = rect.top + b.top + 'px';
			zone.style.height = b.bottom - b.top + 'px';
			zone.append(tag(ZONE_NAMES[settings.zones][b.index] + ' →', settings.values[b.index]));
			zonesEl.append(zone);
		}

		const base = baseHitRect();
		const baseSpot = document.createElement('div');
		baseSpot.className = 'hotspot';
		Object.assign(baseSpot.style, {
			left: base.left + 'px',
			top: base.top + 'px',
			width: base.right - base.left + 'px',
			height: base.bottom - base.top + 'px',
		});
		baseSpot.append(tag('Socle : 3 taps + appui 1 s'));
		zonesEl.append(baseSpot);

		const corner = cornerSize(rect);
		const cornerSpot = document.createElement('div');
		cornerSpot.className = 'hotspot corner';
		Object.assign(cornerSpot.style, {
			left: rect.right - corner.w + 'px',
			top: rect.bottom - corner.h + 'px',
			width: corner.w + 'px',
			height: corner.h + 'px',
			borderRadius: '14px 0 0 0',
		});
		cornerSpot.append(tag('Réarmer : appui 2 s'));
		zonesEl.append(cornerSpot);
	}

	function flashZone(index) {
		const zone = zonesEl.querySelectorAll('.zone')[index];
		if (!zone) return;
		zone.classList.remove('hit');
		void zone.offsetWidth;
		zone.classList.add('hit');
	}

	function onPhaseChange() {
		if (!testMode) return;
		const labels = {
			idle: 'Prêt',
			pending: 'Armé · verrouillé',
			shown: 'Affiché · verrouillé',
			clearing: 'Réarmement…',
		};
		testState.textContent = labels[show.phase];
	}

	$('#close-btn').addEventListener('click', closeSettings);
	$('#test-btn').addEventListener('click', startTest);
	$('#test-back').addEventListener('click', openSettings);
	$('#test-quit').addEventListener('click', closeSettings);
	$('#defaults-btn').addEventListener('click', () => {
		settings = sanitize(null);
		commit();
	});

	window.addEventListener('resize', () => { if (testMode) renderZones(); });

	/* ================= Particules ================= */

	function spawnDust(count) {
		const dust = $('#dust');
		const frag = document.createDocumentFragment();
		for (let i = 0; i < count; i++) {
			const mote = document.createElement('i');
			mote.className = 'mote';
			const dur = 26 + Math.random() * 30;
			mote.style.cssText = [
				`left:${(Math.random() * 100).toFixed(2)}%`,
				`--s:${(1.2 + Math.random() * 2.4).toFixed(2)}px`,
				`--dur:${dur.toFixed(1)}s`,
				`--delay:${(-Math.random() * dur).toFixed(1)}s`,
				`--dx:${((Math.random() * 2 - 1) * 8).toFixed(2)}vw`,
				`--tw:${(3 + Math.random() * 5).toFixed(1)}s`,
				`--o:${(0.35 + Math.random() * 0.5).toFixed(2)}`,
			].join(';');
			frag.append(mote);
		}
		dust.append(frag);
	}

	/* ================= Démarrage ================= */

	applySettings();
	spawnDust(18);
	wake.ensure();

	if ('serviceWorker' in navigator && location.protocol !== 'file:') {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('sw.js').catch(() => {});
		});
	}
})();
