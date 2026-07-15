CREATE TABLE "accounts" (
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "assistant_runs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"formation_id" text NOT NULL,
	"budget" integer NOT NULL,
	"use_full" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"masked_share" real NOT NULL,
	"engine_version" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	CONSTRAINT "datasets_user_kind" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"dataset_id" uuid NOT NULL,
	"row_id" text NOT NULL,
	"name" text NOT NULL,
	"age" integer,
	"positions" jsonb NOT NULL,
	"attrs" jsonb NOT NULL,
	"club" text,
	"nationality" text,
	"value" integer,
	"height_cm" integer,
	"foot" text,
	"scout_grade" text,
	CONSTRAINT "players_dataset_id_row_id_pk" PRIMARY KEY("dataset_id","row_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watch_entries" (
	"user_id" uuid NOT NULL,
	"identity_key" text NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_entries_user_id_identity_key_pk" PRIMARY KEY("user_id","identity_key")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_entries" ADD CONSTRAINT "watch_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;