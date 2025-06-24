/**
 * ID Mapping Service
 * Decouples temp-to-real ID mapping logic from sync service
 * Provides a clean interface for managing temporary IDs during offline sync
 */

interface IdMapping {
  tempId: string;
  realId: string;
  type: 'client' | 'receipt';
  timestamp: number;
}

export interface IdMappingUpdate {
  oldClientId?: string;
  newClientId?: string;
  receiptIds?: string[];
}

class IdMappingService {
  private mappings: Map<string, IdMapping> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map(); // Track which receipts depend on which clients

  /**
   * Register a temp-to-real ID mapping
   */
  addMapping(tempId: string, realId: string, type: 'client' | 'receipt'): void {
    const mapping: IdMapping = {
      tempId,
      realId,
      type,
      timestamp: Date.now(),
    };

    this.mappings.set(tempId, mapping);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🗺️ Added ${type} mapping: ${tempId} → ${realId}`);
    }
  }

  /**
   * Get real ID for a temp ID
   */
  getRealId(tempId: string): string | null {
    const mapping = this.mappings.get(tempId);
    return mapping ? mapping.realId : null;
  }

  /**
   * Check if an ID is temporary
   */
  isTempId(id: string): boolean {
    return id.startsWith('temp_client_') || id.startsWith('temp_receipt_');
  }

  /**
   * Register a dependency (receipt depends on client)
   */
  addDependency(receiptId: string, clientId: string): void {
    if (!this.dependencyGraph.has(clientId)) {
      this.dependencyGraph.set(clientId, new Set());
    }
    this.dependencyGraph.get(clientId)!.add(receiptId);
  }

  /**
   * Get all receipt IDs that depend on a client ID
   */
  getDependentReceipts(clientId: string): string[] {
    return Array.from(this.dependencyGraph.get(clientId) || []);
  }

  /**
   * Resolve all temp IDs in an object recursively
   */
  resolveIds<T extends Record<string, any>>(obj: T): T {
    const resolved = { ...obj } as T;

    // Common ID fields to check
    const idFields = ['id', 'clientId', 'receiptId', 'userId'] as const;

    for (const field of idFields) {
      if (
        field in resolved &&
        resolved[field] &&
        this.isTempId(resolved[field] as string)
      ) {
        const realId = this.getRealId(resolved[field] as string);
        if (realId) {
          (resolved as any)[field] = realId;
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `🔄 Resolved ${field}: ${(obj as any)[field]} → ${realId}`
            );
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Generate batch update operations for cache consistency
   */
  generateCacheUpdates(): IdMappingUpdate[] {
    const updates: IdMappingUpdate[] = [];

    // Process client mappings first
    Array.from(this.mappings.values()).forEach(mapping => {
      if (mapping.type === 'client') {
        const dependentReceipts = this.getDependentReceipts(mapping.tempId);

        if (dependentReceipts.length > 0) {
          updates.push({
            oldClientId: mapping.tempId,
            newClientId: mapping.realId,
            receiptIds: dependentReceipts,
          });
        }
      }
    });

    return updates;
  }

  /**
   * Clear all mappings (called after successful sync)
   */
  clear(): void {
    this.mappings.clear();
    this.dependencyGraph.clear();

    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Cleared all ID mappings');
    }
  }

  /**
   * Get mapping statistics for debugging
   */
  getStats() {
    const allMappings = Array.from(this.mappings.values());
    const clientMappings = allMappings.filter(m => m.type === 'client');
    const receiptMappings = allMappings.filter(m => m.type === 'receipt');

    return {
      totalMappings: this.mappings.size,
      clientMappings: clientMappings.length,
      receiptMappings: receiptMappings.length,
      dependencies: this.dependencyGraph.size,
      totalDependentReceipts: Array.from(this.dependencyGraph.values()).reduce(
        (sum, receipts) => sum + receipts.size,
        0
      ),
    };
  }

  /**
   * Validate mapping consistency
   */
  validateMappings(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate real IDs
    const realIds = new Set<string>();
    Array.from(this.mappings.values()).forEach(mapping => {
      if (realIds.has(mapping.realId)) {
        errors.push(`Duplicate real ID: ${mapping.realId}`);
      }
      realIds.add(mapping.realId);
    });

    // Check for orphaned dependencies
    Array.from(this.dependencyGraph.entries()).forEach(
      ([clientId, receipts]) => {
        if (!this.mappings.has(clientId) && this.isTempId(clientId)) {
          errors.push(
            `Orphaned dependency: ${receipts.size} receipts depend on unmapped client ${clientId}`
          );
        }
      }
    );

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const idMappingService = new IdMappingService();
