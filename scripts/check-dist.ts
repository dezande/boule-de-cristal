// Vérifie que le build est complet : fichiers de base, icônes du manifest
// et fichiers mis en cache par le service worker.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const DIST = 'dist';
const errors: string[] = [];
const expectFile = (file: string, reason: string): void => {
	if (!existsSync(join(DIST, file))) errors.push(`${file} manquant (${reason})`);
};

for (const file of ['index.html', 'style.css', 'app.js', 'sw.js', 'manifest.json']) expectFile(file, 'fichier de base');

if (existsSync(join(DIST, 'manifest.json'))) {
	const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8')) as { icons: { src: string }[] };
	for (const icon of manifest.icons) expectFile(icon.src, 'icône du manifest');
}

if (existsSync(join(DIST, 'sw.js'))) {
	const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
	const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1]);
	if (assets.length === 0) errors.push('aucun fichier mis en cache trouvé dans sw.js');
	for (const file of new Set(assets)) expectFile(file, 'mis en cache par le service worker');
	// Un script oublié dans la liste casserait l'app hors-ligne.
	// Chemins relatifs à dist/, sous-dossiers compris, avec des « / » comme dans sw.js.
	const scripts = readdirSync(DIST, { recursive: true, encoding: 'utf8' })
		.map((name) => name.split(sep).join('/'))
		.filter((name) => name.endsWith('.js') && name !== 'sw.js');
	for (const file of scripts) {
		if (!assets.includes(file)) errors.push(`${file} n'est pas mis en cache par le service worker (src/sw/sw.ts)`);
	}
}

if (errors.length > 0) {
	console.error(`Build incomplet :\n- ${errors.join('\n- ')}`);
	process.exit(1);
}
console.log('Build complet.');
