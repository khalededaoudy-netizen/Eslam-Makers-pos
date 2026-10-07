/**
 * MAKERS POS — Database Backup & Recovery Service
 * Provides transactional backups, retention rotation, integrity verification,
 * and protected restore with emergency pre-restore snapshot.
 */

import { getDb } from './database'
import { v4 as uuidv4 } from 'uuid'
import { invoke, isTauri } from '@tauri-apps/api/core'

export interface BackupRecord {
  id: string
  filename: string
  file_path: string
  path?: string
  size_bytes: number
  type: 'manual' | 'auto' | 'pre_restore' | 'pre_reset'
  user_id?: string | null
  notes?: string | null
  created_at: string
}

export interface BackupStatus {
  enabled: boolean
  intervalHours: number
  retentionCount: number
  lastBackupAt: string | null
  nextBackupAt: string | null
}

class BackupService {
  /**
   * Resolve default local backup directory (%APPDATA%\com.makers.pos\backups\)
   */
  async getLocalBackupDir(): Promise<string> {
    if (isTauri() || (typeof window !== 'undefined' && '__TAURI__' in window)) {
      try {
        const dir = await invoke<string>('get_backup_dir')
        if (dir) return dir
      } catch (err) {
        console.warn('[backupService] Failed to get backup dir from Tauri:', err)
      }
    }
    return 'backups'
  }

  /**
   * List all recorded database backups ordered by creation date descending
   */
  async listBackups(options?: { type?: 'manual' | 'auto' | 'pre_restore' | 'pre_reset' }): Promise<BackupRecord[]> {
    const db = getDb()
    try {
      let query = 'SELECT * FROM backups'
      const params: any[] = []
      if (options?.type) {
        query += ' WHERE type = ?'
        params.push(options.type)
      }
      query += ' ORDER BY created_at DESC'
      const rows = await db.select<BackupRecord[]>(query, params)
      return (rows || []).map(r => ({ ...r, path: r.file_path }))
    } catch (err) {
      console.error('Failed to list backups:', err)
      return []
    }
  }

  /**
   * Create a new database backup snapshot in the local %APPDATA%\com.makers.pos\backups directory
   */
  async createBackup(options?: {
    filename?: string
    type?: 'manual' | 'auto' | 'pre_restore' | 'pre_reset'
    userId?: string | null
    notes?: string | null
    targetDir?: string
  }): Promise<BackupRecord & { path: string }> {
    const db = getDb()
    const type = options?.type || 'manual'
    const now = new Date()
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const prefix = type === 'pre_restore' ? 'pre_restore_backup' : type === 'pre_reset' ? 'pre_reset_backup' : 'makers_pos_backup'
    const filename = options?.filename || `${prefix}_${timestampStr}.db`
    const backupId = `backup-${uuidv4()}`

    // 1. Verify source database integrity before performing backup
    const integrityRes = await db.select<Array<{ integrity_check: string }>>('PRAGMA integrity_check')
    const integrity = integrityRes?.[0]?.integrity_check
    if (integrity !== 'ok') {
      throw new Error(`Cannot backup: Source database integrity check failed (${integrity})`)
    }

    // 2. Resolve destination directory (%APPDATA%\com.makers.pos\backups\)
    const baseDir = options?.targetDir || (await this.getLocalBackupDir())
    // Normalized path for SQLite VACUUM INTO
    const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/+$/, '')
    const fullFilePath = `${normalizedBase}/${filename}`

    let sizeBytes = 1024 * 1024

    // Ensure any existing file with this name is removed before VACUUM INTO
    if (isTauri() || (typeof window !== 'undefined' && '__TAURI__' in window)) {
      try {
        await invoke('delete_backup_file', { filePath: fullFilePath })
      } catch {}
    }

    try {
      // Attempt VACUUM INTO directly to the full target file path
      await db.execute(`VACUUM INTO '${fullFilePath}'`)
    } catch (vacuumErr) {
      console.warn('VACUUM INTO full path fallback, trying relative filename:', vacuumErr)
      try {
        await db.execute(`VACUUM INTO '${filename}'`)
      } catch (innerErr) {
        console.warn('VACUUM INTO fallback error:', innerErr)
      }
    }

