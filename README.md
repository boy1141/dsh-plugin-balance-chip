# dsh-plugin-balance-chip

A live DeepSeek account balance chip for the DeepSeek Harness web GUI. It sits in the
session header next to the other header actions and shows the remaining credit, the
unused bonus credit, and when the number was last read.

在 DeepSeek Harness 的会话标题栏实时显示账户余额：主数字是账户余额，`+` 后面是尚未用完的赠送额度，
悬停可看更新时间，点击立即刷新。

## What it does

- Reads `ctx.remote.account.getBalance()` — the same Host-side platform query the
  Settings → Account panel uses. The browser never holds the account token.
- Refreshes every 20 seconds while the page is visible, and immediately when the window
  regains focus or the tab becomes visible again.
- Hides itself when signed out; shows a red dot and “balance unavailable” on failure,
  and a click retries.
- Follows the interface language (zh / en) and the theme's CSS variables.

## Install

```sh
dsh plugin add dsh-plugin-balance-chip
```

Or in the Web GUI: Settings → Plugins → search the market for `dsh-plugin-balance-chip`.

## Files

| File | Role |
|---|---|
| `lib/index.js` | Host half — an empty mount that gives the Loader an enabled entry |
| `lib/client.js` | Browser half — slot registration, polling store, chip component |
| `cordis.patch.yml` | The Loader row this bundle inserts (`id: balance-chip`) |

## Development

`tools/smoke-client.mjs` (in the contributing workspace) simulates the DSH module loader,
React, and the account Remote to check the bundle id, exports, slot registration,
polling state machine, and the rendered amount text.
