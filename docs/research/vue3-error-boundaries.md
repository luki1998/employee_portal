# Vue 3 error-isolation patterns: `onErrorCaptured`, `errorCaptured`, and "error boundary" components

Research task only — no design recommendations. All claims below are cited to a primary
source: the current Vue 3 documentation (vuejs.org), the Vue 3 core source on GitHub
(`vuejs/core`, `main` branch, fetched 2026-08-20), or an npm-registry/README check of the
community packages mentioned.

---

## 1. API shape: `onErrorCaptured` (Composition API)

Source: https://vuejs.org/api/composition-api-lifecycle.html#onerrorcaptured

```ts
function onErrorCaptured(callback: ErrorCapturedHook): void

type ErrorCapturedHook = (
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string
) => boolean | void
```

Arguments:
- `err: unknown` — the thrown error/rejection value.
- `instance: ComponentPublicInstance | null` — the component instance that triggered the error (the descendant, not the boundary itself).
- `info: string` — a description of where the error originated (`"render function"`, `"setup function"`, `"watcher callback"`, etc. — full list in section 3). In production builds this is a short code (`"5"`, `"bc"`, …) instead of the full string, per the Production Error Code Reference (https://vuejs.org/error-reference/).

Return-value semantics (quoted from the docs):
- Return `false` → **"stops the error from propagating further."**
- Return `undefined`/void → the error keeps propagating (to the next `errorCaptured` hook up the chain, then to `app.config.errorHandler`).

Registered inside `setup()`, like any other Composition API lifecycle hook (`onMounted`, `onUnmounted`, etc.).

---

## 2. API shape: `errorCaptured` option (Options API)

Source: https://vuejs.org/api/options-lifecycle.html#errorcaptured

```ts
interface ComponentOptions {
  errorCaptured?(
    this: ComponentPublicInstance,
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ): boolean | void
}
```

Same three arguments and the same `false`-stops-propagation / `undefined`-propagates semantics as `onErrorCaptured`. It is the Options API surface for the identical underlying mechanism (both compile down to a hook registered on `instance.ec` — see §7).

---

## 3. What IS caught (with citations)

The `app.config.errorHandler` API doc (https://vuejs.org/api/application.html#app-config-errorhandler) and both lifecycle-hook docs (§1, §2) list the same source set verbatim:

> "It can capture errors from the following sources:
> - Component renders
> - Event handlers
> - Lifecycle hooks
> - `setup()` function
> - Watchers
> - Custom directive hooks
> - Transition hooks"

Cross-checked against the actual dispatch table in Vue 3 core, `packages/runtime-core/src/errorHandling.ts` (https://github.com/vuejs/core/blob/main/packages/runtime-core/src/errorHandling.ts), which defines the `ErrorCodes` enum and `ErrorTypeStrings` map used by every call site:

```ts
export enum ErrorCodes {
  SETUP_FUNCTION,
  RENDER_FUNCTION,
  // watch codes now live in @vue/reactivity as WatchErrorCodes
  NATIVE_EVENT_HANDLER = 5,
  COMPONENT_EVENT_HANDLER,
  VNODE_HOOK,
  DIRECTIVE_HOOK,
  TRANSITION_HOOK,
  APP_ERROR_HANDLER,
  APP_WARN_HANDLER,
  FUNCTION_REF,
  ASYNC_COMPONENT_LOADER,
  SCHEDULER,
  COMPONENT_UPDATE,
  APP_UNMOUNT_CLEANUP,
}
```

plus the full lifecycle-hook set (`beforeCreate` … `unmounted`, `activated`/`deactivated`, `errorCaptured` itself, `renderTracked`/`renderTriggered`, `serverPrefetch`) and, in `@vue/reactivity`'s `watch.ts`, `WatchErrorCodes.WATCH_GETTER`/`WATCH_CALLBACK`/`WATCH_CLEANUP`. The full code→string table is also published at https://vuejs.org/error-reference/ (used to decode production error codes).

Confirmed specifically for this task's checklist:

- **Synchronous render function errors of descendants — YES.** `RENDER_FUNCTION` is wrapped via `callWithErrorHandling` in the render pipeline; this is the textbook error-boundary case.
- **Errors thrown during a descendant's `setup()` — YES, when synchronous.** In `packages/runtime-core/src/component.ts`, `setup()` is invoked as `callWithErrorHandling(setup, instance, ErrorCodes.SETUP_FUNCTION, [...])`, so a synchronous throw is caught and routed through `handleError` (→ the parent chain's `errorCaptured` hooks → `app.config.errorHandler`) exactly like a render error. See §4 for the **async** setup caveat, which is different.
- **Watchers, computed, lifecycle hooks of descendants — YES for watchers and lifecycle hooks** (verified from source: `WatchErrorCodes.WATCH_GETTER/WATCH_CALLBACK/WATCH_CLEANUP` in `packages/reactivity/src/watch.ts`, and every named lifecycle hook in `ErrorTypeStrings`). Computed properties are not a distinct entry in this table — a throwing computed getter surfaces as part of whatever consumes it (a render, another watcher's getter, etc.), which is itself instrumented, so the error still reaches `handleError` at that consuming site, just not tagged as its own `"computed"` category.
- **Native/component event handlers (`@click` etc.) — YES**, and this is the one place the source contradicts a common assumption carried over from React. `packages/runtime-dom/src/modules/events.ts`'s `createInvoker()` calls:
  ```ts
  callWithAsyncErrorHandling(handler, instance, ErrorCodes.NATIVE_EVENT_HANDLER, [e])
  ```
  for every `v-on`-bound DOM listener, and component-emitted (`$emit`) listeners go through the equivalent `COMPONENT_EVENT_HANDLER` code path. `callWithAsyncErrorHandling` both try/catches the synchronous call **and**, if the handler itself is an `async function` that returns a Promise, attaches `.catch(err => handleError(...))` to that returned promise (see next section for the exact code). So a synchronous throw in `@click="onClick"`, and a rejection from an `async onClick()` bound the same way, both reach `errorCaptured`/`onErrorCaptured`. This is documented explicitly ("Event handlers" is listed as a captured source on all three API pages above) and independently confirmed by the GitHub issue thread titled "Unhandled error during execution of native event handler" (https://github.com/vuejs/core/issues/5180) — that exact string is the `warn()` message `logError()` emits (`` `Unhandled error during execution of ${info}` `` where `info = "native event handler"`), i.e. the warning is proof the error *did* flow through Vue's `handleError`, not evidence it bypassed it.

---

## 4. What is NOT caught / caveats (with citations)

- **Async setup() without a `<Suspense>` ancestor — NOT routed to `errorCaptured`.** From `packages/runtime-core/src/component.ts` (`setupStatefulComponent`): if `setup()` returns a Promise (`isAsyncSetup`) and this is a client (non-SSR) render, the code takes the `__FEATURE_SUSPENSE__` branch:
  ```ts
  instance.asyncDep = setupResult
  if (__DEV__ && !instance.suspense) {
    warn(
      `Component <${name}>: setup function returned a promise, but no ` +
      `<Suspense> boundary was found in the parent component tree. ` +
      `A component with async setup() must be nested in a <Suspense> ` +
      `in order to be rendered.`,
    )
  }
  ```
  No `.catch()` is attached here. The `.catch(err => handleError(err, instance, ErrorCodes.SETUP_FUNCTION))` that actually routes an async-setup rejection into the error-boundary chain only exists in `registerDep()` in `packages/runtime-core/src/components/Suspense.ts` (https://github.com/vuejs/core/blob/main/packages/runtime-core/src/components/Suspense.ts):
  ```ts
  instance.asyncDep!.catch(err => {
    handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
  })
  ```
  `registerDep` only runs as part of a `<Suspense>` boundary's dependency tracking. **Net effect: a rejected async `setup()` is only captured by `errorCaptured`/`onErrorCaptured` if the component is inside a `<Suspense>`; otherwise it is an unhandled promise rejection that Vue's component-tree error handling never sees**, matching the SSR branch which explicitly does its own separate `.catch(e => handleError(e, instance, ErrorCodes.SETUP_FUNCTION))` only for server rendering.

- **Code that escapes the synchronous call stack and isn't a Promise Vue is holding onto — NOT caught.** `callWithAsyncErrorHandling` (in `errorHandling.ts`) only extends coverage to a Promise that is the *direct return value* of the wrapped call:
  ```ts
  const res = callWithErrorHandling(fn, instance, type, args)
  if (res && isPromise(res)) {
    res.catch(err => { handleError(err, instance, type) })
  }
  ```
  A `setTimeout`/`setInterval` callback scheduled from inside a watcher, event handler, or lifecycle hook is **not itself re-entered through this wrapper** — if that timer callback throws, it is a plain uncaught exception on a later turn of the event loop, invisible to `errorCaptured`. Likewise, a `.then()`/`.catch()` chain built inside a handler but not returned from it (fire-and-forget) is not tracked, so a throw inside that detached chain is an unhandled rejection outside Vue's error system. This is a direct reading of the source, not documented as a caveat in prose on vuejs.org — the docs only affirmatively state what IS captured; no current guide page enumerates "what is not."

- **DOM listeners registered outside Vue's binding system — NOT caught.** Only listeners attached through `v-on`/the compiled `patchEvent` path go through `createInvoker`'s `callWithAsyncErrorHandling` wrapper (per §3). A listener a component adds itself via `el.addEventListener(...)` in `onMounted`, bypassing Vue's template compiler, runs completely outside this instrumentation, and a throw there is an ordinary uncaught exception.

- **A boundary does NOT protect itself.** `handleError()` (in `errorHandling.ts`) starts walking from `instance.parent`:
  ```ts
  let cur = instance.parent
  ...
  while (cur) {
    const errorCapturedHooks = cur.ec
    ...
    cur = cur.parent
  }
  ```
  The originating `instance` itself is never checked against its own `.ec` array — only ancestors are. So a component that registers `onErrorCaptured` only guards against errors thrown by *descendants*; an error in the boundary component's own `setup()`, its own render function, or the `onErrorCaptured` callback itself is not caught by that same registration. (The docs state this positively rather than negatively: "the hook itself throws" is handled as a separate, explicit case — see next bullet — implying the hook's own component is not self-protecting.)

- **No dedicated "Error Handling" guide page currently exists on vuejs.org.** I could not find a guide-section page (e.g. under `/guide/best-practices/`) dedicated to error handling; a WebFetch to a guessed `https://vuejs.org/error-handling` URL 404s, and targeted site searches turned up nothing beyond the three API reference pages (`api/composition-api-lifecycle`, `api/options-lifecycle`, `api/application`) and the production error-code reference (`/error-reference/`). All authoritative first-party text on this topic currently lives on those API reference pages, not a narrative guide.

---

## 5. Hook throws / multiple nested boundaries

Source: both lifecycle API pages (§1, §2), corroborated by `handleError()` in `errorHandling.ts`.

- **If the `errorCaptured`/`onErrorCaptured` hook itself throws:** *"If the `errorCaptured` hook itself throws an error, both this error and the original captured error are sent to `app.config.errorHandler`."*
- **Multiple nested boundaries, inner one returns `undefined`:** *"If multiple `errorCaptured` hooks exist on a component's inheritance chain or parent chain, all of them will be invoked on the same error, in the order of bottom to top. This is similar to the bubbling mechanism of native DOM events."* This matches the source loop above: `cur = instance.parent` then `cur = cur.parent`, invoking every hook found on `cur.ec` at each level, stopping the walk only on the first hook (bottom-most first) that returns `=== false`.
- If **no** hook anywhere in the chain returns `false`, the walk exhausts all ancestors and falls through to `appContext.config.errorHandler` if one is set; if not, it falls through to `logError()`, which in dev re-throws by default (`throwInDev = true`) and in production calls `console.error` (or re-throws if `throwUnhandledErrorInProduction` is configured).

---

## 6. Interaction with `app.config.errorHandler`

Source: https://vuejs.org/api/application.html#app-config-errorhandler, plus §1/§2 pages, plus `handleError()` source.

- Docs state plainly: *"By default, all errors are still sent to the application-level `app.config.errorHandler` if it is defined, so that these errors can still be reported to an analytics service in a single place."*
- But a component boundary returning `false` **does** suppress the global handler for that error: *"An `errorCaptured` hook can return `false` to prevent the error from propagating further... It will prevent any additional `errorCaptured` hooks or `app.config.errorHandler` from being invoked for this error."* The source confirms this precisely — the `while (cur)` loop `return`s immediately on a `false` result, before ever reaching the `if (errorHandler) { ... }` block below it.
- `app.config.errorHandler`'s own signature (`(err, instance, info) => void`) has **no return-value semantics at all** — it cannot itself stop further propagation (there is nowhere further to propagate to; it's the last stop before `logError`).

---

## 7. Community "error boundary" wrapper pattern

The idiomatic hand-rolled pattern (this exact shape appears throughout Vue's own examples/discussions and is what every community package below reimplements) is:

```vue
<script setup>
import { ref, onErrorCaptured } from 'vue'

const error = ref(null)
onErrorCaptured((err) => {
  error.value = err
  return false // stop propagation, suppress default console reporting
})
</script>

<template>
  <slot v-if="!error" />
  <slot v-else name="fallback" :error="error" />
</template>
```

This directly follows from the documented state-mutation guidance on the `onErrorCaptured` API page: *"You can modify component state in `onErrorCaptured()` to display an error state to the user. However, it is important that the error state should not render the original content that caused the error; otherwise the component will be thrown into an infinite render loop."* — i.e. the `v-if="!error"` / fallback-slot split exists specifically to satisfy that constraint (never re-render the subtree that just threw).

### Verified community packages (npm-registry + README checked, not just blog mentions)

| Package | npm latest | Last publish | Vue version | Notes |
|---|---|---|---|---|
| **vue-error-boundary** (dillonchanis) | `2.0.3` | 2024-01-17 | Vue 3 only ("Requires Vue3" per README) | https://github.com/dillonchanis/vue-error-boundary — component `<VErrorBoundary>`, props `fall-back` (fallback component), `on-error` callback, `params`, `stop-propagation`; scoped-slot exposes `error`/`hasError`/`info`. README does not document async-error or event-handler limitations explicitly — this reflects onErrorCaptured's own scope (see §3–4), not an extra limitation of the package. |
| **vu-error-boundary** (liaoliao666) | `0.0.4` | 2021-02-03 | Vue 3 | https://github.com/liaoliao666/vu-error-boundary — small (`0.0.x`), stale since 2021; provides a `resetErrorBoundary` callback to the fallback slot in addition to the error. |
| **v-error-boundary** | `0.0.8` | 2023-08-24 | Vue 3 | Small, low-version-number package; exists on npm but no evidence of wide adoption (no download/star data pulled). |

None of these are large, "framework-official" or widely-depended-upon packages (all sit at pre-1.0 or low major versions with modest publish cadence); they are thin wrappers around the exact `onErrorCaptured` + conditional-slot idiom above, not independent error-catching mechanisms — they inherit every capture/no-capture behavior documented in §3–4 from the underlying hook. A community search also surfaced general commentary (not verified against source) that boundaries built this way can't catch async errors that happen outside a call Vue is directly awaiting — consistent with the source-verified §4 findings on `setTimeout`/detached promise chains and non-Suspense async `setup()`.

---

## Citations

- `onErrorCaptured` API reference — https://vuejs.org/api/composition-api-lifecycle.html#onerrorcaptured
- `errorCaptured` option API reference — https://vuejs.org/api/options-lifecycle.html#errorcaptured
- `app.config.errorHandler` API reference — https://vuejs.org/api/application.html#app-config-errorhandler
- Production Error Code Reference — https://vuejs.org/error-reference/
- Vue 3 core, `errorHandling.ts` (ErrorCodes enum, `callWithErrorHandling`, `callWithAsyncErrorHandling`, `handleError`, `logError`) — https://github.com/vuejs/core/blob/main/packages/runtime-core/src/errorHandling.ts
- Vue 3 core, `component.ts` (`setupStatefulComponent`, async-setup / Suspense branch) — https://github.com/vuejs/core/blob/main/packages/runtime-core/src/component.ts
- Vue 3 core, `components/Suspense.ts` (`registerDep`, async-dep error routing) — https://github.com/vuejs/core/blob/main/packages/runtime-core/src/components/Suspense.ts
- Vue 3 core, `runtime-dom/src/modules/events.ts` (`createInvoker`, native/component event handler wrapping) — https://github.com/vuejs/core/blob/main/packages/runtime-dom/src/modules/events.ts
- Vue 3 reactivity core, `watch.ts` (`WatchErrorCodes`) — https://github.com/vuejs/core/blob/main/packages/reactivity/src/watch.ts
- GitHub issue confirming the "native event handler" warning text originates from Vue's own `handleError`/`logError`, not from an uncaught/bypassed error — https://github.com/vuejs/core/issues/5180
- `vue-error-boundary` npm registry metadata — https://registry.npmjs.org/vue-error-boundary ; README — https://github.com/dillonchanis/vue-error-boundary/blob/main/README.md
- `vu-error-boundary` npm registry metadata — https://registry.npmjs.org/vu-error-boundary ; repo — https://github.com/liaoliao666/vu-error-boundary
- `v-error-boundary` npm registry metadata — https://registry.npmjs.org/v-error-boundary
- Attempted and not found: a dedicated vuejs.org "Error Handling" guide page (`https://vuejs.org/error-handling` returns HTTP 404; no equivalent found under `/guide/best-practices/` via search) — all first-party narrative content currently lives on the API reference pages listed above.