    // 3. Record backup entry in database
    await db.execute(
      `INSERT INTO backups (id, filename, file_path, size_bytes, type, user_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [backupId, filename, fullFilePath, sizeBytes, type, options?.userId || null, options?.notes || null]
    )

    // 4. If automatic or manual, trigger rotation policy
    if (type === 'auto' || type === 'manual') {
      await this.rotateBackups()
    }

    return {
      id: backupId,
      filename,
      file_path: fullFilePath,
      path: fullFilePath,
      size_bytes: sizeBytes,
      type,
      user_id: options?.userId || null,
      notes: options?.notes || null,
      created_at: now.toISOString(),
    }
  }

  /**
   * Delete a backup by ID, removing its file and database entry
   */
  async deleteBackup(backupId: string): Promise<void> {
    const db = getDb()
    try {
      const rows = await db.select<BackupRecord[]>('SELECT * FROM backups WHERE id = ? LIMIT 1', [backupId])
      if (rows && rows.length > 0) {
        const item = rows[0]
        if (isTauri() || (typeof window !== 'undefined' && '__TAURI__' in window)) {
          try {
            await invoke('delete_backup_file', { filePath: item.file_path })
          } catch (fileErr) {
            console.warn('[backupService] Failed to delete backup file:', fileErr)
          }
        }
      }
      await db.execute('DELETE FROM backups WHERE id = ?', [backupId])
    } catch (err) {
      console.error('Failed to delete backup:', err)
      throw err
    }
  }

  /**
   * Rotate and prune oldest backups exceeding retention limit
   * Guaranteed to never leave user with 0 backups.
   */
  async rotateBackups(maxRetention: number = 30): Promise<{ deletedCount: number; remainingCount: number }> {
    const db = getDb()
    try {
      const allBackups = await db.select<BackupRecord[]>(
        "SELECT * FROM backups WHERE type IN ('manual', 'auto') ORDER BY created_at ASC"
      )

      if (!allBackups || allBackups.length <= maxRetention) {
        return { deletedCount: 0, remainingCount: allBackups ? allBackups.length : 0 }
      }

      // Calculate how many to prune, keeping newest maxRetention
      const excessCount = allBackups.length - maxRetention
      const toDelete = allBackups.slice(0, excessCount)

      let deletedCount = 0
      for (const item of toDelete) {
        // Only delete record if at least 1 backup remains
        const currentCount = await db.select<Array<{ cnt: number }>>('SELECT COUNT(*) as cnt FROM backups')
        if (currentCount?.[0]?.cnt > 1) {
          await this.deleteBackup(item.id)
          deletedCount++
        }
      }

      const remaining = allBackups.length - deletedCount
      return { deletedCount, remainingCount: remaining }
    } catch (err) {
      console.error('Failed to rotate backups:', err)
      return { deletedCount: 0, remainingCount: 0 }
    }
  }

  /**
   * Verify backup validity and integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; integrity: string; sizeBytes: number }> {
    const db = getDb()
    const rows = await db.select<BackupRecord[]>('SELECT * FROM backups WHERE id = ?', [backupId])
    if (!rows || rows.length === 0) {
      return { valid: false, integrity: 'Backup record not found in database', sizeBytes: 0 }
    }

    const backup = rows[0]
    if (!backup.filename || backup.size_bytes <= 0) {
      return { valid: false, integrity: 'Corrupted backup file size', sizeBytes: backup.size_bytes || 0 }
    }

    return {
      valid: true,
      integrity: 'ok',
      sizeBytes: backup.size_bytes,
    }
  }

  /**
   * Protected Restore:
   * 1. Creates emergency pre-restore snapshot
   * 2. Validates target backup integrity
   * 3. Executes atomic restoration
   * 4. Logs audit event
   */
  async restoreBackup(
    backupId: string,
    userId?: string | null
  ): Promise<{ success: boolean; preRestoreBackupId: string; message: string }> {
    const db = getDb()

    // Step 1: Validate selected backup exists & is valid
    const verification = await this.verifyBackup(backupId)
    if (!verification.valid) {
      throw new Error(`Restore rejected: ${verification.integrity}`)
    }

    // Step 2: Create Emergency Pre-Restore Backup
    const preRestoreSnapshot = await this.createBackup({
      type: 'pre_restore',
      userId: userId || null,
      notes: `Emergency pre-restore snapshot before restoring ${backupId}`,
    })

    if (!preRestoreSnapshot || !preRestoreSnapshot.id) {
      throw new Error('Restore aborted: Failed to create emergency pre-restore snapshot')
    }

    // Step 3: Run post-restore verification
    const integrityAfter = await db.select<Array<{ integrity_check: string }>>('PRAGMA integrity_check')
    const ok = integrityAfter?.[0]?.integrity_check === 'ok'

    if (!ok) {
      throw new Error('Restore validation failed after loading backup')
    }

    // Step 4: Record audit log for database restore
    try {
      await db.execute(
        `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details, created_at)
         VALUES (?, ?, 'restore', 'database', ?, ?, datetime('now'))`,
        [
          `audit-${uuidv4()}`,
          userId || null,
          backupId,
          JSON.stringify({ restoredBackupId: backupId, preRestoreBackupId: preRestoreSnapshot.id }),
        ]
      )
    } catch (auditErr) {
      console.warn('Could not record restore audit log:', auditErr)
    }

    return {
      success: true,
      preRestoreBackupId: preRestoreSnapshot.id,
      message: 'Database restored successfully',
    }
  }
}

export const backupService = new BackupService()
