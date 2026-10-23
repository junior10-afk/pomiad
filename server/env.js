'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    if (/^\s*#/.test(line)) return;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v !== '') out[m[1]] = v;
  });
  return out;
}

const fromFile = parseEnvFile(path.join(ROOT, '.env'));
const env = Object.assign({}, fromFile);

Object.keys(process.env).forEach((k) => {
  if (process.env[k] !== '' && process.env[k] !== undefined) env[k] = process.env[k];
});

function int(name, fallback) {
  const v = parseInt(env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

module.exports = {
  env,
  port: int('PORT', 8787),
  crawl: {
    timeoutMs: int('CRAWL_TIMEOUT_MS', 15000),
    maxStylesheets: int('CRAWL_MAX_STYLESHEETS', 8)
  },
  hasEnvFile: fs.existsSync(path.join(ROOT, '.env'))
};
