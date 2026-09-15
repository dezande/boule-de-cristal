/*
 * Gestes sur la scène : quel effet a chaque toucher.
 * - Double tap n'importe où, nombre armé ou affiché : efface la boule.
 * - Appui maintenu de 3 s n'importe où, à tout moment : ouvre les réglages.
 * - Toucher simple, app au repos : arme la zone touchée.
 * Seul le magicien touche l'app : les gestes sont calibrés pour être faciles à réussir d'un vrai
 * doigt (taps un peu appuyés, courte hésitation), pas pour résister aux spectateurs.
 * Logique pure, sans DOM ni minuterie : testée dans tests/logic/gestures.test.ts.
 */

/* ================= Double tap ================= */

export const DOUBLE_TAP = {
	/** Un contact plus court que ça compte comme un tap. */
	maxTapMs: 500,
	/** Pause maximale entre la fin du premier tap et le début du second. */
	maxGapMs: 700,
} as const;

/** Contact terminé, mémorisé pour reconnaître un double tap. */
export interface TapRecord {
	/** Fin du contact (ms). */
	end: number;
	durationMs: number;
	/** Le doigt a glissé au-delà de la tolérance. */
	moved: boolean;
	/** Un nombre était déjà armé ou affiché quand ce contact a commencé. */
	whileArmed: boolean;
}

/**
 * Le contact qui commence à `now` complète-t-il un double tap de réinitialisation ?
 * Les deux taps doivent avoir lieu alors qu'un nombre est armé ou affiché : le tap qui arme
 * un nombre ne peut donc pas servir de premier tap, et taper deux fois vite pour armer
 * n'efface rien.
 */
export function completesResetDoubleTap(previous: TapRecord | null, now: number, armedNow: boolean): boolean {
	if (!previous || !armedNow || !previous.whileArmed || previous.moved) return false;
	return previous.durationMs <= DOUBLE_TAP.maxTapMs && now - previous.end <= DOUBLE_TAP.maxGapMs;
}

/* ================= Suivi d'un contact ================= */

export const HOLD = {
	/** Durée de l'appui maintenu qui ouvre les réglages, n'importe où, à tout moment. */
	settingsMs: 3000,
	/** Glissement toléré pendant un appui maintenu, en pixels CSS. */
	slopPx: 40,
} as const;

/** Après un vrai toucher, les événements souris simulés par le navigateur sont ignorés pendant ce délai. */
export const MOUSE_AFTER_TOUCH_MS = 1000;

/** Un clic souris arrivant `now` est-il sans doute simulé par le navigateur après le toucher de `lastTouchAt` ? */
export const isMouseAfterTouch = (lastTouchAt: number, now: number): boolean => now - lastTouchAt < MOUSE_AFTER_TOUCH_MS;

/** Identifiant d'un doigt (Touch.identifier) ou « mouse ». */
export type PointerId = number | 'mouse';

/** État de la boule au moment où le doigt se pose. */
export interface StageState {
	/** Un nombre est armé ou affiché. */
	armed: boolean;
	/** Un tour est en cours : les touchers n'arment rien. */
	locked: boolean;
}

/**
 * Ce que doit faire la scène quand un doigt se pose.
 * - cancel : plusieurs doigts, tout geste en cours est abandonné ;
 * - reset : ce toucher complète un double tap, la boule s'efface ;
 * - arm : app au repos, la zone touchée est armée ;
 * - none : tour en cours, le toucher n'arme rien.
 * Sauf pour cancel, le doigt posé peut aussi devenir un appui long (holdCompleted).
 */
export type PressAction = 'cancel' | 'reset' | 'arm' | 'none';

/** Bilan d'un contact terminé, pour le chrono et le diagnostic. */
export interface ContactSummary {
	durationMs: number;
	/** Plus grand écart constaté depuis la position de départ. */
	driftPx: number;
	moved: boolean;
}

interface Contact {
	id: PointerId;
	x: number;
	y: number;
	start: number;
	driftPx: number;
	moved: boolean;
	/** Un nombre était déjà armé ou affiché quand le doigt s'est posé. */
	startedArmed: boolean;
}

/**
 * Suit les contacts sur la scène et décide de l'effet de chacun. Un seul doigt est suivi à la fois.
 * Sans DOM ni minuterie : les instants (`now`) sont fournis par l'appelant (stage/touch.ts),
 * qui applique les effets et programme l'appui long.
 */
export class GestureTracker {
	#contact: Contact | null = null;
	/** Dernier contact terminé normalement, candidat premier tap d'un double tap. */
	#lastTap: TapRecord | null = null;

	/** Doigt posé en (x, y) alors que `fingers` doigts touchent l'écran. */
	press(id: PointerId, x: number, y: number, fingers: number, now: number, stage: StageState): PressAction {
		this.#contact = null;
		if (fingers !== 1) {
			this.#lastTap = null;
			return 'cancel';
		}
		const contact: Contact = { id, x, y, start: now, driftPx: 0, moved: false, startedArmed: stage.armed };
		this.#contact = contact;
		if (completesResetDoubleTap(this.#lastTap, now, stage.armed)) {
			this.#lastTap = null;
			// Ce second tap ne doit pas servir de premier tap à un nouveau double tap.
			contact.startedArmed = false;
			return 'reset';
		}
		return stage.locked ? 'none' : 'arm';
	}

	/**
	 * Doigt déplacé en (x, y). Renvoie la distance parcourue au moment où le doigt dépasse la
	 * tolérance (l'appui long est alors abandonné), sinon null.
	 */
	move(id: PointerId, x: number, y: number): number | null {
		const contact = this.#contact;
		if (!contact || contact.id !== id || contact.moved) return null;
		const distance = Math.hypot(x - contact.x, y - contact.y);
		contact.driftPx = Math.max(contact.driftPx, distance);
		if (distance <= HOLD.slopPx) return null;
		contact.moved = true;
		return distance;
	}

	/**
	 * Doigt levé, ou contact interrompu par le système (`interrupted`) : un contact interrompu
	 * ne compte pas comme tap. Renvoie null si ce doigt n'était pas suivi.
	 */
	release(id: PointerId, now: number, interrupted = false): ContactSummary | null {
		const contact = this.#contact;
		if (!contact || contact.id !== id) return null;
		this.#contact = null;
		const durationMs = now - contact.start;
		this.#lastTap = interrupted ? null : { end: now, durationMs, moved: contact.moved, whileArmed: contact.startedArmed };
		return { durationMs, driftPx: contact.driftPx, moved: contact.moved };
	}

	/**
	 * À appeler quand HOLD.settingsMs s'est écoulé depuis la pose du doigt `id` :
	 * vrai si ce doigt est toujours posé sans avoir glissé, et les réglages doivent s'ouvrir.
	 */
	holdCompleted(id: PointerId): boolean {
		return this.#contact !== null && this.#contact.id === id && !this.#contact.moved;
	}
}
