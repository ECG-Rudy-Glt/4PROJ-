#!/usr/bin/env node

/*
  SUPFILE share/versioning regression test.

  Usage:
    node scripts/test_share_versioning.mjs

  Optional env:
    API_URL=http://127.0.0.1:5001
    KEEP_TEST_DATA=1

  This script creates fresh users, completes MFA setup, then tests:
    - writable folder share pending/accepted access
    - shared download without query token
    - shared comments + comment edit
    - shared text replacement through /files/upload replaceFileId
    - owner download after shared edit
    - owner version restore
    - read-only folder share cannot replace content
*/

import crypto from 'node:crypto';

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:5001';
const API = `${BASE_URL.replace(/\/$/, '')}/api`;
const KEEP_TEST_DATA = process.env.KEEP_TEST_DATA === '1';
const RUN_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const state = {
  passed: 0,
  failed: 0,
  errors: [],
  createdFolders: [],
};

function log(message) {
  console.log(message);
}

function info(message) {
  log(`-> ${message}`);
}

function ok(message) {
  state.passed += 1;
  log(`OK ${message}`);
}

function fail(message, detail = '') {
  state.failed += 1;
  const full = detail ? `${message} ${detail}` : message;
  state.errors.push(full);
  log(`FAIL ${full}`);
}

function check(message, condition, detail = '') {
  if (condition) ok(message);
  else fail(message, detail);
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, step = 30, digits = 6) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

async function api(method, path, { token, json, form, raw = false } = {}) {
  const headers = {};
  const init = { method, headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  }
  if (form !== undefined) {
    init.body = form;
  }

  const res = await fetch(`${API}${path}`, init);
  if (raw) return res;

  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body, text };
}

function data(response) {
  return response.body?.data ?? response.body ?? {};
}

