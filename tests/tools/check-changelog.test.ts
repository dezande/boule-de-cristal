// Tests de la règle du journal des versions (scripts/check-changelog.ts) :
// tout changement doit s'accompagner d'une entrée dans CHANGELOG.md.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGELOG, needsChangelog } from '../../scripts/check-changelog.ts';

test('du code modifié sans le journal : refusé', () => {
	assert.equal(needsChangelog(['src/stage/touch.ts']), true);
	assert.equal(needsChangelog(['README.md', 'src/styles/_ball.scss', 'tests/e2e/app.e2e.ts']), true);
});

test('le journal modifié en même temps : accepté', () => {
	assert.equal(needsChangelog([CHANGELOG, 'src/stage/touch.ts']), false);
	assert.equal(needsChangelog(['src/app.ts', CHANGELOG, 'package.json']), false);
});

test('le journal seul, ou rien du tout : accepté', () => {
	assert.equal(needsChangelog([CHANGELOG]), false);
	assert.equal(needsChangelog([]), false);
});
