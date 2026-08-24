-- AlterTable
ALTER TABLE `locations` ADD COLUMN `cashRoundingIncrement` DECIMAL(4, 2) NULL,
    ADD COLUMN `currencySymbol` VARCHAR(191) NOT NULL DEFAULT '₱',
    ADD COLUMN `receiptFooterText` TEXT NULL,
    ADD COLUMN `receiptLogoUrl` VARCHAR(191) NULL;