async function downloadText(path, token) {
  const res = await api('GET', path, { token, raw: true });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function registerAndAuthenticate(label) {
  const user = {
    email: `${label}_${RUN_ID}@supfile.local`,
    password: 'SupfileTest123!',
    firstName: label,
    lastName: 'Regression',
  };

  info(`Register ${user.email}`);
  const register = await api('POST', '/auth/register', { json: user });
  check(`${label} register`, register.status === 201, `(HTTP ${register.status}: ${register.text?.slice(0, 160)})`);

  const registerData = data(register);
  const tempToken = registerData.tempToken;
  check(`${label} temp token`, Boolean(tempToken));
  if (!tempToken) throw new Error(`Missing temp token for ${label}`);

  const setup = await api('POST', '/mfa/setup', { token: tempToken });
  check(`${label} MFA setup`, setup.status === 200, `(HTTP ${setup.status}: ${setup.text?.slice(0, 160)})`);

  const setupData = data(setup);
  const token = totp(setupData.secret);
  const verify = await api('POST', '/mfa/verify-setup', {
    token: tempToken,
    json: {
      token,
      secret: setupData.secret,
      backupCodes: setupData.backupCodes,
      rememberDevice: false,
    },
  });
  check(`${label} MFA verify`, verify.status === 200, `(HTTP ${verify.status}: ${verify.text?.slice(0, 160)})`);

  const authToken = data(verify).token;
  check(`${label} auth token`, Boolean(authToken));
  if (!authToken) throw new Error(`Missing auth token for ${label}`);

  return { ...user, token: authToken, id: registerData.userId };
}

async function createFolder(owner, name) {
  const res = await api('POST', '/folders', { token: owner.token, json: { name } });
  check(`create folder ${name}`, res.status === 201, `(HTTP ${res.status}: ${res.text?.slice(0, 160)})`);
  const folder = data(res).folder;
  if (!folder?.id) throw new Error(`Folder creation failed: ${name}`);
  state.createdFolders.push({ id: folder.id, token: owner.token, name });
  return folder;
}

async function uploadText(user, fileName, content, { folderId, replaceFileId } = {}) {
  const form = new FormData();
  form.append('files', new Blob([content], { type: 'text/plain' }), fileName);
  if (folderId) form.append('folderId', folderId);
  if (replaceFileId) form.append('replaceFileId', replaceFileId);

  const res = await api('POST', '/files/upload', { token: user.token, form });
  check(
    replaceFileId ? `replace file ${replaceFileId}` : `upload ${fileName}`,
    [200, 201, 207].includes(res.status),
    `(HTTP ${res.status}: ${res.text?.slice(0, 200)})`,
  );
  const uploaded = data(res).file || data(res).files?.[0];
  if (!uploaded?.id && !replaceFileId) throw new Error(`Upload failed: ${fileName}`);
  return uploaded;
}

async function shareFolder(owner, receiver, folderId, permissions) {
  const res = await api('POST', '/share/folders', {
    token: owner.token,
    json: {
      folderId,
      targetUserEmail: receiver.email,
      canRead: permissions.canRead,
      canWrite: permissions.canWrite,
      canDelete: permissions.canDelete ?? false,
      canShare: permissions.canShare ?? false,
    },
  });
  check(`share folder ${folderId}`, [200, 201].includes(res.status), `(HTTP ${res.status}: ${res.text?.slice(0, 200)})`);
  const share = data(res).sharedFolder;
  if (!share?.id) throw new Error(`Share folder failed: ${folderId}`);
  return share;
}

async function acceptFolderShare(receiver, folderId) {
  const pending = await api('GET', '/share/pending', { token: receiver.token });
  check('receiver can list pending shares', pending.status === 200, `(HTTP ${pending.status})`);
  const folders = data(pending).folders || data(pending).pendingFolders || [];
  const share = folders.find((entry) => entry.folderId === folderId || entry.folder?.id === folderId) || folders[0];
  check('pending folder share found', Boolean(share?.id), `(${folders.length} pending folders)`);
  if (!share?.id) throw new Error('Missing pending folder share');

  const accepted = await api('POST', `/share/folders/${share.id}/accept`, { token: receiver.token });
  check('receiver accepts folder share', accepted.status === 200, `(HTTP ${accepted.status}: ${accepted.text?.slice(0, 160)})`);
  return data(accepted).sharedFolder;
}

async function testWritableShare() {
  log('\n=== Writable folder share, comments, replacement, restore ===');
  const owner = await registerAndAuthenticate('owner');
  const receiver = await registerAndAuthenticate('receiver');

  const initialContent = `SUPFILE writable initial ${RUN_ID}\nline=original\n`;
  const editedContent = `SUPFILE writable edited ${RUN_ID}\nline=modified-by-receiver\n`;

  const folder = await createFolder(owner, `e2e-writable-${RUN_ID}`);
  const file = await uploadText(owner, `shared-edit-${RUN_ID}.txt`, initialContent, { folderId: folder.id });

  await shareFolder(owner, receiver, folder.id, { canRead: true, canWrite: true });

  const pendingDownload = await downloadText(`/share/access/${file.id}/download`, receiver.token);
  check('pending share cannot download file', pendingDownload.status !== 200, `(HTTP ${pendingDownload.status})`);

  await acceptFolderShare(receiver, folder.id);

  const listed = await api('GET', `/files?folderId=${encodeURIComponent(folder.id)}&sortBy=createdAt&sortOrder=desc`, {
    token: receiver.token,
  });
  check('receiver lists shared folder contents', listed.status === 200, `(HTTP ${listed.status})`);
  const listedFiles = data(listed).files || [];
  const listedFile = listedFiles.find((entry) => entry.id === file.id);
  check('shared file appears in receiver folder listing', Boolean(listedFile), `(${listedFiles.length} files)`);
  check(
    'receiver listing exposes writable shared-folder permission',
    Boolean(listedFile?._sharedFolderPermissions?.canWrite ?? listedFile?._canWrite ?? listedFile?.canWrite),
  );

  const sharedDownload = await downloadText(`/share/access/${file.id}/download`, receiver.token);
  check('receiver downloads accepted shared file', sharedDownload.status === 200, `(HTTP ${sharedDownload.status})`);
  check('accepted shared download content matches initial', sharedDownload.text === initialContent);

  const comment = await api('POST', `/files/${file.id}/comments`, {
    token: receiver.token,
    json: { content: `receiver comment ${RUN_ID}` },
  });
  check('receiver creates comment on shared file', comment.status === 201, `(HTTP ${comment.status}: ${comment.text?.slice(0, 160)})`);
  const commentId = data(comment).comment?.id;
  check('comment id returned', Boolean(commentId));

  const updatedComment = await api('PUT', `/comments/${commentId}`, {
    token: receiver.token,
    json: { content: `receiver comment edited ${RUN_ID}` },
  });
  check('receiver edits own comment', updatedComment.status === 200, `(HTTP ${updatedComment.status}: ${updatedComment.text?.slice(0, 160)})`);

  const ownerComments = await api('GET', `/files/${file.id}/comments`, { token: owner.token });
  const comments = data(ownerComments).comments || [];
  check('owner reads comments on shared file', ownerComments.status === 200, `(HTTP ${ownerComments.status})`);
  check('owner sees edited receiver comment', comments.some((entry) => entry.content === `receiver comment edited ${RUN_ID}`));

  await uploadText(receiver, `shared-edit-${RUN_ID}.txt`, editedContent, { replaceFileId: file.id });

  const receiverAfterEdit = await downloadText(`/share/access/${file.id}/download`, receiver.token);
  check('receiver downloads edited shared file', receiverAfterEdit.status === 200, `(HTTP ${receiverAfterEdit.status})`);
  check('receiver sees edited content', receiverAfterEdit.text === editedContent);

  const ownerAfterEdit = await downloadText(`/files/${file.id}/download`, owner.token);
  check('owner downloads edited file', ownerAfterEdit.status === 200, `(HTTP ${ownerAfterEdit.status})`);
  check('owner sees receiver edit', ownerAfterEdit.text === editedContent);

  const versionsBeforeRestore = await api('GET', `/files/${file.id}/versions`, { token: owner.token });
  check('owner lists file versions', versionsBeforeRestore.status === 200, `(HTTP ${versionsBeforeRestore.status})`);
  const versions = data(versionsBeforeRestore).versions || [];
  check('at least one previous version exists', versions.length >= 1, `(${versions.length} versions)`);

  const originalVersion = versions[versions.length - 1] || versions[0];
  const restore = await api('POST', `/files/${file.id}/versions/${originalVersion.id}/restore`, { token: owner.token });
  check('owner restores original version', restore.status === 200, `(HTTP ${restore.status}: ${restore.text?.slice(0, 200)})`);

  const ownerAfterRestore = await downloadText(`/files/${file.id}/download`, owner.token);
  check('owner downloads restored file', ownerAfterRestore.status === 200, `(HTTP ${ownerAfterRestore.status})`);
  check('restored content matches initial', ownerAfterRestore.text === initialContent);

  const receiverAfterRestore = await downloadText(`/share/access/${file.id}/download`, receiver.token);
  check('receiver downloads restored shared file', receiverAfterRestore.status === 200, `(HTTP ${receiverAfterRestore.status})`);
  check('receiver sees restored content', receiverAfterRestore.text === initialContent);

  return { owner, receiver };
}

async function testReadOnlyShare(owner, receiver) {
  log('\n=== Read-only folder share denies replacement ===');
  const content = `SUPFILE readonly initial ${RUN_ID}\n`;
  const folder = await createFolder(owner, `e2e-readonly-${RUN_ID}`);
  const file = await uploadText(owner, `readonly-${RUN_ID}.txt`, content, { folderId: folder.id });

  await shareFolder(owner, receiver, folder.id, { canRead: true, canWrite: false });
  await acceptFolderShare(receiver, folder.id);

  const download = await downloadText(`/share/access/${file.id}/download`, receiver.token);
  check('read-only receiver can download', download.status === 200, `(HTTP ${download.status})`);
  check('read-only download content matches', download.text === content);

  const form = new FormData();
  form.append('files', new Blob([`bad write ${RUN_ID}`], { type: 'text/plain' }), `readonly-${RUN_ID}.txt`);
  form.append('replaceFileId', file.id);
  const replace = await api('POST', '/files/upload', { token: receiver.token, form });
  check('read-only receiver cannot replace file', ![200, 201, 207].includes(replace.status), `(HTTP ${replace.status})`);

  const after = await downloadText(`/files/${file.id}/download`, owner.token);
  check('owner file remains unchanged after denied replace', after.status === 200 && after.text === content, `(HTTP ${after.status})`);
}

async function cleanup() {
  if (KEEP_TEST_DATA) {
    info('KEEP_TEST_DATA=1 set, leaving test folders in place.');
    return;
  }
  for (const folder of state.createdFolders.reverse()) {
    try {
      await api('DELETE', `/folders/${folder.id}?permanent=true`, { token: folder.token });
      info(`cleanup folder ${folder.name}`);
    } catch (error) {
      info(`cleanup skipped for ${folder.name}: ${error.message}`);
    }
  }
}

async function main() {
  log(`SUPFILE share/versioning regression test`);
  log(`API: ${API}`);
  log(`RUN_ID: ${RUN_ID}`);

  try {
    const { owner, receiver } = await testWritableShare();
    await testReadOnlyShare(owner, receiver);
  } catch (error) {
    fail(`fatal error: ${error.stack || error.message}`);
  } finally {
    if (state.failed === 0) {
      await cleanup();
    } else {
      info('Failures detected, keeping generated data for inspection.');
    }
  }

  log(`\nResult: ${state.passed} passed, ${state.failed} failed`);
  if (state.failed > 0) {
    for (const error of state.errors) log(` - ${error}`);
    process.exit(1);
  }
}

main();
