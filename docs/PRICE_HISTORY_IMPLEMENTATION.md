# Price History Feature Implementation

## Overview

The "Historia cen" (Price History) feature has been successfully implemented to track product price changes over time. This feature provides:

- **Daily automated price capture** via Firebase Cloud Functions
- **Interactive price history charts** using Recharts
- **Filtering capabilities** by product, date range, and price type
- **Price change notifications** and trend analysis

## Components Added

### 1. Frontend Components

#### Types (`src/types/statistics.ts`)

- `PriceHistoryEntry` - Database record structure
- `PriceHistoryFilters` - Filter options for charts
- `ChartDataPoint` - Chart data structure
- `ProductOption` - Product selector options
- `PriceChangeEvent` - Price change tracking

#### Custom Hook (`src/hooks/usePriceHistoryData.ts`)

- Fetches price history data from Firestore
- Handles offline/online states
- Generates sample data for demonstration
- Processes price changes and trends

#### UI Component (`src/components/statistics/PriceHistoryTab.tsx`)

- Interactive line chart with dual y-axis
- Product selector with search
- Date range picker
- Price type filter (buy/sell/both)
- Price change summary

### 2. Backend Infrastructure

#### Firebase Functions (`functions/index.js`)

- `captureDailyPrices` - Scheduled function (daily at 23:00)
- `triggerPriceCapture` - Manual trigger for testing
- Optimized to only store price changes (not daily snapshots)

#### Database Structure

```javascript
// Collection: priceHistory
{
  id: string,
  userID: string,          // For user isolation
  productId: string,       // Reference to products collection
  itemCode: string,        // Denormalized for faster queries
  itemName: string,        // Denormalized for faster queries
  buy_price: number,
  sell_price: number,
  timestamp: Timestamp,    // Firebase Timestamp
  dateKey: string,         // Format: "2024-01-15"
  createdAt: Timestamp
}
```

#### Security Rules (`firestore.rules`)

```javascript
match /priceHistory/{priceHistoryId} {
  allow read, update, delete: if isDocumentOwner();
  allow create: if isCreatingOwnDocument();
}
```

#### Firestore Indexes (`firestore.indexes.json`)

- Composite indexes for efficient querying
- Supports filtering by user, product, and date ranges

## Deployment Steps

### 1. Deploy Firestore Configuration

```bash
# Deploy security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 2. Deploy Firebase Functions

```bash
# Install function dependencies
cd functions
npm install

# Deploy functions to your environments
firebase use development
firebase deploy --only functions

firebase use staging
firebase deploy --only functions

firebase use production
firebase deploy --only functions
```

### 3. Deploy Frontend

```bash
# Build and deploy frontend
npm run build:dev && firebase use development && firebase deploy --only hosting
npm run build:staging && firebase use staging && firebase deploy --only hosting
npm run build:prod && firebase use production && firebase deploy --only hosting
```

## Testing the Feature

### 1. Populate Test Data (Development Environment)

The implementation includes functions to populate and clear test data:

#### Generate Test Data

```bash
# Deploy the functions if not already deployed
firebase use development
firebase deploy --only functions

# Populate test data for the last 7 days
curl -X POST "https://us-central1-junkyard-dev-9497a.cloudfunctions.net/populateTestPriceHistory"
```

This will:

- Process all existing products in your development environment
- Generate realistic price history for the past 7 days
- Create ±15% price variations with trends settling to current prices
- Generate approximately 7 entries per product

#### Clear Test Data

```bash
# Clear all price history data
curl -X POST "https://us-central1-junkyard-dev-9497a.cloudfunctions.net/clearTestPriceHistory"
```

**Note**: These test functions only work in development environment (project ID contains 'dev').

### 2. Manual Price Capture (for testing)

```bash
# Call the manual trigger function
curl -X POST "https://us-central1-junkyard-dev-9497a.cloudfunctions.net/triggerPriceCapture"
```

### 3. Frontend Testing

1. Navigate to Statistics page
2. Click on "Historia cen" tab
3. Select a product from the dropdown
4. Adjust date range and price type filters
5. View the interactive chart with populated test data

## Monitoring

### Cloud Functions Logs

```bash
# View function logs
firebase functions:log --only captureDailyPrices
firebase functions:log --only triggerPriceCapture
```

### Expected Function Behavior

- **Daily at 23:00 CET**: Automatic price capture
- **Deduplication**: Only stores price changes, not daily snapshots
- **Batch processing**: Efficient handling of multiple users
- **Error handling**: Graceful failure handling per user

## Performance Considerations

### Frontend Optimizations

- **Lazy loading**: Charts rendered only when tab is active
- **Data caching**: Product options cached between requests
- **Sample data**: Shows demo data when no historical data exists
- **Date limiting**: Chart data limited to reasonable ranges

### Backend Optimizations

- **Batch writes**: Multiple entries written in single transaction
- **Change detection**: Only stores when prices actually change
- **Indexed queries**: Efficient database queries with proper indexes
- **Memory management**: Functions configured with appropriate memory limits

## Future Enhancements

### Implemented ✅

- ✅ Interactive price history charts
- ✅ Automated daily price capture
- ✅ Product filtering and date ranges
- ✅ Price change trend analysis

### Planned 🔄

- 🔄 Price change notifications
- 🔄 Advanced trend analysis
- 🔄 Price volatility indicators
- 🔄 Export price history to Excel
- 🔄 Price prediction algorithms

## Troubleshooting

### Common Issues

1. **No data showing in charts**
   - Check if products exist in the database
   - Verify Firebase Functions are deployed
   - Check function logs for errors

2. **Functions not running**
   - Verify timezone configuration (Europe/Warsaw)
   - Check IAM permissions for scheduler
   - Review function deployment status

3. **Permission errors**
   - Ensure Firestore security rules are deployed
   - Verify user authentication
   - Check userID field in documents

### Debug Commands

```bash
# Check function status
firebase functions:log

# Test function locally
firebase emulators:start --only functions
curl "http://localhost:5001/[PROJECT-ID]/us-central1/triggerPriceCapture"

# Check Firestore indexes
firebase firestore:indexes
```

## Security Notes

- All price history data is user-isolated via `userID` field
- Functions include basic authentication checks
- Firestore rules prevent cross-user data access
- Sensitive operations logged for audit purposes

---

This implementation provides a solid foundation for price tracking and can be extended with additional analytics and notification features as needed.
