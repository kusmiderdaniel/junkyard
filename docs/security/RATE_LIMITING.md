# Rate Limiting Implementation

## Overview

This document describes the comprehensive rate limiting system implemented to prevent abuse and DOS attacks on Firebase operations. The system provides client-side protection against excessive API usage while maintaining good user experience.

## Core Components

### 1. RateLimiter Class (`src/utils/rateLimiter.ts`)

The main rate limiting engine that provides:

- Token bucket algorithm implementation
- Per-user and global rate limiting
- Configurable time windows and request limits
- Automatic cleanup of expired entries
- Blocking mechanisms for repeated violations

**Key Features:**

- Granular operation-specific limits
- User-specific tracking by identifier
- Memory-efficient with automatic cleanup
- Polish language error messages
- Debugging and monitoring support

### 2. Rate Limited Firebase Wrappers (`src/utils/rateLimitedFirebase.ts`)

Specialized wrappers for Firebase operations:

- `RateLimitedAuth`: Authentication operations
- `RateLimitedFirestore`: Firestore CRUD operations
- `RateLimitedOperations`: Business logic operations
- `useRateLimitedOperations`: React hook for components

## Rate Limit Configuration

### Authentication Operations

| Operation             | Limit      | Window     | Block Duration | Description                        |
| --------------------- | ---------- | ---------- | -------------- | ---------------------------------- |
| `auth:login`          | 5 requests | 15 minutes | 30 minutes     | Prevents brute force login attacks |
| `auth:signup`         | 3 requests | 1 hour     | 2 hours        | Limits account creation abuse      |
| `auth:password-reset` | 3 requests | 1 hour     | 1 hour         | Prevents password reset spam       |

### Firestore Operations

| Operation         | Limit        | Window   | Block Duration | Description                   |
| ----------------- | ------------ | -------- | -------------- | ----------------------------- |
| `firestore:write` | 100 requests | 1 minute | None           | General write operation limit |
| `firestore:read`  | 200 requests | 1 minute | None           | General read operation limit  |
| `firestore:query` | 50 requests  | 1 minute | None           | Complex query limit           |

### Business Operations

| Operation        | Limit       | Window    | Block Duration | Description                |
| ---------------- | ----------- | --------- | -------------- | -------------------------- |
| `receipt:create` | 30 requests | 1 minute  | None           | Receipt creation limit     |
| `receipt:update` | 50 requests | 1 minute  | None           | Receipt modification limit |
| `client:create`  | 20 requests | 1 minute  | None           | Client creation limit      |
| `product:create` | 50 requests | 1 minute  | None           | Product creation limit     |
| `sync:operation` | 10 requests | 1 minute  | None           | Sync operation limit       |
| `export:data`    | 5 requests  | 5 minutes | None           | Data export limit          |
| `pdf:generate`   | 30 requests | 1 minute  | None           | PDF generation limit       |

## Implementation Strategy

### 1. Authentication Protection

**Login Component:**

```typescript
const rateLimitedAuth = new RateLimitedAuth(auth);
await rateLimitedAuth.signInWithEmailAndPassword(email, password);
```

**Features:**

- Email-based rate limiting (prevents targeting specific accounts)
- Progressive blocking (temporary lockouts)
- User-friendly error messages in Polish

### 2. Form Operations Protection

**Receipt Operations:**

```typescript
const rateLimitedOps = useRateLimitedOperations(() => user?.uid || 'anonymous');

// Check before operation
const receiptLimit = rateLimitedOps.checkReceiptCreate();
if (!receiptLimit.allowed) {
  toast.error(receiptLimit.message);
  return;
}
```

**Client Operations:**

```typescript
// Check rate limits for client creation
const clientLimit = rateLimitedOps.checkClientCreate();
if (!clientLimit.allowed) {
  setError(clientLimit.message);
  return;
}
```

### 3. Sync Operations Protection

**Sync Service Integration:**

```typescript
// Check rate limits before sync
const syncLimit = rateLimiter.checkLimit('sync:operation', userUID);
if (!syncLimit.allowed) {
  toast.error(syncLimit.message);
  return;
}
```

### 4. PDF Generation Protection

**PDF Operations:**

```typescript
const pdfLimit = rateLimitedOps.checkPDFGenerate();
if (!pdfLimit.allowed) {
  toast.error(pdfLimit.message);
  return;
}
```

## Rate Limiting Algorithm

### Token Bucket Implementation

1. **Window-based Limiting:**
   - Each operation has a configurable time window
   - Requests are counted within the window
   - Window resets automatically after expiration

2. **User-specific Tracking:**
   - Rate limits tracked per user identifier
   - Anonymous users get global limits
   - Different users don't affect each other's limits

