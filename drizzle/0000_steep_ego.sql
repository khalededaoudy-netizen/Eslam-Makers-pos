CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_full_name` text,
	`action` text NOT NULL,
	`resource` text,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`file_path` text NOT NULL,
	`size_bytes` integer,
	`type` text DEFAULT 'manual' NOT NULL,
	`user_id` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `barcode_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product_id` text,
	`config` text NOT NULL,
	`printed_at` text,
	`print_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_registers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ar` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`phone2` text,
	`email` text,
	`address` text,
	`notes` text,
	`balance` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`icon` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`shift_id` text,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`affects_cash` integer DEFAULT true NOT NULL,
	`recorded_by_id` text,
	`receipt_path` text,
	`expense_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`stock_before` real NOT NULL,
	`stock_after` real NOT NULL,
	`reference_id` text,
	`reference_type` text,
	`reason` text,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kit_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`notes` text,
	FOREIGN KEY (`kit_id`) REFERENCES `kits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kits` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`sku` text NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`method` text NOT NULL,
	`amount` real NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`allowed` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_attribute_defs` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`unit` text,
	`category_id` text,
	`data_type` text DEFAULT 'text' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_attribute_values` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`attribute_id` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attribute_id`) REFERENCES `product_attribute_defs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`barcode` text NOT NULL,
	`type` text DEFAULT 'code128' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_printed` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`parent_id` text,
	`description` text,
	`color` text,
	`icon` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_units` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`symbol` text NOT NULL,
	`allow_decimal` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`description` text,
	`description_ar` text,
	`category_id` text,
	`unit_id` text NOT NULL,
	`brand_id` text,
	`default_supplier_id` text,
	`purchase_price` real DEFAULT 0 NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`current_stock` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`image_path` text,
	`is_active` integer DEFAULT true NOT NULL,
	`drawer_location` text,
	`footprint_package` text,
	`datasheet_url` text,
	`source_type` text DEFAULT 'LOCAL' NOT NULL,
	`external_product_id` text,
	`external_sku` text,
	`external_url` text,
	`website_price` real,
	`last_synced_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` real NOT NULL,
	`subtotal` real NOT NULL,
	`received_qty` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_number` text NOT NULL,
	`supplier_id` text,
	`received_by_id` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`invoice_ref` text,
	`notes` text,
	`purchased_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL,
	`sale_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`subtotal` real NOT NULL,
	`reason` text,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_number` text NOT NULL,
	`sale_id` text NOT NULL,
	`processed_by_id` text NOT NULL,
	`reason` text,
	`total_refund` real DEFAULT 0 NOT NULL,
	`refund_method` text DEFAULT 'cash' NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`display_name_ar` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`cost_price` real NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`discount_pct` real DEFAULT 0 NOT NULL,
	`subtotal` real NOT NULL,
	`profit` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`shift_id` text,
	`cashier_id` text NOT NULL,
	`customer_id` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`discount_pct` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`change_amount` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`category` text DEFAULT 'general' NOT NULL,
	`description` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`closing_balance` real,
	`expected_balance` real,
	`difference` real,
	`cash_sales` real DEFAULT 0 NOT NULL,
	`cash_refunds` real DEFAULT 0 NOT NULL,
	`cash_expenses` real DEFAULT 0 NOT NULL,
	`cash_withdrawals` real DEFAULT 0 NOT NULL,
	`cash_deposits` real DEFAULT 0 NOT NULL,
	`notes` text,
	`opened_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`closed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`phone2` text,
	`email` text,
	`address` text,
	`tax_number` text,
	`notes` text,
	`balance` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`full_name_ar` text,
	`email` text,
	`phone` text,
	`role_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`avatar_path` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_date_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE INDEX `inv_mov_product_idx` ON `inventory_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `inv_mov_type_idx` ON `inventory_movements` (`type`);--> statement-breakpoint
CREATE INDEX `inv_mov_date_idx` ON `inventory_movements` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `kits_sku_unique` ON `kits` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `perm_role_resource_action` ON `permissions` (`role_id`,`resource`,`action`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_attr_unique` ON `product_attribute_values` (`product_id`,`attribute_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_barcodes_barcode_unique` ON `product_barcodes` (`barcode`);--> statement-breakpoint
CREATE INDEX `barcodes_barcode_idx` ON `product_barcodes` (`barcode`);--> statement-breakpoint
CREATE INDEX `barcodes_product_idx` ON `product_barcodes` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_active_idx` ON `products` (`is_active`);--> statement-breakpoint
CREATE INDEX `products_ext_prod_id_idx` ON `products` (`external_product_id`);--> statement-breakpoint
CREATE INDEX `products_ext_sku_idx` ON `products` (`external_sku`);--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `purchase_items_product_idx` ON `purchase_items` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_purchase_number_unique` ON `purchases` (`purchase_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `returns_return_number_unique` ON `returns` (`return_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoice_number_unique` ON `sales` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `sales_invoice_idx` ON `sales` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_cashier_idx` ON `sales` (`cashier_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);