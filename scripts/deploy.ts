// Déploiement : vérifie le dépôt, incrémente la version du cache hors-ligne,
// lance types, tests et build, pousse sur main, puis suit GitHub Actions
// jusqu'à la mise en ligne.
//
// Usage : npm run deploy
//         npm run deploy -- --dry-run   (vérifications et build, sans commit ni push)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BRANCH = 'main';
const WORKFLOW = 'ci.yml';
const SW_FILE = 'src/sw/sw.ts';
const CACHE_PATTERN = /const CACHE = 'voyante-v(\d+)';/;
const dryRun = process.argv.includes('--dry-run');

function fail(message: string): never {
	console.error(`\n✗ ${message}`);
	process.exit(1);
}

function step(title: string): void {
	console.log(`\n▸ ${title}`);
}

/** Lance une commande en affichant sa sortie ; lève une erreur si elle échoue. */
function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} a échoué`);
}

/** Lance une commande et renvoie sa sortie standard. */
function output(command: string, args: string[]): string {
	return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function hasCommand(command: string): boolean {
	return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

async function waitFor<T>(check: () => Promise<T | null>, timeoutMs: number, intervalMs: number): Promise<T | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const value = await check();
			if (value !== null) return value;
		} catch {
			// Nouvel essai au prochain intervalle.
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	return null;
}

/* ---------- 1. État du dépôt ---------- */

step('Vérification du dépôt');
const branch = output('git', ['branch', '--show-current']);
if (branch !== BRANCH) fail(`Le déploiement se fait depuis « ${BRANCH} » (branche actuelle : « ${branch} »).`);
if (output('git', ['status', '--porcelain'])) {
	fail('Des modifications ne sont pas commitées. Commitez-les ou mettez-les de côté avant de déployer.');
}
run('git', ['fetch', '--quiet', 'origin', BRANCH]);
const behind = Number(output('git', ['rev-list', '--count', `HEAD..origin/${BRANCH}`]));
if (behind > 0) fail(`La branche locale a ${behind} commit(s) de retard sur origin/${BRANCH} : faites « git pull » d'abord.`);
console.log(`Branche ${BRANCH} propre et à jour.`);

/* ---------- 2. Version du cache hors-ligne ---------- */

step('Version du cache hors-ligne');
const swSource = readFileSync(SW_FILE, 'utf8');
const cacheMatch = swSource.match(CACHE_PATTERN);
if (!cacheMatch) fail(`Déclaration « const CACHE = 'voyante-vN'; » introuvable dans ${SW_FILE}.`);
const version = Number(cacheMatch[1]) + 1;
const cacheName = `voyante-v${version}`;
writeFileSync(SW_FILE, swSource.replace(CACHE_PATTERN, `const CACHE = '${cacheName}';`));
console.log(`voyante-v${version - 1} → ${cacheName}`);

/* ---------- 3. Types, tests, build ---------- */

try {
	step('Vérification des types');
	run('npm', ['run', '--silent', 'typecheck']);
	step('Tests');
	run('npm', ['test', '--silent']);
	step('Build');
	run('npm', ['run', '--silent', 'build']);
} catch {
	writeFileSync(SW_FILE, swSource);
	fail('Vérifications en échec : version du cache restaurée, rien n\'a été commité ni poussé.');
}

if (dryRun) {
	writeFileSync(SW_FILE, swSource);
	console.log(`\n✓ Simulation réussie. Version du cache restaurée ; rien n'a été commité ni poussé.`);
	process.exit(0);
}

/* ---------- 4. Commit et push ---------- */

step('Commit et push');
run('git', ['commit', '--quiet', '-m', `Déploiement : cache ${cacheName}`, '--', SW_FILE]);
run('git', ['push', '--quiet', 'origin', BRANCH]);
const sha = output('git', ['rev-parse', 'HEAD']);
console.log(`Poussé : ${sha.slice(0, 7)}`);

/* ---------- 5. Suivi de GitHub Actions et vérification en ligne ---------- */

if (!hasCommand('gh')) {
	console.log('\nGitHub CLI (gh) absent : suivez le déploiement dans l\'onglet Actions du dépôt.');
	process.exit(0);
}

step('GitHub Actions');
const runId = await waitFor(async () => {
	const id = output('gh', ['run', 'list', '--commit', sha, '--workflow', WORKFLOW, '--json', 'databaseId', '--jq', '.[0].databaseId']);
	return id || null;
}, 90_000, 3_000);
if (!runId) fail('L\'exécution GitHub Actions n\'est pas apparue. Vérifiez l\'onglet Actions du dépôt.');

const watch = spawnSync('gh', ['run', 'watch', runId, '--exit-status', '--interval', '5'], { stdio: 'inherit' });
if (watch.status !== 0) fail(`La CI a échoué. Détails : gh run view ${runId} --log-failed`);

step('Vérification du site');
const { homepage } = JSON.parse(readFileSync('package.json', 'utf8')) as { homepage: string };
const online = await waitFor(async () => {
	const response = await fetch(new URL(`sw.js?t=${Date.now()}`, homepage), { cache: 'no-store' });
	return response.ok && (await response.text()).includes(cacheName) ? true : null;
}, 180_000, 5_000);
if (!online) fail(`${homepage} ne sert pas encore ${cacheName} après 3 minutes. Revérifiez dans quelques minutes.`);

console.log(`\n✓ En ligne : ${homepage} (${cacheName})`);
console.log('Sur le téléphone : ouvrez l\'app une fois avec du réseau, fermez-la et rouvrez-la.');
