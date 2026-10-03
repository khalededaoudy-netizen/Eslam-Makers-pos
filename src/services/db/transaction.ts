/**
 * MAKERS POS — Database Transaction Manager
 * Robust concurrency serializer, lock queue, and atomic native transaction manager.
 */

import { invoke, isTauri } from '@tauri-apps/api/core'
import { AppDatabase, getDb } from './database'

let txActive = false
let txQueue = Promise.resolve()

export function isTransactionActive(): boolean {
  return txActive
}

interface TransactionStatement {
  sql: string
  values: unknown[]
}

interface TransactionResult {
  success: boolean
  rows_affected: number
}

/**
 * Serializes database write operations and executes atomic native SQLite transactions
 * to prevent SQLITE_BUSY / database is locked contention across asynchronous callers.
 */
export async function withTransaction<T>(
  dbOrFn: AppDatabase | ((d: AppDatabase) => Promise<T>),
  maybeFn?: (d: AppDatabase) => Promise<T>
): Promise<T> {
  const d: AppDatabase = typeof dbOrFn === 'function' ? getDb() : dbOrFn
  const fn: (d: AppDatabase) => Promise<T> = typeof dbOrFn === 'function' ? dbOrFn : maybeFn!

  const runTx = async (): Promise<T> => {
    txActive = true
    const recordedStatements: TransactionStatement[] = []

    // Transactional proxy database that records all write operations
    const txDb: AppDatabase = {
      execute: async (query: string, bindValues?: unknown[]) => {
        recordedStatements.push({
          sql: query,
          values: bindValues || [],
        })
        return { lastInsertId: 1, rowsAffected: 1 }
      },
      select: async <R>(query: string, bindValues?: unknown[]): Promise<R> => {
        // Reads during transaction go through the main database connection
        return await d.select<R>(query, bindValues)
      },
    }

    try {
      // Execute the business logic callback to collect all transactional mutations
      const result = await fn(txDb)

      // Commit all recorded statements atomically in a single native SQLite transaction
      if (recordedStatements.length > 0) {
        if (isTauri() || (typeof window !== 'undefined' && '__TAURI__' in window)) {
          await invoke<TransactionResult>('execute_sql_transaction', {
            statements: recordedStatements,
          })
        } else {
          // Browser mock mode: execute sequentially on mock DB
          for (const stmt of recordedStatements) {
            await d.execute(stmt.sql, stmt.values)
          }
        }
      }

      txActive = false
      return result
    } catch (err) {
      txActive = false
      throw err
    }
  }

  const resultPromise = txQueue.then(runTx, runTx)
  txQueue = resultPromise.then(() => {}, () => {})
  return resultPromise
}


