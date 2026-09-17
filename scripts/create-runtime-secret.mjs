import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const secret = randomBytes(32).toString('hex');
const botEnvPath = '.env.bot';
let botEnv = fs.readFileSync(botEnvPath, 'utf8');
const line = `BOT_RUNTIME_SECRET=${secret}`;
botEnv = /^BOT_RUNTIME_SECRET=.*$/m.test(botEnv)
  ? botEnv.replace(/^BOT_RUNTIME_SECRET=.*$/m, line)
  : `${botEnv.trimEnd()}\n${line}\n`;
fs.writeFileSync(botEnvPath, botEnv);
fs.writeFileSync('.env.runtime.local', `${line}\n`);
console.log('Created a runtime secret in ignored local environment files.');
