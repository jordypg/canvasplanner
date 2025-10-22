# How to Start the Workflow Canvas App

## Quick Start (Most Common)

```bash
npm run dev
```

Then open your browser to: **http://localhost:3000**

---

## Troubleshooting Guide

### If you see "EADDRINUSE: address already in use"

This means port 3000 is already occupied. Kill the process:

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### If you see 404 errors or the app doesn't load properly

Clear the Next.js cache and rebuild:

```bash
# Stop any running processes
lsof -ti:3000 | xargs kill -9

# Clear the cache
rm -rf .next

# Rebuild
npm run build

# Start fresh
npm run dev
```

### Full Reset (Nuclear Option)

If nothing else works, do a complete clean start:

```bash
# 1. Stop all processes
lsof -ti:3000 | xargs kill -9

# 2. Clear all caches and dependencies
rm -rf .next node_modules package-lock.json

# 3. Reinstall dependencies
npm install

# 4. Build the app
npm run build

# 5. Start the dev server
npm run dev
```

---

## What You Should See

When the app starts successfully, you'll see:

```
> figma-app@0.1.0 dev
> node server.js

> Ready on http://localhost:3000
 ✓ Compiled / in X.Xs
🔗 Convex URL: https://amicable-hare-812.convex.cloud
 GET / 200 in XXXms
```

---

## Features Available

Once running, you can:

- **Select Tool (V)** - Select and move elements
- **Add Node (N)** - Create new workflow nodes by dragging
- **Connect (C)** - Connect nodes with edges
- **Edit (E)** - Edit node properties
- **Zoom Controls** - Use +/- buttons or Ctrl/Cmd + Plus/Minus
- **Collaborative Cursors** - See other users' cursors in real-time

---

## Important Notes

- The app connects to a **hosted Convex instance** (not local)
- No need to run `npx convex dev` separately
- Socket.IO server runs automatically with the dev server
- All data is persisted to the cloud Convex database

---

## Running Tests

```bash
npm test
```

All 101 tests should pass.

---

## Building for Production

```bash
npm run build
npm start
```