3. **Progressive Penalties:**
   - Optional blocking duration for repeat violations
   - Temporary lockouts for sensitive operations
   - Automatic recovery after block period

### Key Components

```typescript
interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  blockDurationMs?: number; // Optional blocking period
  message?: string; // Custom error message
}
```

## User Experience Considerations

### 1. Error Messages

**Polish Language Support:**

- All error messages in Polish
- Context-specific explanations
- Clear indication of retry timing

**Examples:**

- "Zbyt wiele prób logowania. Spróbuj ponownie za 30 minut."
- "Zbyt wiele tworzonych kwitów. Spróbuj ponownie za chwilę."

### 2. Progressive Feedback

**Rate Limit Status:**

- `remainingRequests`: Shows how many requests left
- `resetTime`: When the window resets
- `retryAfter`: How long to wait before retry

### 3. Non-Intrusive Implementation

**Seamless Integration:**

- No changes to existing component APIs
- Graceful degradation when limits reached
- Maintains application functionality

## Security Benefits

### 1. DOS Attack Prevention

**Protection Against:**

- Rapid-fire login attempts
- Mass account creation
- Excessive API calls
- Resource exhaustion attacks

### 2. Abuse Prevention

**Limitations:**

- Prevents form submission spam
- Limits automated scraping
- Reduces server load
- Protects Firebase quotas

### 3. Cost Control

**Firebase Usage:**

- Reduces unnecessary API calls
- Prevents quota exhaustion
- Protects against billing spikes
- Maintains service availability

## Monitoring and Debugging

### 1. Development Tools

**Debug Information:**

```typescript
rateLimiter.getAllStatuses(); // Get all current limits
```

**Console Logging:**

- Rate limit violations
- Current request counts
- Block status and timing

### 2. Production Monitoring

**Metrics to Track:**

- Rate limit hit frequency
- Most limited operations
- User behavior patterns
- Block duration effectiveness

### 3. Configuration Tuning

**Adjustable Parameters:**

- Request limits per operation
- Time window sizes
- Block durations
- Error messages

## Integration Examples

### 1. Component Integration

```typescript
// In any component
const rateLimitedOps = useRateLimitedOperations(() => user?.uid);

const handleOperation = async () => {
  const limit = rateLimitedOps.checkOperationType();
  if (!limit.allowed) {
    toast.error(limit.message);
    return;
  }

  // Proceed with operation
  await performOperation();
};
```

### 2. Service Integration

```typescript
// In service classes
const result = await rateLimitedOps.executeWithRateLimit(
  'operation:type',
  async () => {
    // Your operation logic
    return await someAsyncOperation();
  },
  'Nie udało się wykonać operacji.'
);
```

### 3. Custom Rate Limits

```typescript
// Register custom limits
rateLimiter.registerLimit('custom:operation', {
  maxRequests: 10,
  windowMs: 60000,
  message: 'Niestandardowy limit przekroczony.',
});
```

## Best Practices

### 1. Rate Limit Placement

**Recommended Locations:**

- ✅ Form submission handlers
- ✅ API call initiation points
- ✅ Authentication operations
- ✅ Resource-intensive operations

**Avoid:**

- ❌ UI rendering operations
- ❌ Local state updates
- ❌ Read-only data display

### 2. Error Handling

**User Experience:**

- Show clear error messages
- Provide retry guidance
- Maintain form state during errors
- Disable buttons temporarily

### 3. Configuration Guidelines

**Conservative Limits:**

- Start with restrictive limits
- Monitor usage patterns
- Adjust based on legitimate usage
- Consider peak usage times

### 4. Testing Strategies

**Development Testing:**

- Simulate rapid requests
- Test error handling
- Verify block mechanisms
- Test recovery after blocks

## Performance Impact

### 1. Memory Usage

**Optimization:**

- Automatic cleanup of expired entries
- Efficient Map-based storage
- Minimal memory footprint per user

### 2. Execution Speed

**Performance:**

- O(1) rate limit checks
- Minimal computational overhead
- No network requests for checks
- Synchronous operation validation

### 3. Scalability

**Design Considerations:**

- Client-side implementation (no server load)
- Per-user isolation
- Memory-efficient cleanup
- Configurable for different usage patterns

## Maintenance and Updates

### 1. Configuration Updates

**Runtime Changes:**

- Adjust limits without code changes
- Monitor effectiveness
- Respond to abuse patterns
- Seasonal adjustments

### 2. Security Review

**Regular Audits:**

- Review rate limit effectiveness
- Analyze bypass attempts
- Update limits based on usage
- Monitor for new attack vectors

### 3. Performance Monitoring

**Key Metrics:**

- Rate limit hit rates
- User experience impact
- False positive rates
- System resource usage

This comprehensive rate limiting system provides robust protection against abuse while maintaining excellent user experience and performance.
