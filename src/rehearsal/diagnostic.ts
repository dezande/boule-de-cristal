/* Version du build et journal de diagnostic (?debug). */

/** Remplacés au build par scripts/stamp-build.ts ; affichés dans les réglages et le diagnostic. */
export const BUILD = { version: '__APP_VERSION__', commit: '__APP_COMMIT__' };

// Avec ?debug dans l'adresse, un journal affiche en direct ce que l'appareil reçoit.
// Invisible et inactif sans ce paramètre.
const DEBUG = new URLSearchParams(location.search).has('debug');
/** Nombre de lignes gardées à l'écran. */
const MAX_LINES = 14;
const debugLines: string[] = [];
const debugEl = DEBUG ? document.body.appendChild(document.createElement('pre')) : null;
if (debugEl) debugEl.id = 'debug-log';

/** Ajoute une ligne horodatée au journal. Sans effet hors mode ?debug. */
export function debugLog(message: string): void {
	if (!debugEl) return;
	const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
	debugLines.push(`${time} ${message}`);
	if (debugLines.length > MAX_LINES) debugLines.shift();
	const controller = 'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'oui' : 'non';
	debugEl.textContent = `Version ${BUILD.version} (${BUILD.commit}) · SW actif : ${controller}\n${debugLines.join('\n')}`;
}
