// Archivo generado por scripts/embed-migrations.mjs — no editar a mano.
export const MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    "id": "0000_init",
    "statements": [
      "CREATE TABLE IF NOT EXISTS `account` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`account_id` text NOT NULL,\n\t`provider_id` text NOT NULL,\n\t`user_id` text NOT NULL,\n\t`access_token` text,\n\t`refresh_token` text,\n\t`id_token` text,\n\t`access_token_expires_at` integer,\n\t`refresh_token_expires_at` integer,\n\t`scope` text,\n\t`password` text,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `account_userId_idx` ON `account` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `admin_audit` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`actor_user_id` text NOT NULL,\n\t`actor_name` text NOT NULL,\n\t`action` text NOT NULL,\n\t`target_user_id` text,\n\t`summary` text NOT NULL,\n\t`detail` text,\n\t`created_at` integer NOT NULL\n);",
      "CREATE INDEX IF NOT EXISTS `audit_created_idx` ON `admin_audit` (`created_at`);",
      "CREATE INDEX IF NOT EXISTS `audit_target_idx` ON `admin_audit` (`target_user_id`,`created_at`);",
      "CREATE TABLE IF NOT EXISTS `admin_member` (\n\t`email` text PRIMARY KEY NOT NULL,\n\t`added_by` text NOT NULL,\n\t`added_at` integer NOT NULL,\n\t`note` text\n);",
      "CREATE TABLE IF NOT EXISTS `app_meta` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `company_profile` (\n\t`user_id` text PRIMARY KEY NOT NULL,\n\t`company_name` text NOT NULL,\n\t`nit` text NOT NULL,\n\t`full_name` text NOT NULL,\n\t`doc_type` text NOT NULL,\n\t`doc_number` text NOT NULL,\n\t`phone` text NOT NULL,\n\t`city` text NOT NULL,\n\t`terms_version` text,\n\t`terms_accepted_at` integer,\n\t`created_at` integer NOT NULL,\n\t`updated_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE TABLE IF NOT EXISTS `customer_email` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`subject` text NOT NULL,\n\t`status` text NOT NULL,\n\t`attempts` integer DEFAULT 1 NOT NULL,\n\t`error` text,\n\t`created_at` integer NOT NULL,\n\t`sent_at` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `customer_email_user_idx` ON `customer_email` (`user_id`,`created_at`);",
      "CREATE TABLE IF NOT EXISTS `data_request` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`status` text NOT NULL,\n\t`reason` text,\n\t`created_at` integer NOT NULL,\n\t`due_at` integer NOT NULL,\n\t`resolved_at` integer,\n\t`resolution` text,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `data_request_user_idx` ON `data_request` (`user_id`);",
      "CREATE INDEX IF NOT EXISTS `data_request_status_idx` ON `data_request` (`status`);",
      "CREATE TABLE IF NOT EXISTS `farm` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`location` text NOT NULL,\n\t`capacity_th` real DEFAULT 30000 NOT NULL,\n\t`sats_per_th_day` real DEFAULT 42 NOT NULL,\n\t`plan_prices` text DEFAULT '{}' NOT NULL,\n\t`updated_at` integer\n);",
      "CREATE TABLE IF NOT EXISTS `job_state` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`lock_token` text NOT NULL,\n\t`locked_until` integer NOT NULL,\n\t`cursor` text,\n\t`updated_at` integer NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `ledger_tx` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`status` text NOT NULL,\n\t`amount_cop` integer NOT NULL,\n\t`asset` text,\n\t`asset_amount` real,\n\t`network` text,\n\t`chain_id` integer,\n\t`wallet_address` text,\n\t`wallet_name` text,\n\t`message` text,\n\t`signature` text,\n\t`tx_hash` text,\n\t`note` text,\n\t`created_at` integer NOT NULL,\n\t`confirmed_at` integer,\n\t`method` text,\n\t`provider_id` text,\n\t`provider_status` text,\n\t`expected_amount` text,\n\t`expires_at` integer,\n\t`subscription_id` text,\n\t`period_index` integer,\n\t`hashrate_th` real,\n\t`amount_sats` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `tx_user_idx` ON `ledger_tx` (`user_id`,`created_at`);",
      "CREATE INDEX IF NOT EXISTS `tx_method_status_idx` ON `ledger_tx` (`method`,`status`);",
      "CREATE INDEX IF NOT EXISTS `tx_subscription_idx` ON `ledger_tx` (`subscription_id`);",
      "CREATE INDEX IF NOT EXISTS `tx_kind_created_idx` ON `ledger_tx` (`kind`,`created_at`);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `tx_provider_uq` ON `ledger_tx` (`method`,`provider_id`);",
      "CREATE TABLE IF NOT EXISTS `payment_review` (\n\t`payment_id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`subscription_id` text NOT NULL,\n\t`occurred_at` integer NOT NULL,\n\t`reason` text NOT NULL,\n\t`resolved_at` integer,\n\t`resolution_reference` text,\n\tFOREIGN KEY (`payment_id`) REFERENCES `ledger_tx`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `payment_review_user_idx` ON `payment_review` (`user_id`,`resolved_at`);",
      "CREATE TABLE IF NOT EXISTS `plan_period` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`subscription_id` text NOT NULL,\n\t`idx` integer NOT NULL,\n\t`starts_at` integer NOT NULL,\n\t`ends_at` integer NOT NULL,\n\t`hashrate_th` real NOT NULL,\n\t`sats_per_th_day` real NOT NULL,\n\t`amount_cop` integer NOT NULL,\n\t`tx_id` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `plan_period_sub_idx_uq` ON `plan_period` (`subscription_id`,`idx`);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `plan_period_tx_uq` ON `plan_period` (`tx_id`);",
      "CREATE TABLE IF NOT EXISTS `plan_subscription` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`plan_id` text NOT NULL,\n\t`plan_name` text NOT NULL,\n\t`hashrate_th` real NOT NULL,\n\t`months` integer NOT NULL,\n\t`price_cop_per_th_month` integer NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`started_at` integer,\n\t`cancelled_at` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE INDEX IF NOT EXISTS `plan_sub_user_idx` ON `plan_subscription` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `service_setting` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL,\n\t`updated_at` integer NOT NULL\n);",
      "CREATE TABLE IF NOT EXISTS `session` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`token` text NOT NULL,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer NOT NULL,\n\t`ip_address` text,\n\t`user_agent` text,\n\t`user_id` text NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);",
      "CREATE INDEX IF NOT EXISTS `session_userId_idx` ON `session` (`user_id`);",
      "CREATE TABLE IF NOT EXISTS `user` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`email` text NOT NULL,\n\t`email_verified` integer DEFAULT false NOT NULL,\n\t`image` text,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL\n);",
      "CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);",
      "CREATE TABLE IF NOT EXISTS `verification` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`identifier` text NOT NULL,\n\t`value` text NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n\t`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL\n);",
      "CREATE INDEX IF NOT EXISTS `verification_identifier_idx` ON `verification` (`identifier`);",
      "CREATE TABLE IF NOT EXISTS `wallet_link` (\n\t`user_id` text PRIMARY KEY NOT NULL,\n\t`address` text NOT NULL,\n\t`wallet_name` text NOT NULL,\n\t`chain_id` integer,\n\t`connected_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n);"
    ]
  },
  {
    "id": "0001_rate_limit",
    "statements": [
      "-- Contadores de rate limiting persistentes en BD (funcionan entre instancias de Vercel).\nCREATE TABLE IF NOT EXISTS `rate_limit` (\n\t`rl_key` text NOT NULL,\n\t`window_start` integer NOT NULL,\n\t`count` integer NOT NULL DEFAULT 1,\n\tPRIMARY KEY(`rl_key`, `window_start`)\n);",
      "CREATE INDEX IF NOT EXISTS `rate_limit_key_idx` ON `rate_limit` (`rl_key`);"
    ]
  }
];
