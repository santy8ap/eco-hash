CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`summary` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `admin_audit` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_member` (
	`email` text PRIMARY KEY NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`nit` text NOT NULL,
	`full_name` text NOT NULL,
	`doc_type` text NOT NULL,
	`doc_number` text NOT NULL,
	`phone` text NOT NULL,
	`city` text NOT NULL,
	`terms_version` text,
	`terms_accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customer_email` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_email_user_idx` ON `customer_email` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `data_request` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`resolved_at` integer,
	`resolution` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_request_user_idx` ON `data_request` (`user_id`);--> statement-breakpoint
CREATE INDEX `data_request_status_idx` ON `data_request` (`status`);--> statement-breakpoint
CREATE TABLE `farm` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`capacity_th` real DEFAULT 30000 NOT NULL,
	`sats_per_th_day` real DEFAULT 42 NOT NULL,
	`plan_prices` text DEFAULT '{}' NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `job_state` (
	`id` text PRIMARY KEY NOT NULL,
	`lock_token` text NOT NULL,
	`locked_until` integer NOT NULL,
	`cursor` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_tx` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`amount_cop` integer NOT NULL,
	`asset` text,
	`asset_amount` real,
	`network` text,
	`chain_id` integer,
	`wallet_address` text,
	`wallet_name` text,
	`message` text,
	`signature` text,
	`tx_hash` text,
	`note` text,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	`method` text,
	`provider_id` text,
	`provider_status` text,
	`expected_amount` text,
	`expires_at` integer,
	`subscription_id` text,
	`period_index` integer,
	`hashrate_th` real,
	`amount_sats` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tx_user_idx` ON `ledger_tx` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tx_method_status_idx` ON `ledger_tx` (`method`,`status`);--> statement-breakpoint
CREATE INDEX `tx_subscription_idx` ON `ledger_tx` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `tx_kind_created_idx` ON `ledger_tx` (`kind`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_provider_uq` ON `ledger_tx` (`method`,`provider_id`);--> statement-breakpoint
CREATE TABLE `payment_review` (
	`payment_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reason` text NOT NULL,
	`resolved_at` integer,
	`resolution_reference` text,
	FOREIGN KEY (`payment_id`) REFERENCES `ledger_tx`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_review_user_idx` ON `payment_review` (`user_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `plan_period` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`idx` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`hashrate_th` real NOT NULL,
	`sats_per_th_day` real NOT NULL,
	`amount_cop` integer NOT NULL,
	`tx_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `plan_subscription`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_period_sub_idx_uq` ON `plan_period` (`subscription_id`,`idx`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_period_tx_uq` ON `plan_period` (`tx_id`);--> statement-breakpoint
CREATE TABLE `plan_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`hashrate_th` real NOT NULL,
	`months` integer NOT NULL,
	`price_cop_per_th_month` integer NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_sub_user_idx` ON `plan_subscription` (`user_id`);--> statement-breakpoint
CREATE TABLE `service_setting` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `wallet_link` (
	`user_id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`wallet_name` text NOT NULL,
	`chain_id` integer,
	`connected_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
