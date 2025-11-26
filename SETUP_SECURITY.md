# Security Setup Guide
## Image Converter - Production-Ready Multi-User Deployment

**Last Updated:** 2025-11-27

---

## 🎉 What We Built

A **production-ready, multi-user image conversion service** with:

✅ **Complete user isolation** - Users cannot access each other's files
✅ **Rate limiting** - Prevents API abuse and controls costs
✅ **File validation** - Magic number detection blocks malicious files
✅ **Session management** - Secure, encrypted cookie-based sessions
✅ **Security headers** - Protection against common web attacks
✅ **Private file storage** - Files stored outside public directory

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

**New dependencies added:**
- `iron-session` - Secure session management
- `file-type` - Magic number file validation
- Redis adapter is built-in (no external dependencies!)

---

### 2. Configure Environment Variables

Create a `.env` file (or `.env.local` for development):

```bash
cp .env.example .env
```

**Edit `.env` and configure:**

#### **SESSION_SECRET** (Required)

Generate a secure 32+ character secret:

```bash
# Generate secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and set in `.env`:

```env
SESSION_SECRET=your-generated-secret-here
```

⚠️ **IMPORTANT:**
- Must be at least 32 characters
- Keep this secret! Don't commit to Git
- Different secret for each environment (dev/staging/prod)

---

#### **REDIS_URL** (Optional but Recommended)

For rate limiting, we use Redis. You have two options:

**Option A: Use Regular Redis** (Recommended for Production)

```env
REDIS_URL=redis://localhost:6379/0
```

Examples:
```env
# Local Redis
REDIS_URL=redis://localhost:6379/0

# Redis with password
REDIS_URL=redis://:mypassword@localhost:6379/0

# Remote Redis
REDIS_URL=redis://user:pass@redis.example.com:6379/0
```

**Option B: In-Memory Adapter** (Development Only)

Leave `REDIS_URL` empty or unset:

```env
# REDIS_URL=
```

⚠️ **WARNING:** In-memory adapter:
- Not suitable for production
- Data lost on restart
- Only works with single server instance
- Use only for local development

---

#### **CACHE_MAX_AGE_MINUTES** (Optional)

How long to keep converted files before automatic cleanup:

```env
CACHE_MAX_AGE_MINUTES=15
```

Default: `15` minutes

Adjust based on your needs:
- Shorter (5-10 min): Less storage, faster cleanup
- Longer (30-60 min): Better UX, more storage

---

### 3. Start Redis (If Using)

**Option A: Docker** (Recommended)

```bash
docker run -d -p 6379:6379 redis:alpine
```

**Option B: Install Locally**

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

---

### 4. Start the Application

```bash
# Development
bun dev

# Production build
bun run build
bun start
```

---

## 🔒 Security Features Explained

### 1. Session-Based User Isolation

**What it does:**
- Each visitor gets a unique session ID
- Files stored in session-specific directories
- Users can ONLY access their own files

**How it works:**
```
User A visits → Session ID: abc123 → Files in .cache/uploads/abc123/
User B visits → Session ID: def456 → Files in .cache/uploads/def456/
```

User A **cannot** access User B's files (403 Forbidden).

**Implementation:**
- `lib/session.ts` - Session management
- `middleware.ts` - Auto-creates sessions
- All API routes validate session ownership

---

### 2. Rate Limiting

**What it does:**
- Prevents API abuse
- Controls server costs
- Protects against DoS attacks

**Limits configured:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| All APIs | 60 requests | 1 minute |
| Conversions | 20 conversions | 1 hour |

**How it works:**
- Uses Redis (or in-memory for dev)
- Sliding window algorithm
- Returns `429 Too Many Requests` when exceeded
- Includes `Retry-After` header

**Customize limits:**
Edit `lib/ratelimit.ts`:

```typescript
export const ipRateLimiter = new SlidingWindowRateLimiter({
  limit: 100,     // Increase limit
  window: 60,     // Keep 1 minute window
  prefix: "ratelimit:ip",
});
```

---

### 3. File Validation (Magic Numbers)

**What it does:**
- Detects real file type from binary content
- Prevents malicious files disguised as images
- Blocks executables renamed to .jpg

**How it works:**
```
User uploads "virus.exe" renamed to "photo.jpg"
↓
Read first 4KB of file
↓
Detect magic number: 4D 5A (EXE signature)
↓
❌ REJECTED - Not a real image!
```

**Supported formats:**
- JPEG, PNG, WebP, GIF
- AVIF, TIFF, BMP
- SVG (with XML validation)

**Implementation:**
- `lib/fileValidation.ts` - Magic number detection
- Uses `file-type` library
- Validates before processing

---

### 4. Security Headers

**What it does:**
- Prevents clickjacking
- Blocks XSS attacks
- Disables unnecessary browser features

**Headers added:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=()...
```

