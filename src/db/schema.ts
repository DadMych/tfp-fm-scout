import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { AttrVector } from "../domain/attr-value.js";
import type { PlayerFlag } from "../domain/player.js";
import type { PositionSlot } from "../domain/positions.js";

/** Contract/loan/status extras carried as one jsonb blob — schema stays stable as FM exports grow. */
export interface PlayerMeta {
  readonly wage?: number;
  readonly contractExpires?: string;
  readonly onLoanFrom?: string;
  readonly loanEnd?: string;
  readonly lastTransferFee?: number;
  readonly flags?: readonly PlayerFlag[];
  readonly playStyle?: string;
}

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Auth.js OAuth provider rows (Google, etc.). */
export const accounts = pgTable(
  "accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["shortlist", "squad"] }).notNull(),
    label: text("label").notNull(),
    source: text("source").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
    maskedShare: real("masked_share").notNull(),
    engineVersion: text("engine_version").notNull(),
    status: text("status", { enum: ["ready", "failed"] }).notNull().default("ready"),
  },
  (t) => ({
    userKind: unique("datasets_user_kind").on(t.userId, t.kind),
  }),
);

export const players = pgTable(
  "players",
  {
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    rowId: text("row_id").notNull(),
    name: text("name").notNull(),
    age: integer("age"),
    positions: jsonb("positions").$type<readonly PositionSlot[]>().notNull(),
    attrs: jsonb("attrs").$type<AttrVector>().notNull(),
    club: text("club"),
    nationality: text("nationality"),
    value: integer("value"),
    heightCm: integer("height_cm"),
    foot: text("foot"),
    scoutGrade: text("scout_grade"),
    meta: jsonb("meta").$type<PlayerMeta>(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.datasetId, t.rowId] }),
  }),
);

export const watchEntries = pgTable(
  "watch_entries",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    identityKey: text("identity_key").notNull(),
    status: text("status", { enum: ["watching", "pursue", "passed"] }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.identityKey] }),
  }),
);

export const assistantRuns = pgTable("assistant_runs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  formationId: text("formation_id").notNull(),
  budget: integer("budget").notNull(),
  useFull: boolean("use_full").notNull(),
  squadCap: integer("squad_cap").notNull().default(25),
});
