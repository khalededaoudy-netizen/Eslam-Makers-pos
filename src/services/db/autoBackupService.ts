import { backupService } from './backupService';
import { settingsService } from '../settings/settingsService';
import { invoke } from '@tauri-apps/api/core';
import { logger } from './loggerService';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BACKUP_INTERVAL_HOURS = 24;
const MAX_LOCAL_BACKUPS = 30;

class AutoBackupService {
  private timer: number | null = null;
  private running = false;

  async start() {
    logger.info('[AutoBackup] Service started');
    await this.runIfDue();
    this.timer = window.setInterval(() => this.runIfDue(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runIfDue() {
    if (this.running) return;
    this.running = true;

    try {
      const enabled = await settingsService.get('auto_backup_enabled', '1');
      if (enabled === '0' || enabled === 'false') return;

      const lastBackupAt = await settingsService.get('last_auto_backup_at');
      const hoursSince = lastBackupAt
        ? (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60)
        : Infinity;

      const intervalSetting = await settingsService.get('backup_interval_hours', '24');
      const intervalHours = Number(intervalSetting) || BACKUP_INTERVAL_HOURS;

      if (hoursSince < intervalHours) return;

      await this.createBackup();
    } catch (err) {
      logger.error('[AutoBackup] Failed', { error: String(err) });
    } finally {
      this.running = false;
    }
  }

  async createBackup(): Promise<{ success: boolean; path?: string; secondary?: string }> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `auto_backup_${timestamp}.db`;

    // 1. Local backup (always)
    const localResult = await backupService.createBackup({
      filename,
      type: 'auto',
      notes: 'Automatic daily backup',
    });

    logger.info('[AutoBackup] Local backup created', { path: localResult.path });

    // 2. Secondary backup (if configured)
    const secondaryPath = await settingsService.get('secondary_backup_path');
    let secondaryResult: string | undefined;

    if (secondaryPath) {
      try {
        // Check if path is accessible
        const accessible = await invoke<boolean>('check_path_accessible', {
          path: secondaryPath,
        });

        if (accessible) {
          // Copy from local to secondary
          const destPath = await invoke<string>('copy_backup_to_secondary', {
            sourcePath: localResult.path,
            secondaryDir: secondaryPath,
            filename,
          });
          secondaryResult = destPath;
          logger.info('[AutoBackup] Secondary backup created', { path: destPath });
        } else {
          logger.warn('[AutoBackup] Secondary path not accessible', { path: secondaryPath });
        }
      } catch (err) {
        // Do NOT fail local backup if secondary fails
        logger.warn('[AutoBackup] Secondary backup failed', {
          error: String(err),
          path: secondaryPath,
        });
      }
    }

    // 3. Update last backup time
    await settingsService.set('last_auto_backup_at', new Date().toISOString());

    // 4. Cleanup old backups (local only)
    await this.cleanupOldBackups();

    return { success: true, path: localResult.path, secondary: secondaryResult };
  }

  private async cleanupOldBackups() {
    const retentionSetting = await settingsService.get('backup_retention_count', '30');
    const retentionCount = Number(retentionSetting) || MAX_LOCAL_BACKUPS;

    const backups = await backupService.listBackups({ type: 'auto' });
    if (backups.length <= retentionCount) return;

    const sorted = backups.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const toDelete = sorted.slice(0, sorted.length - retentionCount);
    for (const backup of toDelete) {
      await backupService.deleteBackup(backup.id);
      logger.info('[AutoBackup] Deleted old backup', { file: backup.filename });
    }
  }
}

export const autoBackupService = new AutoBackupService();
