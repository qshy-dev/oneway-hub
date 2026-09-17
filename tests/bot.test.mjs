import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, safeMessage, commandReply } from '../bot/protocol.mjs';
test('IRC welcome and confirmed self JOIN are separate events', () => {
  assert.equal(parseLine(':tmi.twitch.tv 001 onewaymod :Welcome').command, '001');
  const joined = parseLine(':onewaymod!onewaymod@onewaymod.tmi.twitch.tv JOIN #qshyou');
  assert.equal(joined.command, 'JOIN'); assert.equal(joined.params[0], '#qshyou');
});
test('IRC preserves equals in tags and colons in chat content', () => {
  const msg = parseLine('@id=123;user-id=42;display-name=Test\\sUser;custom=a=b :test!test@test PRIVMSG #qshyou :hello :world');
  assert.equal(msg.tags.custom, 'a=b'); assert.equal(msg.tags['display-name'], 'Test User'); assert.equal(msg.text, 'hello :world');
});
test('PING payload is preserved and bad credentials are visible notices', () => {
  assert.equal(parseLine('PING :tmi.twitch.tv').text, 'tmi.twitch.tv');
  assert.equal(parseLine(':tmi.twitch.tv NOTICE * :Login authentication failed').text, 'Login authentication failed');
});
test('outgoing chat cannot inject IRC commands', () => {
  assert.equal(safeMessage('hi\r\nJOIN #other\0'), 'hi  JOIN #other ');
  assert.equal(safeMessage('a'.repeat(600)).length, 450);
});
test('custom commands expand supported variables and disabled commands stay disabled', () => {
  const commands = [{ name: 'hello', response: 'Hello {user} in {channel}', enabled: true, cooldown: 25 }];
  assert.deepEqual(commandReply('!hello', commands, 'Alice', 'test', null), { name: 'hello', text: 'Hello Alice in test', cooldown: 25 });
  assert.equal(commandReply('!help', [{ name: 'help', enabled: false }], 'A', 'test'), null);
  assert.equal(commandReply('!unknown', [], 'A', 'test'), null);
});
