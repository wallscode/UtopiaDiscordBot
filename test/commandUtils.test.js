const test = require('node:test');
const assert = require('node:assert');
const { PermissionFlagsBits, PermissionsBitField, Collection } = require('discord.js');

function load(roleId) {
  if (roleId === undefined) delete process.env.ADMIN_ROLE_ID;
  else process.env.ADMIN_ROLE_ID = roleId;
  delete require.cache[require.resolve('../src/commands/commandUtils')];
  return require('../src/commands/commandUtils');
}

function member({ admin = false, roles = [] } = {}) {
  return {
    permissions: new PermissionsBitField(admin ? PermissionFlagsBits.Administrator : 0n),
    roles: { cache: new Collection(roles.map(([id, name]) => [id, { id, name }])) },
  };
}

test('isAdmin: Discord Administrator permission is an admin', () => {
  const { isAdmin } = load();
  assert.strictEqual(isAdmin(member({ admin: true })), true);
});

test('isAdmin: a role merely named "Admin" is not enough', () => {
  const { isAdmin } = load();
  assert.strictEqual(isAdmin(member({ roles: [['999', 'Admin']] })), false);
});

test('isAdmin: the ADMIN_ROLE_ID role counts, a different role with its name does not', () => {
  const { isAdmin } = load('770635610230620192');
  assert.strictEqual(isAdmin(member({ roles: [['770635610230620192', 'Officers']] })), true);
  assert.strictEqual(isAdmin(member({ roles: [['123', 'Officers']] })), false);
});

test('isAdmin: raw interaction members (permission string, role ID list)', () => {
  const { isAdmin } = load('42');
  assert.strictEqual(isAdmin({ permissions: String(PermissionFlagsBits.Administrator), roles: [] }), true);
  assert.strictEqual(isAdmin({ permissions: '0', roles: ['42'] }), true);
  assert.strictEqual(isAdmin({ permissions: '0', roles: ['7'] }), false);
  assert.strictEqual(isAdmin(null), false);
});
