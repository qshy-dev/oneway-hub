import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute, paths } from '../src/lib/router.ts';
test('all sections resolve including direct nested links and trailing slash', () => {
  for (const [section, path] of Object.entries(paths)) assert.equal(resolveRoute(path).section, section);
  assert.equal(resolveRoute('/tools/auction/').section, 'auction');
});
test('profile logins and invalid URLs are distinguished', () => {
  assert.deepEqual(resolveRoute('/Qshyou'), { section: 'profile', username: 'qshyou' });
  assert.equal(resolveRoute('/does/not/exist').section, 'notFound');
  assert.equal(resolveRoute('/%E0%A4%A').section, 'notFound');
  assert.equal(resolveRoute('/a-b').section, 'notFound');
  assert.equal(resolveRoute('/%D0%B1%D0%BE%D1%82').section, 'bot');
});
