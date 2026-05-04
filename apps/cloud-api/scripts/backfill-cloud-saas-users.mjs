import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const INVITE_CODE_LENGTH = 6;
const MIGRATION_NOTE_MARKER = "[saas_migration_backfill]";
const MIGRATION_NOTE = `${MIGRATION_NOTE_MARKER} Legacy cloud world migration grant`;
const MIGRATION_CREATED_BY = "saas-backfill-script";
const MIGRATION_DAYS = Number(process.env.SAAS_BACKFILL_DAYS || "30");

function resolveDatabasePath() {
  const configured = process.env.CLOUD_DATABASE_PATH?.trim();
  if (!configured) {
    return path.resolve(process.cwd(), "cloud-platform.sqlite");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function normalizeTimestamp(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

function generateInviteCode() {
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[randomIndex];
  }
  return code;
}

const databasePath = resolveDatabasePath();
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

const selectWorlds = db.prepare(`
  SELECT
    id,
    phone,
    name,
    createdAt,
    updatedAt,
    lastAccessedAt,
    lastInteractiveAt
  FROM cloud_worlds
  WHERE phone IS NOT NULL
    AND TRIM(phone) != ''
  ORDER BY datetime(createdAt) ASC, id ASC
`);

const selectUserByPhone = db.prepare(`
  SELECT id, phone, inviteCodeId, createdAt, updatedAt
  FROM cloud_users
  WHERE phone = ?
`);

const insertUser = db.prepare(`
  INSERT INTO cloud_users (
    id,
    phone,
    displayName,
    status,
    firstLoginAt,
    lastLoginAt,
    inviteCodeId,
    invitedByCodeId,
    invitedRewardGranted,
    registrationIp,
    registrationDeviceFingerprint,
    bannedReason,
    createdAt,
    updatedAt
  ) VALUES (
    @id,
    @phone,
    @displayName,
    @status,
    @firstLoginAt,
    @lastLoginAt,
    @inviteCodeId,
    @invitedByCodeId,
    @invitedRewardGranted,
    @registrationIp,
    @registrationDeviceFingerprint,
    @bannedReason,
    @createdAt,
    @updatedAt
  )
`);

const selectInviteCodeByOwner = db.prepare(`
  SELECT id, code
  FROM invite_codes
  WHERE ownerUserId = ?
`);

const selectInviteCodeById = db.prepare(`
  SELECT id, code
  FROM invite_codes
  WHERE id = ?
`);

const selectInviteCodeByCode = db.prepare(`
  SELECT id
  FROM invite_codes
  WHERE code = ?
`);

const insertInviteCode = db.prepare(`
  INSERT INTO invite_codes (
    id,
    code,
    ownerUserId,
    redeemCount,
    rewardDaysGranted,
    isActive,
    createdAt,
    updatedAt
  ) VALUES (
    @id,
    @code,
    @ownerUserId,
    @redeemCount,
    @rewardDaysGranted,
    @isActive,
    @createdAt,
    @updatedAt
  )
`);

const updateUserInviteCodeId = db.prepare(`
  UPDATE cloud_users
  SET inviteCodeId = ?, updatedAt = ?
  WHERE id = ?
`);

const selectMigrationGrant = db.prepare(`
  SELECT id
  FROM user_subscriptions
  WHERE userId = ?
    AND source = 'admin_grant'
    AND note LIKE ?
  LIMIT 1
`);

const selectLatestActiveSubscription = db.prepare(`
  SELECT expiresAt
  FROM user_subscriptions
  WHERE userId = ?
    AND status = 'active'
  ORDER BY datetime(expiresAt) DESC, id DESC
  LIMIT 1
`);

const insertSubscription = db.prepare(`
  INSERT INTO user_subscriptions (
    id,
    userId,
    planCode,
    source,
    status,
    startsAt,
    expiresAt,
    amountCents,
    externalOrderId,
    note,
    createdBy,
    createdAt,
    updatedAt
  ) VALUES (
    @id,
    @userId,
    @planCode,
    @source,
    @status,
    @startsAt,
    @expiresAt,
    @amountCents,
    @externalOrderId,
    @note,
    @createdBy,
    @createdAt,
    @updatedAt
  )
`);

const stats = {
  worlds: 0,
  usersCreated: 0,
  inviteCodesCreated: 0,
  invitePointersFixed: 0,
  subscriptionsGranted: 0,
  subscriptionsSkipped: 0,
};

const run = db.transaction(() => {
  const worlds = selectWorlds.all();
  stats.worlds = worlds.length;

  for (const world of worlds) {
    const baseTimestamp = normalizeTimestamp(
      world.lastInteractiveAt || world.lastAccessedAt || world.updatedAt || world.createdAt,
      new Date().toISOString(),
    );
    const createdAt = normalizeTimestamp(world.createdAt, baseTimestamp);
    const updatedAt = normalizeTimestamp(world.updatedAt, baseTimestamp);

    let user = selectUserByPhone.get(world.phone);
    if (!user) {
      const userId = randomUUID();
      insertUser.run({
        id: userId,
        phone: world.phone,
        displayName: world.name || null,
        status: "active",
        firstLoginAt: createdAt,
        lastLoginAt: baseTimestamp,
        inviteCodeId: null,
        invitedByCodeId: null,
        invitedRewardGranted: 0,
        registrationIp: null,
        registrationDeviceFingerprint: null,
        bannedReason: null,
        createdAt,
        updatedAt,
      });
      user = selectUserByPhone.get(world.phone);
      stats.usersCreated += 1;
    }

    let inviteCode =
      selectInviteCodeByOwner.get(user.id) ??
      (user.inviteCodeId ? selectInviteCodeById.get(user.inviteCodeId) : null);
    if (!inviteCode) {
      let nextCode = "";
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = generateInviteCode();
        if (!selectInviteCodeByCode.get(candidate)) {
          nextCode = candidate;
          break;
        }
      }
      if (!nextCode) {
        throw new Error(`Failed to allocate invite code for ${world.phone}.`);
      }
      inviteCode = {
        id: randomUUID(),
        code: nextCode,
      };
      insertInviteCode.run({
        id: inviteCode.id,
        code: inviteCode.code,
        ownerUserId: user.id,
        redeemCount: 0,
        rewardDaysGranted: 0,
        isActive: 1,
        createdAt,
        updatedAt,
      });
      stats.inviteCodesCreated += 1;
    }

    if (user.inviteCodeId !== inviteCode.id) {
      updateUserInviteCodeId.run(inviteCode.id, new Date().toISOString(), user.id);
      stats.invitePointersFixed += 1;
    }

    const existingGrant = selectMigrationGrant.get(
      user.id,
      `%${MIGRATION_NOTE_MARKER}%`,
    );
    if (existingGrant) {
      stats.subscriptionsSkipped += 1;
      continue;
    }

    const latestActive = selectLatestActiveSubscription.get(user.id);
    const startDate = latestActive?.expiresAt
      ? new Date(latestActive.expiresAt)
      : new Date();
    const expiresAt = new Date(
      startDate.getTime() + MIGRATION_DAYS * 24 * 60 * 60 * 1000,
    );
    const nowIso = new Date().toISOString();

    insertSubscription.run({
      id: randomUUID(),
      userId: user.id,
      planCode: "admin_grant",
      source: "admin_grant",
      status: "active",
      startsAt: startDate.toISOString(),
      expiresAt: expiresAt.toISOString(),
      amountCents: 0,
      externalOrderId: null,
      note: MIGRATION_NOTE,
      createdBy: MIGRATION_CREATED_BY,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    stats.subscriptionsGranted += 1;
  }
});

run();

console.log(
  JSON.stringify(
    {
      databasePath,
      migrationDays: MIGRATION_DAYS,
      ...stats,
    },
    null,
    2,
  ),
);