**Implementation:**
- `middleware.ts` - Adds headers to all responses

---

### 5. Private File Storage

**What it does:**
- Files NOT accessible via direct URL
- Must go through API with session validation
- Prevents unauthorized access

**Before:**
```
Files in: ./public/uploads/temp/
Direct access: ✅ https://example.com/uploads/temp/file.jpg (BAD!)
```

**After:**
```
Files in: ./.cache/uploads/
Direct access: ❌ Not in public/ directory (GOOD!)
API access: ✅ /api/download/[sessionId]/[filename] (with validation)
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser                       │
│  - Receives encrypted session cookie            │
│  - All requests include session automatically   │
└─────────────────────────────────────────────────┘
                      ↓ HTTPS
┌─────────────────────────────────────────────────┐
│              Next.js Middleware                 │
│  1. Create/validate session                     │
│  2. Check rate limits (Redis)                   │
│  3. Add security headers                        │
│  4. Continue or block (429)                     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│                 API Routes                      │
│  /api/convert:                                  │
│   - Validate file (magic numbers)               │
│   - Check file size (<50MB)                     │
│   - Save to session directory                   │
│   - Convert with Sharp                          │
│   - Return download URLs                        │
│                                                 │
│  /api/download/[sessionId]/[filename]:          │
│   - Verify session ownership                    │
│   - Check path traversal                        │
│   - Serve file from session dir                 │
│                                                 │
│  /api/cache/clear:                              │
│   - Clear only user's session files             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│            File System (Isolated)               │
│  .cache/uploads/                                │
│    ├── session-abc123/                          │
│    │   ├── file1.jpg (User A only)              │
│    │   └── file1.webp (User A only)             │
│    │                                             │
│    └── session-def456/                          │
│        ├── file2.jpg (User B only)              │
│        └── file2.webp (User B only)             │
│                                                 │
│  ✅ Completely isolated per session             │
│  ✅ Auto-cleanup after 15 minutes               │
│  ✅ Not in public/ directory                    │
└─────────────────────────────────────────────────┘
```

---

## 🧪 Testing the Security Features

### Test 1: User Isolation

1. Open browser A → Upload image → Note session ID from devtools
2. Open browser B (incognito) → Upload image → Different session ID
3. Try to access Browser A's files from Browser B using direct URL
4. **Expected:** 403 Forbidden ✅

### Test 2: Rate Limiting

1. Make 61 API requests within 1 minute
2. **Expected:** 429 Too Many Requests on 61st request ✅
3. Wait 1 minute → Try again
4. **Expected:** Works again ✅

### Test 3: File Validation

1. Rename a `.exe` file to `.jpg`
2. Try to upload it
3. **Expected:** 400 Bad Request - "Invalid file type detected" ✅

### Test 4: Path Traversal

1. Try to download: `/api/download/session123/../../../etc/passwd`
2. **Expected:** 400 Bad Request - "Invalid filename" ✅

### Test 5: Session Expiry

1. Upload and convert images
2. Wait 15 minutes (or `CACHE_MAX_AGE_MINUTES`)
3. Try to download files
4. **Expected:** 410 Gone - "File expired" ✅

---

## 🔧 Customization

### Change Rate Limits

Edit `lib/ratelimit.ts`:

```typescript
// Increase per-IP limit
export const ipRateLimiter = new SlidingWindowRateLimiter({
  limit: 120,    // Changed from 60
  window: 60,
  prefix: "ratelimit:ip",
});

// More generous conversion limit
export const conversionRateLimiter = new SlidingWindowRateLimiter({
  limit: 50,     // Changed from 20
  window: 3600,
  prefix: "ratelimit:conversion",
});
```

