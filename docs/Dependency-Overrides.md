# Dependency Overrides

This file documents the `overrides` block in `package.json`. Overrides are forced version pins applied to transitive dependencies. They should be treated as load-bearing: removing one without verifying the downstream consumer has been fixed will break the bundler or the app.

---

## `call-bind` → `1.0.7`

**Added:** 2026-05-26
**Bundler error it fixes:**

```
Unable to resolve "call-bind/callBound" from "node_modules\assert\build\assert.js"
```

### Why

`expo-notifications@0.31.5` depends on `assert@2.1.0`, which still imports the deep subpath `require('call-bind/callBound')`.

That subpath existed in `call-bind` up through `1.0.7`. Starting with `call-bind@1.0.8`, the `callBound` functionality was extracted into a separate package (`call-bound`) and the `callBound.js` file was removed from `call-bind`. `npm install` without an override resolves to `call-bind@1.0.9`, which has no `callBound.js`, so Metro fails to resolve the import and floods the dev server with the error above on every reload.

### What the override does

Forces every transitive install of `call-bind` (anywhere in the tree) to use `1.0.7`, which still ships `callBound.js`. Verified with:

```powershell
npm ls call-bind
# all entries show: call-bind@1.0.7 overridden

ls node_modules/assert/node_modules/call-bind/callBound.js
# file exists
```

### When this override can be removed

Remove the override the first time **all** of the following are true:

1. `expo-notifications` has bumped past `0.31.5` AND its lockfile pulls in `assert@>=2.1.1` (or any version that has dropped the `require('call-bind/callBound')` line).
2. Nothing else in the dep tree still references the dead subpath. Check with:
   ```powershell
   npm ls call-bind
   ```
   If everything resolves cleanly without the override, you're good.

After removing, run `npx expo start --clear` and watch the Metro log for the resolution error. If it's gone, the override is safe to delete.

### Why not the alternatives

- **`npm install call-bound`** — does not help. The failing import is the literal subpath `call-bind/callBound`, not the standalone `call-bound` package. Adding `call-bound` would still leave the subpath unresolved.
- **Metro resolver alias** — would work, but adds a `metro.config.js` that has to be maintained and re-tested on every Expo SDK upgrade. The override is one line and platform-agnostic.
- **Stub `assert` out at the bundler level** — risky. Other RN code or polyfills may legitimately call into `assert` at runtime; stubbing silently swallows assertion failures.
