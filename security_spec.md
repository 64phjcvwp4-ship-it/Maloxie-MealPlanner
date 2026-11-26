# Security Specification — Maloxie Cloud Sync

## Phase 0: Global Architectural Invariants
1. **Default Deny**: Root catch-all `match /{document=**} { allow read, write: if false; }` denies all unmapped collections (including `/test/connection`).
2. **Verified Google Auth Only**: All permitted reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Strict PII & Tenant Isolation**:
   - `/users/{userId}` stores personal identity (`uid`, `email`, `displayName`, `photoURL`) and is readable/writable strictly by `request.auth.uid == userId`.
   - `/users/{userId}/planner/{stateId}` stores meal planner workspace state and is readable/writable strictly by `request.auth.uid == userId` with `ownerId == userId`.
4. **Input & Schema Hardening**:
   - Document IDs (`userId`, `stateId`) validated via `isValidId()` (`^[a-zA-Z0-9_-]+$`, max length 128).
   - Strict `hasAll` and `hasOnly` allowlisting on create; `diff(existing()).affectedKeys().hasOnly(...)` on update.
   - Immutability enforced for `uid`, `ownerId`, and `createdAt`.
   - Server timestamps enforced (`createdAt == request.time` on create; `updatedAt == request.time` on create & update).
   - Native Firestore Maps and Lists only (no JSON-serialized blobs).
   - Volumetric caps (`daysMap.size() <= 90`, `customRecipes.size() <= 100`, `customTemplates.size() <= 30`, `favoriteIds.size() <= 200`, `manualItems.size() <= 150`, grocery key lists `<= 500`, `planningHorizonWeeks` 1..8, `householdMultiplier` 0.5..12, `targets` numeric bounds).

## Dirty Dozen Verification Matrix
1. Unauthenticated read/write to `/users/u1` or `/users/u1/planner/default` -> **DENY**
2. Authenticated user with `email_verified == false` -> **DENY**
3. Cross-user read/write (`auth.uid == 'u2'` accessing `/users/u1/planner/default`) -> **DENY**
4. Ownership spoofing on create (`auth.uid == 'u1'` writing `ownerId: 'u2'`) -> **DENY**
5. Ownership hijack on update (changing `ownerId` or `uid`) -> **DENY**
6. Unknown/extra field injection (`isAdmin: true`) -> **DENY**
7. Missing required fields on create -> **DENY**
8. Invalid `stateId` path segment (`../other` or `bad$id`) -> **DENY**
9. Out-of-bounds numbers (`planningHorizonWeeks: 99`, `householdMultiplier: -5`, `targets.calories: 999999`) -> **DENY**
10. Unbounded collection DoS (`favoriteIds` length 250, `daysMap` length 100) -> **DENY**
11. Timestamp forgery (`createdAt != request.time` on create or altering `createdAt` on update) -> **DENY**
12. Accessing unmapped collections (e.g., `/admin/config`, `/test/connection`) -> **DENY**
