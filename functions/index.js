/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Daily Price Capture Function
 * Runs every day at 23:00 (11 PM) Europe/Warsaw time
 * Captures current prices from all products for all users
 */
exports.captureDailyPrices = onSchedule(
  {
    schedule: '0 23 * * *', // Daily at 23:00
    timeZone: 'Europe/Warsaw',
    memory: '256MiB',
    timeoutSeconds: 540, // 9 minutes timeout
  },
  async () => {
    logger.info('Starting daily price capture...', {
      timestamp: new Date().toISOString(),
    });

    try {
      // Get all users by fetching unique userIDs from products collection
      const usersSnapshot = await db
        .collection('products')
        .select('userID')
        .get();

      const uniqueUserIds = new Set();
      usersSnapshot.docs.forEach(doc => {
        uniqueUserIds.add(doc.data().userID);
      });

      logger.info(`Found ${uniqueUserIds.size} unique users to process`);

      let totalProcessed = 0;
      let totalErrors = 0;

      // Process each user
      for (const userId of uniqueUserIds) {
        try {
          const result = await capturePricesForUser(userId);
          totalProcessed += result.processed;

          logger.info(`Processed user ${userId}`, {
            userId,
            productsProcessed: result.processed,
            pricesChanged: result.changed,
          });
        } catch (error) {
          totalErrors++;
          logger.error(`Failed to process user ${userId}`, {
            userId,
            error: error.message,
          });
        }
      }

      logger.info('Daily price capture completed', {
        totalUsers: uniqueUserIds.size,
        totalProductsProcessed: totalProcessed,
        totalErrors: totalErrors,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Daily price capture failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
);

/**
 * Capture prices for a specific user
 * @param {string} userId - The user ID to process
 * @return {Promise<{processed: number, changed: number}>}
 */
async function capturePricesForUser(userId) {
  const today = new Date();
  const dateKey = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Get all products for this user
  const productsSnapshot = await db
    .collection('products')
    .where('userID', '==', userId)
    .get();

  if (productsSnapshot.empty) {
    logger.info(`No products found for user ${userId}`);
    return { processed: 0, changed: 0 };
  }

  const batch = db.batch();
  let processed = 0;
  let changed = 0;

  for (const productDoc of productsSnapshot.docs) {
    const product = productDoc.data();
    const productId = productDoc.id;

    try {
      // Check if we already have an entry for today
      const todayEntrySnapshot = await db
        .collection('priceHistory')
        .where('userID', '==', userId)
        .where('productId', '==', productId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!todayEntrySnapshot.empty) {
        // Already have an entry for today, skip
        continue;
      }

      // Get the last price entry to check if prices changed
      const lastEntrySnapshot = await db
        .collection('priceHistory')
        .where('userID', '==', userId)
        .where('productId', '==', productId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      let shouldSaveEntry = true;

      // Check if prices actually changed
      if (!lastEntrySnapshot.empty) {
        const lastEntry = lastEntrySnapshot.docs[0].data();
        if (
          lastEntry.buy_price === product.buy_price &&
          lastEntry.sell_price === product.sell_price
        ) {
          // Prices haven't changed, skip this entry
          shouldSaveEntry = false;
        }
      }

      if (shouldSaveEntry) {
        // Create new price history entry
        const priceHistoryEntry = {
          userID: userId,
          productId: productId,
          itemCode: product.itemCode,
          itemName: product.name,
          buy_price: product.buy_price,
          sell_price: product.sell_price,
          timestamp: admin.firestore.Timestamp.now(),
          dateKey: dateKey,
          createdAt: admin.firestore.Timestamp.now(),
        };

        const docRef = db.collection('priceHistory').doc();
        batch.set(docRef, priceHistoryEntry);
        changed++;
      }

      processed++;
    } catch (error) {
      logger.error(`Error processing product ${productId} for user ${userId}`, {
        userId,
        productId,
        error: error.message,
      });
    }
  }

  // Commit the batch if we have changes
  if (changed > 0) {
    await batch.commit();
  }

  return { processed, changed };
}

/**
 * Enhanced capture prices function that can optionally store daily snapshots
 * @param {string} userId - The user ID to process
 * @param {boolean} forceDailySnapshot - If true, store prices daily
 *                                      regardless of changes
 * @return {Promise<{processed: number, changed: number, snapshots: number}>}
 */
async function capturePricesForUserEnhanced(
  userId,
  forceDailySnapshot = false
) {
  const today = new Date();
  const dateKey = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Get all products for this user
  const productsSnapshot = await db
    .collection('products')
    .where('userID', '==', userId)
    .get();

  if (productsSnapshot.empty) {
    logger.info(`No products found for user ${userId}`);
    return { processed: 0, changed: 0, snapshots: 0 };
  }

  const batch = db.batch();
  let processed = 0;
  let changed = 0;
  let snapshots = 0;

  for (const productDoc of productsSnapshot.docs) {
    const product = productDoc.data();
    const productId = productDoc.id;

    try {
      // Check if we already have an entry for today
      const todayEntrySnapshot = await db
        .collection('priceHistory')
        .where('userID', '==', userId)
        .where('productId', '==', productId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!todayEntrySnapshot.empty) {
        // Already have an entry for today, skip
        continue;
      }

      // Get the last price entry to check if prices changed
      const lastEntrySnapshot = await db
        .collection('priceHistory')
        .where('userID', '==', userId)
        .where('productId', '==', productId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      // Force save if daily snapshots are enabled
      let shouldSaveEntry = forceDailySnapshot;

      // Check if prices actually changed (only if not forcing daily snapshots)
      if (!forceDailySnapshot && !lastEntrySnapshot.empty) {
        const lastEntry = lastEntrySnapshot.docs[0].data();
        if (
          lastEntry.buy_price === product.buy_price &&
          lastEntry.sell_price === product.sell_price
        ) {
          // Prices haven't changed, skip this entry unless forced
          shouldSaveEntry = false;
        } else {
          // Prices changed
          shouldSaveEntry = true;
        }
      } else if (!lastEntrySnapshot.empty) {
        // We have previous data and forcing snapshots
        const lastEntry = lastEntrySnapshot.docs[0].data();
        if (
          lastEntry.buy_price === product.buy_price &&
          lastEntry.sell_price === product.sell_price
        ) {
          snapshots++; // Count as snapshot (same price)
        } else {
          changed++; // Count as change
        }
        shouldSaveEntry = true;
      } else {
        // No previous data, this is the first entry
        shouldSaveEntry = true;
        changed++;
      }

      if (shouldSaveEntry) {
        // Create new price history entry
        const priceHistoryEntry = {
          userID: userId,
          productId: productId,
          itemCode: product.itemCode,
          itemName: product.name,
          buy_price: product.buy_price,
          sell_price: product.sell_price,
          timestamp: admin.firestore.Timestamp.now(),
          dateKey: dateKey,
          createdAt: admin.firestore.Timestamp.now(),
          entryType: forceDailySnapshot
            ? lastEntrySnapshot.empty
              ? 'initial'
              : lastEntrySnapshot.docs[0].data().buy_price ===
                    product.buy_price &&
                  lastEntrySnapshot.docs[0].data().sell_price ===
                    product.sell_price
                ? 'snapshot'
                : 'change'
            : 'change',
        };

        const docRef = db.collection('priceHistory').doc();
        batch.set(docRef, priceHistoryEntry);

        if (!forceDailySnapshot) {
          changed++;
        }
      }

      processed++;
    } catch (error) {
      logger.error(`Error processing product ${productId} for user ${userId}`, {
        userId,
        productId,
        error: error.message,
      });
    }
  }

  // Commit the batch if we have changes
  if (changed > 0 || snapshots > 0) {
    await batch.commit();
  }

  return { processed, changed, snapshots };
}

/**
 * Populate Test Data Function (for development environment)
 * Generates realistic price history data for the past week
 */
exports.populateTestPriceHistory = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async (request, response) => {
    // Only allow in development environment
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId || !projectId.includes('dev')) {
      response
        .status(403)
        .send('This function is only available in development environment');
      return;
    }

    try {
      logger.info('Starting test price history population...');

      // Get all products from development environment
      const productsSnapshot = await db.collection('products').get();

      if (productsSnapshot.empty) {
        response.json({
          success: false,
          message: 'No products found in database',
        });
        return;
      }

      logger.info(`Found ${productsSnapshot.size} products to process`);

      const batch = db.batch();
      let totalEntries = 0;
      const daysToGenerate = 7; // Last 7 days

      // Process each product
      for (const productDoc of productsSnapshot.docs) {
        const product = productDoc.data();
        const productId = productDoc.id;

        // Generate price history for the past week
        const priceEntries = generateWeeklyPriceHistory(
          product,
          productId,
          daysToGenerate
        );

        // Add each entry to batch
        for (const entry of priceEntries) {
          const docRef = db.collection('priceHistory').doc();
          batch.set(docRef, entry);
          totalEntries++;
        }

        logger.info(
          `Generated ${priceEntries.length} entries for product ` +
            `${product.itemCode}`
        );
      }

      // Commit all entries
      await batch.commit();

      logger.info(`Created ${totalEntries} price history entries`);

      response.json({
        success: true,
        message:
          `Successfully generated ${totalEntries} price history ` +
          `entries for ${productsSnapshot.size} products over ` +
          `${daysToGenerate} days`,
        totalProducts: productsSnapshot.size,
        totalEntries: totalEntries,
        daysGenerated: daysToGenerate,
      });
    } catch (error) {
      logger.error('Failed to populate test price history', {
        error: error.message,
        stack: error.stack,
      });

      response.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Generate realistic price history for a product over the past week
 * @param {Object} product - Product data
 * @param {string} productId - Product ID
 * @param {number} days - Number of days to generate
 * @return {Array} Array of price history entries
 */
function generateWeeklyPriceHistory(product, productId, days) {
  const entries = [];
  const now = new Date();

  // Current prices as baseline
  const currentBuyPrice = product.buy_price;
  const currentSellPrice = product.sell_price;

  // Generate prices for each day (going backwards)
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const entryDate = new Date(now);
    entryDate.setDate(entryDate.getDate() - dayOffset);
    // Set to 23:00 to match daily capture time
    entryDate.setHours(23, 0, 0, 0);

    const dateKey = entryDate.toISOString().split('T')[0];

    // Calculate price variation (more variation at the beginning,
    // settling to current prices)
    // Higher variation for older dates
    const variationFactor = dayOffset / days;
    const maxVariation = 0.15; // Max 15% variation

    // Generate buy price variation
    const buyVariation =
      (Math.random() - 0.5) * 2 * maxVariation * variationFactor;
    const buyPrice = Math.max(0.01, currentBuyPrice * (1 + buyVariation));

    // Generate sell price variation (keeping margin reasonable)
    const sellVariation =
      (Math.random() - 0.5) * 2 * maxVariation * variationFactor;
    const sellPrice = Math.max(
      buyPrice + 0.01,
      currentSellPrice * (1 + sellVariation)
    );

    // Create entry
    const entry = {
      userID: product.userID,
      productId: productId,
      itemCode: product.itemCode,
      itemName: product.name,
      // Round to 2 decimal places
      buy_price: Math.round(buyPrice * 100) / 100,
      sell_price: Math.round(sellPrice * 100) / 100,
      timestamp: admin.firestore.Timestamp.fromDate(entryDate),
      dateKey: dateKey,
      createdAt: admin.firestore.Timestamp.now(),
    };

    entries.push(entry);
  }

  return entries;
}

/**
 * Clear Test Data Function (for development environment)
 * Removes all price history data for testing purposes
 */
exports.clearTestPriceHistory = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async (request, response) => {
    // Only allow in development environment
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId || !projectId.includes('dev')) {
      response
        .status(403)
        .send('This function is only available in development environment');
      return;
    }

    try {
      logger.info('Starting test price history cleanup...');

      // Get all price history entries
      const priceHistorySnapshot = await db.collection('priceHistory').get();

      if (priceHistorySnapshot.empty) {
        response.json({
          success: true,
          message: 'No price history data found to clear',
        });
        return;
      }

      const batch = db.batch();
      let deletedCount = 0;

      // Delete all entries in batches of 500 (Firestore limit)
      for (const doc of priceHistorySnapshot.docs) {
        batch.delete(doc.ref);
        deletedCount++;

        // Commit batch if we reach 500 operations
        if (deletedCount % 500 === 0) {
          await batch.commit();
          logger.info(`Deleted ${deletedCount} entries so far...`);
        }
      }

      // Commit remaining operations
      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }

      logger.info(`Deleted ${deletedCount} price history entries`);

      response.json({
        success: true,
        message: `Successfully deleted ${deletedCount} price history entries`,
        deletedCount: deletedCount,
      });
    } catch (error) {
      logger.error('Failed to clear test price history', {
        error: error.message,
        stack: error.stack,
      });

      response.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Manual Price Capture Function (for testing and manual triggers)
 * Can be called via HTTP request for testing purposes
 */
exports.triggerPriceCapture = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async (request, response) => {
    // Add basic security - you might want to add authentication here
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      response.status(401).send('Unauthorized');
      return;
    }

    try {
      logger.info('Manual price capture triggered');

      // Get specific user from query params or process all
      const userId = request.query.userId;

      if (userId) {
        const result = await capturePricesForUser(userId);
        response.json({
          success: true,
          message:
            `Processed ${result.processed} products, ` +
            `${result.changed} price changes recorded`,
          userId: userId,
          ...result,
        });
      } else {
        // Process all users (same logic as scheduled function)
        const usersSnapshot = await db
          .collection('products')
          .select('userID')
          .get();

        const uniqueUserIds = new Set();
        usersSnapshot.docs.forEach(doc => {
          uniqueUserIds.add(doc.data().userID);
        });

        let totalProcessed = 0;
        let totalChanged = 0;

        for (const uid of uniqueUserIds) {
          const result = await capturePricesForUser(uid);
          totalProcessed += result.processed;
          totalChanged += result.changed;
        }

        response.json({
          success: true,
          message:
            `Processed ${uniqueUserIds.size} users, ` +
            `${totalProcessed} products, ${totalChanged} price changes ` +
            `recorded`,
          usersProcessed: uniqueUserIds.size,
          totalProcessed,
          totalChanged,
        });
      }
    } catch (error) {
      logger.error('Manual price capture failed', {
        error: error.message,
        stack: error.stack,
      });

      response.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);
