// Vérifie que chaque changement met aussi à jour le journal des versions (CHANGELOG.md).
// Lancé par la CI sur chaque push et chaque pull request : si le journal n'a pas bougé,
// rien n'est publié. Voir « Publier une nouvelle version » dans CHANGELOG.md.
// Lancer en local : npm run check:changelog [base] [head]
import { execFileSync } from 'node:child_process';

export const CHANGELOG = 'CHANGELOG.md';

// Vrai si le lot de fichiers modifiés exige une entrée dans le journal : dès qu'autre chose
// que le journal lui-même a changé (code, styles, tests, workflows, README, réglages du projet).
export const needsChangelog = (changed: readonly string[]): boolean =>
	changed.some((file) => file !== CHANGELOG) && !changed.includes(CHANGELOG);

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();

const commitExists = (ref: string): boolean => {
	try {
		git('cat-file', '-e', `${ref}^{commit}`);
		return true;
	} catch {
		return false;
	}
};

// Les fichiers modifiés entre base et head. La CI donne la base (github.event.before, ou la
// base de la pull request) ; en local, origin/main. Sans base connue (premier push, historique
// tronqué, branche neuve), il n'y a rien à comparer.
export const changedFiles = (base: string | undefined, head: string): string[] | null => {
	if (!base || /^0+$/.test(base) || !commitExists(base)) return null;
	return git('diff', '--name-only', `${base}..${head}`).split('\n').filter(Boolean);
};

const main = (): void => {
	const [baseArg, head = 'HEAD'] = process.argv.slice(2);
	const base = baseArg || (commitExists('origin/main') ? 'origin/main' : undefined);
	const changed = changedFiles(base, head);

	if (changed === null) {
		console.log('Journal des versions : pas de base de comparaison, vérification passée.');
		return;
	}
	if (needsChangelog(changed)) {
		console.error(`${CHANGELOG} n'a pas été mis à jour alors que ${changed.length} fichier(s) ont changé :`);
		for (const file of changed) console.error(`  ${file}`);
		console.error(`\nDécrivez ce qui a changé sous « À venir » dans ${CHANGELOG}.`);
		process.exit(1);
	}
	console.log(`Journal des versions à jour (${changed.length} fichier(s) comparés).`);
};

if (process.argv[1]?.endsWith('check-changelog.ts')) main();