### Change File Size Limit

Edit `lib/fileValidation.ts`:

```typescript
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // Change to 100MB
```

### Change Cache Expiry

Edit `.env`:

```env
CACHE_MAX_AGE_MINUTES=30  # Changed from 15
```

### Replace Redis Implementation

The Redis adapter is modular! See `lib/redis/adapter.ts` for instructions on swapping to ioredis or Upstash.

---

## 🚨 Production Checklist

Before deploying to production:

- [ ] `SESSION_SECRET` is set and secure (32+ chars)
- [ ] Using real Redis (not in-memory adapter)
- [ ] `REDIS_URL` points to production Redis
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (session cookies require secure)
- [ ] Rate limits are appropriate for your traffic
- [ ] File size limits match your server capacity
- [ ] Cache expiry time makes sense for your use case
- [ ] `.env` file is in `.gitignore` (don't commit secrets!)
- [ ] Tested all security features (see tests above)
- [ ] Set up monitoring/logging for rate limit hits
- [ ] Configure Redis persistence (if needed)

---

## 📈 Monitoring & Logging

**What to monitor:**

1. **Rate Limit Hits**
   - Check logs for `Rate limit exceeded` warnings
   - Adjust limits if legitimate users are affected

2. **Failed File Validations**
   - Look for `File validation failed` in logs
   - May indicate malicious upload attempts

3. **Session Mismatches**
   - `Session mismatch` warnings in download API
   - Possible attack or session cookie issues

4. **Redis Connection**
   - Monitor Redis availability
   - Falls back gracefully but logs warnings

**Example log queries:**

```bash
# See rate limit violations
grep "Rate limit exceeded" logs/*

# See session mismatch attempts
grep "Session mismatch" logs/*

# See file validation failures
grep "validation failed" logs/*
```

---

## 🆘 Troubleshooting

### "SESSION_SECRET is not configured"

**Cause:** Missing or invalid `SESSION_SECRET` in `.env`

**Fix:**
```bash
# Generate secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
echo "SESSION_SECRET=<your-secret>" >> .env
```

### "REDIS_URL not configured. Using in-memory adapter"

**Cause:** Redis not configured

**Fix (Production):**
```env
# Add to .env
REDIS_URL=redis://localhost:6379/0
```

**Fix (Development):**
This is OK for dev! Just a warning.

### Rate Limiting Not Working

**Check:**
1. Is Redis running? `redis-cli ping`
2. Is `REDIS_URL` correct in `.env`?
3. Check logs for Redis connection errors

### Files Not Downloading

**Check:**
1. Session cookie enabled in browser?
2. File hasn't expired (>15 mins)?
3. Check browser devtools for 403/410 errors
4. Verify session ID matches in request

---

## 🔄 Migration from Old Version

If you're migrating from the old version (without security):

### 1. All existing uploaded files will be inaccessible

Old files were in `./public/uploads/temp/` without session isolation.
They won't work with the new session-based system.

**Solution:** Clear old files before deploying:

```bash
rm -rf ./public/uploads/temp/*
```

### 2. Download URLs have changed

**Old:**
```
/api/download/file.webp
```

**New:**
```
/api/download/[sessionId]/file.webp
```

The frontend has been updated to use the new format automatically.

### 3. Environment variables required

Old version worked without any env vars.
New version requires:

- `SESSION_SECRET` (required)
- `REDIS_URL` (optional but recommended)

---

## 📚 Additional Resources

- **Session Management:** `lib/session.ts`
- **Rate Limiting:** `lib/ratelimit.ts`
- **File Validation:** `lib/fileValidation.ts`
- **Redis Adapter:** `lib/redis/adapter.ts`
- **Middleware:** `middleware.ts`
- **Security Audit:** `SECURITY_AUDIT.md`

---

## 🎯 Summary

You now have a **production-ready, secure, multi-user image conversion service** with:

✅ Complete isolation between users
✅ Protection against malicious files
✅ Rate limiting to control costs
✅ Security headers for web protection
✅ Private file storage
✅ Automatic cleanup
✅ Comprehensive logging

**Ready to deploy!** 🚀
