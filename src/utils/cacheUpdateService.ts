/**
 * Cache Update Service
 * Decouples cache management from sync service
 * Provides batch operations for efficient cache updates
 */

import { offlineStorage } from './offlineStorage';
import { IdMappingUpdate } from './idMappingService';
import { logger } from './logger';

export interface CacheUpdateResult {
  success: boolean;
  updatedClients: number;
  updatedReceipts: number;
  removedTempEntries: number;
  errors: string[];
}

interface CacheUpdateConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

class CacheUpdateService {
  private config: CacheUpdateConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 50,
  };

  private isUpdating = false;
  private updateQueue: Array<() => Promise<void>> = [];

  /**
   * Updates cache data with retry logic
   */
  async updateCache(
    operation: () => Promise<void>,
    context: string
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.config.maxRetries) {
      try {
        await operation();
        logger.debug('Cache update successful', undefined, {
          component: 'CacheUpdateService',
          operation: 'updateCache',
          extra: { context, attempts: attempts + 1 },
        });
        return;
      } catch (error) {
        attempts++;

        if (attempts >= this.config.maxRetries) {
          logger.error('Cache update failed after max retries', error, {
            component: 'CacheUpdateService',
            operation: 'updateCache',
            extra: {
              context,
              maxRetries: this.config.maxRetries,
              finalAttempt: attempts,
            },
          });
          throw error;
        }

        // Wait before retry
        logger.warn('Cache update failed, retrying...', error, {
          component: 'CacheUpdateService',
          operation: 'updateCache',
          extra: {
            context,
            attempt: attempts,
            nextRetryIn: this.config.retryDelay,
          },
        });

        await this.delay(this.config.retryDelay * attempts);
      }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Queues a cache update operation
   */
  queueUpdate(operation: () => Promise<void>): void {
    this.updateQueue.push(operation);

    if (!this.isUpdating) {
      this.processQueue();
    }
  }

  /**
   * Processes the update queue
   */
  private async processQueue(): Promise<void> {
    if (this.isUpdating || this.updateQueue.length === 0) {
      return;
    }

    this.isUpdating = true;

    logger.info('Processing cache update queue', {
      component: 'CacheUpdateService',
      operation: 'processQueue',
      extra: { queueLength: this.updateQueue.length },
    });

    while (this.updateQueue.length > 0) {
      const batch = this.updateQueue.splice(0, this.config.batchSize);

      try {
        await Promise.all(
          batch.map(operation => this.updateCache(operation, 'batch_operation'))
        );
      } catch (error) {
        logger.error('Batch cache update failed', error, {
          component: 'CacheUpdateService',
          operation: 'processQueue',
          extra: { batchSize: batch.length },
        });
      }
    }

    this.isUpdating = false;
  }

  /**
   * Forces cache cleanup and refresh (removes invalid entries)
   */
  async refreshCache(): Promise<void> {
    try {
      // Clean up temporary entries
      await this.cleanupTempEntries();

      // Verify cache consistency
      await this.verifyCacheConsistency();

      logger.info('Cache refresh completed', {
        component: 'CacheUpdateService',
        operation: 'refreshCache',
      });
    } catch (error) {
      logger.error('Cache refresh failed', error, {
        component: 'CacheUpdateService',
        operation: 'refreshCache',
      });
      throw error;
    }
  }

  /**
   * Apply batch ID updates to cache
   */
  async applyIdMappingUpdates(
    updates: IdMappingUpdate[]
  ): Promise<CacheUpdateResult> {
    const result: CacheUpdateResult = {
      success: true,
      updatedClients: 0,
      updatedReceipts: 0,
      removedTempEntries: 0,
      errors: [],
    };

    try {
      // Get all cached data once
      const [cachedClients, cachedReceipts] = await Promise.all([
        offlineStorage.getCachedClients(),
        offlineStorage.getCachedReceipts(),
      ]);

      let clientsModified = false;
      let receiptsModified = false;

      // Apply updates
      for (const update of updates) {
        if (update.oldClientId && update.newClientId) {
          // Update client ID
          const clientIndex = cachedClients.findIndex(
            c => c.id === update.oldClientId
          );
          if (clientIndex !== -1) {
            cachedClients[clientIndex].id = update.newClientId;
            clientsModified = true;
            result.updatedClients++;
          }

          // Update receipt clientId references
          if (update.receiptIds) {
            for (const receiptId of update.receiptIds) {
              const receiptIndex = cachedReceipts.findIndex(
                r => r.id === receiptId
              );
              if (
                receiptIndex !== -1 &&
                cachedReceipts[receiptIndex].clientId === update.oldClientId
              ) {
                cachedReceipts[receiptIndex].clientId = update.newClientId;
                receiptsModified = true;
                result.updatedReceipts++;
              }
            }
          }
        }
      }

      // Save changes atomically
      const savePromises: Promise<void>[] = [];
      if (clientsModified) {
        savePromises.push(offlineStorage.cacheClients(cachedClients));
      }
      if (receiptsModified) {
        savePromises.push(offlineStorage.cacheReceipts(cachedReceipts));
      }

      if (savePromises.length > 0) {
        await Promise.all(savePromises);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Replace a temp entity with real entity in cache
   */
  async replaceEntity(
    tempId: string,
    realId: string,
    entityData: any,
    type: 'client' | 'receipt'
  ): Promise<boolean> {
    try {
      if (type === 'client') {
        const cachedClients = await offlineStorage.getCachedClients();
        const index = cachedClients.findIndex(c => c.id === tempId);

        if (index !== -1) {
          cachedClients[index] = { ...entityData, id: realId };
          await offlineStorage.cacheClients(cachedClients);
          return true;
        }
      } else if (type === 'receipt') {
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        const index = cachedReceipts.findIndex(r => r.id === tempId);

        if (index !== -1) {
          cachedReceipts[index] = { ...entityData, id: realId };
          await offlineStorage.cacheReceipts(cachedReceipts);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to replace entity in cache', error, {
        component: 'CacheUpdateService',
        operation: 'replaceEntity',
        extra: { tempId, realId, type },
      });
      return false;
    }
  }

  /**
   * Clean up temporary entries from cache
   */
  async cleanupTempEntries(): Promise<CacheUpdateResult> {
    const result: CacheUpdateResult = {
      success: true,
      updatedClients: 0,
      updatedReceipts: 0,
      removedTempEntries: 0,
      errors: [],
    };

    try {
      // Clean up temp clients
      const cachedClients = await offlineStorage.getCachedClients();
      const realClients = cachedClients.filter(
        client => !client.id.startsWith('temp_client_')
      );
      const removedClients = cachedClients.length - realClients.length;

      if (removedClients > 0) {
        await offlineStorage.cacheClients(realClients);
        result.removedTempEntries += removedClients;

        logger.info('Cleaned up temporary clients', {
          component: 'CacheUpdateService',
          operation: 'cleanupTempEntries',
          extra: { removedClients },
        });
      }

      // Clean up temp receipts
      const cachedReceipts = await offlineStorage.getCachedReceipts();
      const realReceipts = cachedReceipts.filter(
        receipt => !receipt.id.startsWith('temp_receipt_')
      );
      const removedReceipts = cachedReceipts.length - realReceipts.length;

      if (removedReceipts > 0) {
        await offlineStorage.cacheReceipts(realReceipts);
        result.removedTempEntries += removedReceipts;

        logger.info('Cleaned up temporary receipts', {
          component: 'CacheUpdateService',
          operation: 'cleanupTempEntries',
          extra: { removedReceipts },
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Verify cache consistency and fix common issues
   */
  async verifyCacheConsistency(): Promise<{
    isConsistent: boolean;
    issues: string[];
    fixed: string[];
  }> {
    const issues: string[] = [];
    const fixed: string[] = [];

    try {
      const [cachedClients, cachedReceipts] = await Promise.all([
        offlineStorage.getCachedClients(),
        offlineStorage.getCachedReceipts(),
      ]);

      // Check for orphaned receipts (receipts with non-existent client IDs)
      const clientIds = new Set(cachedClients.map(c => c.id));
      const orphanedReceipts = cachedReceipts.filter(
        receipt =>
          receipt.clientId &&
          !clientIds.has(receipt.clientId) &&
          !receipt.clientId.startsWith('temp_')
      );

      if (orphanedReceipts.length > 0) {
        issues.push(
          `Found ${orphanedReceipts.length} orphaned receipts with invalid client IDs`
        );

        // Auto-fix: Set clientId to empty string for orphaned receipts
        orphanedReceipts.forEach(receipt => {
          receipt.clientId = '';
        });

        await offlineStorage.cacheReceipts(cachedReceipts);
        fixed.push(
          `Fixed ${orphanedReceipts.length} orphaned receipts by clearing their client IDs`
        );
      }

      // Check for duplicate IDs
      const clientIdCounts = new Map<string, number>();
      cachedClients.forEach(client => {
        clientIdCounts.set(client.id, (clientIdCounts.get(client.id) || 0) + 1);
      });

      const receiptIdCounts = new Map<string, number>();
      cachedReceipts.forEach(receipt => {
        receiptIdCounts.set(
          receipt.id,
          (receiptIdCounts.get(receipt.id) || 0) + 1
        );
      });

      const duplicateClientIds = Array.from(clientIdCounts.entries()).filter(
        ([_, count]) => count > 1
      );
      const duplicateReceiptIds = Array.from(receiptIdCounts.entries()).filter(
        ([_, count]) => count > 1
      );

      if (duplicateClientIds.length > 0) {
        issues.push(
          `Found duplicate client IDs: ${duplicateClientIds.map(([id]) => id).join(', ')}`
        );
      }

      if (duplicateReceiptIds.length > 0) {
        issues.push(
          `Found duplicate receipt IDs: ${duplicateReceiptIds.map(([id]) => id).join(', ')}`
        );
      }

      // Check for temp IDs that should have been resolved
      const unresolvedTempClients = cachedClients.filter(c =>
        c.id.startsWith('temp_client_')
      ).length;
      const unresolvedTempReceipts = cachedReceipts.filter(r =>
        r.id.startsWith('temp_receipt_')
      ).length;

      if (unresolvedTempClients > 0) {
        issues.push(`Found ${unresolvedTempClients} unresolved temp clients`);
      }

      if (unresolvedTempReceipts > 0) {
        issues.push(`Found ${unresolvedTempReceipts} unresolved temp receipts`);
      }

      return {
        isConsistent: issues.length === 0,
        issues,
        fixed,
      };
    } catch (error) {
      issues.push(
        `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        isConsistent: false,
        issues,
        fixed,
      };
    }
  }

  /**
   * Remove entity from cache
   */
  async removeEntity(
    entityId: string,
    type: 'client' | 'receipt'
  ): Promise<boolean> {
    try {
      if (type === 'client') {
        const cachedClients = await offlineStorage.getCachedClients();
        const filtered = cachedClients.filter(c => c.id !== entityId);

        if (filtered.length !== cachedClients.length) {
          await offlineStorage.cacheClients(filtered);
          return true;
        }
      } else if (type === 'receipt') {
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        const filtered = cachedReceipts.filter(r => r.id !== entityId);

        if (filtered.length !== cachedReceipts.length) {
          await offlineStorage.cacheReceipts(filtered);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to remove entity from cache', error, {
        component: 'CacheUpdateService',
        operation: 'removeEntity',
        extra: { entityId, type },
      });
      return false;
    }
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<CacheUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.debug('Cache update service config updated', undefined, {
      component: 'CacheUpdateService',
      operation: 'updateConfig',
      extra: { newConfig: this.config },
    });
  }
}

// Export singleton instance
export const cacheUpdateService = new CacheUpdateService();
