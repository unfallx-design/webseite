'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadHostingerGoogleEnv} = require('../portal/hostinger-env');
const root = '/home/u123456/domains/unfallx.com/hbuilds';
const fixture = 'GOOGLE_CLIENT_ID="fixture.apps.googleusercontent.com"\nGOOGLE_CLIENT_SECRET="fixture-secret"\nNODE_OPTIONS="--require untrusted.js"\nSMTP_PASS=do-not-load\n';

test('Hostinger current and resolved version paths load only the Google pair from private config', () => {
  for (const dir of [root + '/current/nodejs', root + '/versions/01abc-def/nodejs']) {
    const env = {SMTP_PASS:'existing-mail'};
    assert.equal(loadHostingerGoogleEnv(dir, env, (file, encoding) => {
      assert.equal(file, root + '/config/.env'); assert.equal(encoding, 'utf8'); return fixture;
    }), true);
    assert.deepEqual(env, {SMTP_PASS:'existing-mail', GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET:'fixture-secret'});
  }
});
test('Local, test, other-domain and traversal paths never read hosting secrets', () => {
  let reads = 0;
  const read = () => { reads++; return fixture; };
  for (const dir of ['/tmp/nodejs', root + '/current/../nodejs', root.replace('unfallx.com','other.com') + '/current/nodejs', root + '/public_html']) {
    assert.equal(loadHostingerGoogleEnv(dir, {}, read), false);
  }
  assert.equal(loadHostingerGoogleEnv(root + '/current/nodejs', {NODE_ENV:'test'}, read), false);
  assert.equal(reads, 0);
});
test('Complete injected credentials take precedence without reading the file', () => {
  const env = {GOOGLE_CLIENT_ID:'injected', GOOGLE_CLIENT_SECRET:'injected-secret'};
  assert.equal(loadHostingerGoogleEnv(root + '/current/nodejs', env, () => assert.fail('Unexpected read')), false);
  assert.deepEqual(env, {GOOGLE_CLIENT_ID:'injected', GOOGLE_CLIENT_SECRET:'injected-secret'});
});
test('Partial credentials are completed only when they belong to the same client', () => {
  const env = {GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com'};
  assert.equal(loadHostingerGoogleEnv(root + '/current/nodejs', env, () => fixture), true);
  assert.equal(env.GOOGLE_CLIENT_SECRET,'fixture-secret');
  const different = {GOOGLE_CLIENT_ID:'other-client'};
  assert.equal(loadHostingerGoogleEnv(root + '/current/nodejs', different, () => fixture), false);
  assert.deepEqual(different,{GOOGLE_CLIENT_ID:'other-client'});
});
test('Missing, inaccessible or incomplete config leaves the existing environment untouched', () => {
  for (const read of [() => { throw Error('private secret in error'); }, () => 'GOOGLE_CLIENT_ID=fixture', () => '']) {
    const env = {SMTP_PASS:'existing-mail'};
    assert.equal(loadHostingerGoogleEnv(root + '/current/nodejs', env, read), false);
    assert.deepEqual(env,{SMTP_PASS:'existing-mail'});
  }
});
