# Firestore Security Rules Documentation

## Overview

This document explains the security rules implemented for the PWA application to ensure proper user-specific access controls.

## Security Model

### Current Implementation

- **User Isolation**: Each user can only access data they own
- **Document Ownership**: Ownership is determined by the `userID` field in documents
- **Company Details**: Use the user's UID as the document ID for direct access control

### Collections and Access Patterns

#### 1. Clients Collection (`/clients/{clientId}`)

```javascript
match /clients/{clientId} {
  allow read, update, delete: if isDocumentOwner();
  allow create: if isCreatingOwnDocument();
}
```

- Users can only access clients where `document.userID == request.auth.uid`
- Creating new clients requires setting `userID` to the authenticated user's UID

#### 2. Products Collection (`/products/{productId}`)

```javascript
match /products/{productId} {
  allow read, update, delete: if isDocumentOwner();
  allow create: if isCreatingOwnDocument();
}
```

- Users can only access products they own
- Same ownership model as clients

#### 3. Categories Collection (`/categories/{categoryId}`)

```javascript
match /categories/{categoryId} {
  allow read, update, delete: if isDocumentOwner();
  allow create: if isCreatingOwnDocument();
}
```

- Users can only access categories they created
- Same ownership model as other collections

#### 4. Receipts Collection (`/receipts/{receiptId}`)

```javascript
match /receipts/{receiptId} {
  allow read, update, delete: if isDocumentOwner();
  allow create: if isCreatingOwnDocument();
}
```

- Users can only access receipts they created
- Critical for financial data protection

#### 5. Company Details Collection (`/companyDetails/{userId}`)

```javascript
match /companyDetails/{userId} {
  allow read, write, create, update, delete: if isOwner(userId);
}
```

- Document ID must match the user's UID
- Direct ownership validation using document path

## Helper Functions

### `isAuthenticated()`

```javascript
function isAuthenticated() {
  return request.auth != null;
}
```

Verifies that the user is logged in.

### `isOwner(userId)`

```javascript
function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}
```

Checks if the authenticated user owns a specific user ID.

### `isDocumentOwner()`

```javascript
function isDocumentOwner() {
  return (
    isAuthenticated() &&
    'userID' in resource.data &&
    request.auth.uid == resource.data.userID
  );
}
```

Verifies that the user owns the document based on the `userID` field.

### `isCreatingOwnDocument()`

```javascript
function isCreatingOwnDocument() {
  return (
    isAuthenticated() &&
    'userID' in request.resource.data &&
    request.auth.uid == request.resource.data.userID
  );
}
```

Ensures users can only create documents with their own `userID`.

## Security Benefits

### Before (Insecure)

```javascript
// Any authenticated user could access ANY data
allow read, write: if request.auth != null;
```

### After (Secure)

```javascript
// Users can only access their own data
allow read, update, delete: if isDocumentOwner();
allow create: if isCreatingOwnDocument();
```

## Data Structure Requirements

For these rules to work properly, ensure:

1. **All documents include `userID` field**:

   ```javascript
   await addDoc(collection(db, 'clients'), {
     name: 'Client Name',
     userID: user.uid, // Critical for security
     // ... other fields
   });
   ```

2. **Company details use UID as document ID**:

   ```javascript
   const docRef = doc(db, 'companyDetails', user.uid);
   await setDoc(docRef, companyData);
   ```

3. **Queries filter by userID**:
   ```javascript
   const q = query(collection(db, 'clients'), where('userID', '==', user.uid));
   ```

## Testing the Security Rules

### Manual Testing

1. Use the provided test script: `test-security-rules.js`
2. Open browser console while authenticated
3. Run: `testSecurityRules.runAllTests()`

### Expected Results

- ✅ Can create/read/update/delete own documents
- ❌ Cannot access other users' documents
- ❌ Cannot create documents with other users' userID

### Automated Testing

Consider using Firebase Security Rules Unit Tests for comprehensive testing:

```bash
npm install @firebase/rules-unit-testing
```

## Deployment Checklist

### Before Deploying

- [ ] Test security rules in emulator
- [ ] Verify all documents have `userID` field
- [ ] Test with multiple user accounts
- [ ] Run security test script

### Production Deployment

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Verify deployment
firebase firestore:rules:get
```

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**

   - Check if `userID` field exists in document
   - Verify user is authenticated
   - Ensure `userID` matches `auth.uid`

2. **Cannot Read Documents**

   - Verify queries include `where('userID', '==', user.uid)`
   - Check that documents were created with correct `userID`

3. **Cannot Update Documents**
   - Ensure not trying to change `userID` field
   - Verify user owns the document

### Debug Commands

```javascript
// Check current user
console.log('Current user:', firebase.auth().currentUser?.uid);

// Check document userID
console.log('Document userID:', documentData.userID);

// Verify ownership
console.log(
  'Owns document:',
  documentData.userID === firebase.auth().currentUser?.uid
);
```

## Security Best Practices

1. **Principle of Least Privilege**: Users can only access what they need
2. **Data Isolation**: Complete separation between users' data
3. **Input Validation**: Verify userID in all document operations
4. **Regular Audits**: Test security rules regularly
5. **Monitor Access**: Set up Firebase monitoring for unusual patterns

## Migration Notes

If you have existing data without `userID` fields:

1. **Backup existing data**
2. **Add userID field to all documents**:
   ```javascript
   // Example migration script
   const updateDocuments = async () => {
     const snapshot = await getDocs(collection(db, 'clients'));
     snapshot.forEach(async doc => {
       if (!doc.data().userID) {
         await updateDoc(doc.ref, {
           userID: 'appropriate-user-id', // Map to correct user
         });
       }
     });
   };
   ```
3. **Test thoroughly before production deployment**
