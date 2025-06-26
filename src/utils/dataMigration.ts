import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { normalizePolishText, createSearchableText } from './textUtils';
import { logger } from './logger';

interface Client {
  id: string;
  name: string;
  address: string;
  documentNumber: string;
  userID: string;
  searchableText?: string;
  name_normalized?: string;
  address_normalized?: string;
  documentNumber_normalized?: string;
}

/**
 * Migrates existing client records to include normalized search fields
 * This should be run once to update existing data
 */
export const migrateClientSearchFields = async (
  userID: string
): Promise<{ updated: number; errors: string[] }> => {
  const results = { updated: 0, errors: [] as string[] };

  try {
    // Get all clients for the user that don't have searchableText field
    const clientsQuery = query(
      collection(db, 'clients'),
      where('userID', '==', userID)
    );

    const clientsSnapshot = await getDocs(clientsQuery);
    const clientsToUpdate: Client[] = [];

    clientsSnapshot.docs.forEach(docSnapshot => {
      const client = { id: docSnapshot.id, ...docSnapshot.data() } as Client;

      // Check if the client needs migration (missing searchableText or other normalized fields)
      if (
        !client.searchableText ||
        !client.name_normalized ||
        !client.address_normalized ||
        !client.documentNumber_normalized
      ) {
        clientsToUpdate.push(client);
      }
    });

    if (clientsToUpdate.length === 0) {
      logger.info('No clients need migration', {
        component: 'DataMigration',
        operation: 'migrateClientSearchFields',
        userId: userID,
      });
      return results;
    }

    logger.info(`Migrating ${clientsToUpdate.length} client records...`, {
      component: 'DataMigration',
      operation: 'migrateClientSearchFields',
      userId: userID,
      extra: { clientsToUpdate: clientsToUpdate.length },
    });

    // Process in batches (Firestore batch limit is 500 operations)
    const batchSize = 450; // Leave some room for safety

    for (let i = 0; i < clientsToUpdate.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchClients = clientsToUpdate.slice(i, i + batchSize);

      batchClients.forEach(client => {
        try {
          const clientRef = doc(db, 'clients', client.id);

          const updateData = {
            name_normalized: normalizePolishText(client.name),
            address_normalized: normalizePolishText(client.address || ''),
            documentNumber_normalized: normalizePolishText(
              client.documentNumber || ''
            ),
            searchableText: createSearchableText([
              client.name,
              client.address || '',
              client.documentNumber || '',
            ]),
          };

          batch.update(clientRef, updateData);
          results.updated++;
        } catch (error) {
          const errorMsg = `Failed to prepare update for client ${client.id}: ${error}`;
          logger.error(errorMsg, error, {
            component: 'DataMigration',
            operation: 'migrateClientSearchFields',
            userId: userID,
            extra: { clientId: client.id },
          });
          results.errors.push(errorMsg);
        }
      });

      try {
        await batch.commit();
        const errorMsg = `Batch ${Math.floor(i / batchSize) + 1} completed successfully`;
        logger.success(errorMsg, {
          component: 'DataMigration',
          operation: 'migrateClientSearchFields',
          userId: userID,
          extra: {
            batchNumber: Math.floor(i / batchSize) + 1,
            batchSize: batchClients.length,
          },
        });
      } catch (error) {
        const errorMsg = `Failed to commit batch ${Math.floor(i / batchSize) + 1}: ${error}`;
        logger.error(errorMsg, error, {
          component: 'DataMigration',
          operation: 'migrateClientSearchFields',
          userId: userID,
          extra: { batchNumber: Math.floor(i / batchSize) + 1 },
        });
        results.errors.push(errorMsg);
        // Subtract the failed batch from updated count
        results.updated -= batchClients.length;
      }
    }

    const successMsg = `Migration completed. Updated ${results.updated} clients.`;
    logger.success(successMsg, {
      component: 'DataMigration',
      operation: 'migrateClientSearchFields',
      userId: userID,
      extra: {
        totalUpdated: results.updated,
        totalErrors: results.errors.length,
      },
    });

    if (results.errors.length > 0) {
      logger.warn(
        `Migration completed with ${results.errors.length} errors`,
        undefined,
        {
          component: 'DataMigration',
          operation: 'migrateClientSearchFields',
          userId: userID,
          extra: { errors: results.errors },
        }
      );
    }
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    logger.error(errorMsg, error, {
      component: 'DataMigration',
      operation: 'migrateClientSearchFields',
      userId: userID,
    });
    results.errors.push(errorMsg);
  }

  return results;
};

/**
 * Check if migration is needed for a user's clients
 */
export const checkMigrationNeeded = async (
  userID: string
): Promise<boolean> => {
  try {
    const clientsQuery = query(
      collection(db, 'clients'),
      where('userID', '==', userID)
    );

    const clientsSnapshot = await getDocs(clientsQuery);

    // Check if any client is missing the searchableText field
    for (const docSnapshot of clientsSnapshot.docs) {
      const client = docSnapshot.data();
      if (!client.searchableText) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking migration status', error, {
      component: 'DataMigration',
      operation: 'checkMigrationNeeded',
      userId: userID,
    });
    return false;
  }
};
