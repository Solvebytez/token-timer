# Token Validation Flow - Complete Analysis

## Overview
This document outlines all places where token validation and refresh is triggered in the frontend application.

## Token Storage
- **Location**: `frontend/stores/auth-store.ts`
- **Storage**: 
  - Zustand store (in-memory state)
  - localStorage (persisted via Zustand persist middleware)
  - Cookies (`auth_token` and `refresh_token`) - for middleware access

## API Client Setup
**File**: `frontend/lib/api.ts`

### Request Interceptor
- **Trigger**: Before every API request
- **Action**: Automatically adds `Authorization: Bearer {accessToken}` header
- **Source**: Gets `accessToken` from `useAuthStore.getState().accessToken`

### Response Interceptor
- **Trigger**: On 401 Unauthorized responses
- **Action**: 
  1. Checks if request hasn't been retried (`_retry` flag)
  2. Gets `refreshToken` from auth store
  3. Calls `/refresh` endpoint with refresh token
  4. Updates tokens in store via `updateTokens()`
  5. Retries original request with new access token
  6. If refresh fails, clears auth and rejects promise

## Token Validation Points

### 1. Middleware (Server-Side)
**File**: `frontend/middleware.ts`
**Trigger**: On every page request (before page loads)

#### For Protected Routes (`/`)
- **Line 145-225**: Checks if route is protected
- **Validation Flow**:
  1. If no tokens → redirect to `/login`
  2. If `authToken` exists → validates via `/me` endpoint
     - If valid → allow request
     - If 401 → attempts refresh
  3. If no `authToken` but `refreshToken` exists → attempts refresh
  4. If refresh succeeds → sets new cookies and allows request
  5. If refresh fails → redirects to `/login`

#### For Auth Routes (`/login`)
- **Line 41-142**: If user has tokens, validates them
- **Validation Flow**:
  1. Tries `/me` with current token
  2. If 401 → attempts refresh
  3. If valid → redirects to home (server-side, no flash)
  4. If invalid → allows access to login page

### 2. Page Load (Client-Side)
**File**: `frontend/app/page.tsx`
**Line**: 72-112
**Trigger**: On component mount (useEffect)

- **Action**: 
  - Checks if `accessToken` is missing but `refreshToken` exists
  - If true, calls `/refresh` endpoint directly (not via apiClient)
  - Updates tokens in store
  - If refresh fails, clears auth

### 3. API Interceptor (Automatic)
**File**: `frontend/lib/api.ts`
**Line**: 41-97
**Trigger**: On any API call that returns 401

- **Action**: 
  - Automatically attempts token refresh
  - Retries original request
  - All API calls using `apiClient` benefit from this

### 4. Manual Refresh in saveOnClose
**File**: `frontend/app/page.tsx`
**Line**: 482-519
**Trigger**: When saving data on browser close and getting 401

- **Action**:
  - Detects 401 response
  - Calls `/refresh` endpoint directly (using fetch with keepalive)
  - Updates tokens
  - Retries save operation

### 5. Table Data Fetch
**File**: `frontend/app/page.tsx`
**Line**: 732-767
**Trigger**: On component mount and when filters change

- **Action**:
  - Checks if user is authenticated before fetching
  - Uses `tokenDataApi.getAll()` which goes through apiClient
  - If 401, apiClient interceptor handles refresh automatically

## API Endpoints Used

### Authentication Endpoints
1. **POST `/login`** - Login (no auth required)
   - Used in: `frontend/app/login/page.tsx`
   - Via: `authApi.login()`

2. **POST `/refresh`** - Refresh access token
   - Used in:
     - `frontend/middleware.ts` (server-side)
     - `frontend/app/page.tsx` (client-side, page load)
     - `frontend/app/page.tsx` (client-side, saveOnClose)
     - `frontend/lib/api.ts` (automatic, via interceptor)

3. **GET `/me`** - Get current user (requires auth)
   - Used in: `frontend/middleware.ts` (token validation)

4. **POST `/logout`** - Logout (requires auth)
   - Via: `authApi.logout()`

### Token Data Endpoints
1. **POST `/token-data`** - Save token data
   - Used in: `frontend/app/page.tsx` (auto-save, manual save, saveOnClose)
   - Via: `tokenDataApi.save()` or direct `fetch()` with keepalive

2. **GET `/token-data`** - Get all token data (paginated)
   - Used in: `frontend/app/page.tsx` (table data)
   - Via: `tokenDataApi.getAll()`

3. **GET `/token-data/date/{date}`** - Get by date
   - Via: `tokenDataApi.getByDate()`

4. **GET `/token-data/range`** - Get by date range
   - Via: `tokenDataApi.getByDateRange()`

## Token Refresh Flow Diagram

```
User Action
    │
    ├─→ Page Load
    │   ├─→ Middleware checks cookies
    │   │   ├─→ If authToken exists → validate via /me
    │   │   │   ├─→ Valid → Allow
    │   │   │   └─→ Invalid (401) → Refresh via /refresh
    │   │   └─→ If no authToken but refreshToken → Refresh via /refresh
    │   │
    │   └─→ Client-side useEffect
    │       └─→ If no accessToken but refreshToken → Refresh via /refresh
    │
    ├─→ API Call (via apiClient)
    │   ├─→ Request interceptor adds Authorization header
    │   ├─→ Response interceptor catches 401
    │   │   └─→ Automatically refreshes via /refresh
    │   │       └─→ Retries original request
    │
    └─→ Browser Close (saveOnClose)
        └─→ If 401 → Manual refresh via /refresh
            └─→ Retry save
```

## Issues Identified

### 1. Multiple Refresh Mechanisms
- Middleware refreshes on server-side
- Client-side useEffect refreshes on page load
- API interceptor refreshes on 401
- Manual refresh in saveOnClose

**Potential Issue**: Race conditions or duplicate refresh calls

### 2. Cookie vs Store Sync
- Tokens stored in:
  - Zustand store (localStorage)
  - Cookies (for middleware)
- `updateTokens()` updates both, but timing might differ

### 3. Direct fetch() Calls
- `saveOnClose` uses direct `fetch()` instead of `apiClient`
- `page.tsx` useEffect uses direct `fetch()` instead of `apiClient`
- These bypass the automatic refresh interceptor

## Recommendations

1. **Consolidate Refresh Logic**: Use apiClient for all API calls to benefit from automatic refresh
2. **Remove Duplicate Refresh**: The client-side useEffect refresh might be redundant if middleware handles it
3. **Cookie Sync**: Ensure cookies are always updated when tokens are refreshed
4. **Error Handling**: Add better error handling for refresh failures

