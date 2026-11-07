window.__ModuleLoader__.load({
	id: "dsh-plugin-balance-chip",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const h = react.createElement;

		//#region styles
		const STYLE_ID = "dsh-plugin-balance-chip/chip.css";
		const STYLE_TEXT = `
.dsh-balance-chip{display:inline-flex;align-items:center;gap:6px;height:24px;max-width:100%;padding:0 9px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));background:transparent;color:var(--dsw-alias-label-primary,inherit);font:500 12px/1 inherit;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.dsh-balance-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dsh-balance-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px}
.dsh-balance-dot{flex:none;width:6px;height:6px;border-radius:50%;background:#22c55e}
.dsh-balance-chip[data-phase="loading"] .dsh-balance-dot{background:#f59e0b;animation:dsh-balance-pulse 1.2s ease-in-out infinite}
.dsh-balance-chip[data-phase="error"] .dsh-balance-dot{background:#ef4444}
.dsh-balance-bonus{margin-left:2px;color:var(--dsw-alias-label-secondary,#8a8a8a);font-weight:400}
.dsh-balance-label{overflow:hidden;text-overflow:ellipsis}
@keyframes dsh-balance-pulse{0%,100%{opacity:1}50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.dsh-balance-chip[data-phase="loading"] .dsh-balance-dot{animation:none}}
`;
		if (typeof document !== "undefined") {
			const existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]");
			if (existing === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-plugin-balance-chip";
				tag.dataset.pluginCss = STYLE_ID;
				tag.textContent = STYLE_TEXT;
				document.head.appendChild(tag);
			}
		}
		//#endregion

		//#region copy
		/** Chip copy; the active UI language picks the dictionary at render time. */
		const en = {
			balance: "Balance",
			loading: "Balance",
			unavailable: "Balance unavailable",
			account: "Account balance",
			bonus: "Bonus balance",
			updated: "Updated",
			refresh: "Click to refresh",
			signIn: "Sign in to see balance"
		};
		const zh = {
			balance: "余额",
			loading: "余额",
			unavailable: "余额不可用",
			account: "账户余额",
			bonus: "赠送余额",
			updated: "更新于",
			refresh: "点击刷新",
			signIn: "登录后显示余额"
		};
		//#endregion

		//#region formatting
		const SYMBOL = { CNY: "\u00a5", USD: "$" };

		/** @param {string} currency - wallet currency code. @returns the display symbol. */
		function symbol(currency) {
			return SYMBOL[currency] ?? (currency ? currency + " " : "");
		}

		/** @param {string} value - decimal string from the platform. @returns a finite number, or null. */
		function numeric(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}

		/** @param {string} value - decimal string from the platform. @returns two grouped decimals, or the raw text. */
		function amount(value) {
			const parsed = numeric(value);
			if (parsed === null) return String(value ?? "");
			return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}

		/** @param {string} value - decimal string from the platform. @returns whether the wallet carries credit. */
		function positive(value) {
			const parsed = numeric(value);
			return parsed !== null && parsed > 0;
		}

		/** @returns the Host release version carried by the boot graph, or a safe fallback. */
		function clientVersion() {
			try {
				const release = window.__DSH_BOOT__ && window.__DSH_BOOT__.release;
				const version = typeof release === "string" ? release : release && release.version;
				if (typeof version === "string" && version !== "") return version;
			} catch {}
			return "0.2.2-rc.1";
		}
		//#endregion

		//#region store
		/**
		 * Poll the account Remote for wallets and keep one snapshot for every chip instance.
		 * Polling runs only while a chip is mounted and the document is visible.
		 */
		function createBalanceStore(ctx) {
			let state = { phase: "loading", wallets: [], bonusWallets: [], updatedAt: 0 };
			const listeners = new Set();
			let timer = null;
			let inFlight = null;
			let disposed = false;

			const publish = (next) => {
				state = next;
				for (const listener of [...listeners]) listener();
			};

			const metadata = () => ({
				version: clientVersion(),
				locale: ctx.locale.getSnapshot().active,
				timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
			});

			/** Read the platform wallet summary once; concurrent callers share one request. */
			const read = () => {
				if (disposed) return Promise.resolve();
				if (inFlight !== null) return inFlight;
				inFlight = (async () => {
					const account = ctx.remote && ctx.remote.account;
					if (!account || typeof account.getBalance !== "function") {
						publish({ ...state, phase: "hidden" });
						return;
					}
					let result;
					try {
						result = await account.getBalance(metadata());
					} catch (error) {
						const code = error && (error.code || (error.data && error.data.code));
						publish({ ...state, phase: code === "ACCOUNT_SIGN_IN_REQUIRED" ? "hidden" : "error" });
						return;
					}
					if (!result || result.ok !== true) {
						publish({ ...state, phase: "error" });
						return;
					}
					const value = result.value;
					if (value === null || value === undefined) {
						publish({ ...state, phase: "hidden" });
						return;
					}
					if (value.status !== "ready") {
						publish({ ...state, phase: "error" });
						return;
					}
					publish({
						phase: "ready",
						wallets: Array.isArray(value.value) ? value.value : [],
						bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
						updatedAt: Date.now()
					});
				})().finally(() => {
					inFlight = null;
				});
				return inFlight;
			};

			const syncTimer = () => {
				if (disposed) return;
				const polling = listeners.size > 0 && typeof document !== "undefined";
				if (polling && timer === null) {
					timer = setInterval(() => {
						if (document.visibilityState !== "hidden") read();
					}, 20_000);
				} else if (!polling && timer !== null) {
					clearInterval(timer);
					timer = null;
				}
			};

			const subscribe = (listener) => {
				listeners.add(listener);
				if (listeners.size === 1) {
					read();
					syncTimer();
				}
				return () => {
					listeners.delete(listener);
					if (listeners.size === 0) syncTimer();
				};
			};

			const wake = () => {
				if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
				read();
			};
			if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);
			if (typeof window !== "undefined") window.addEventListener("focus", wake);

			return {
				subscribe,
				getSnapshot: () => state,
				refresh: read,
				dispose() {
					disposed = true;
					if (timer !== null) clearInterval(timer);
					timer = null;
					listeners.clear();
					if (typeof document !== "undefined") document.removeEventListener("visibilitychange", wake);
					if (typeof window !== "undefined") window.removeEventListener("focus", wake);
				}
			};
		}
		//#endregion

		//#region component
		/**
		 * Compact header pill: remaining credit, bonus credit, and a refresh affordance.
		 * @param {{ store: ReturnType<typeof createBalanceStore>, t: (key: string) => string }} props
		 */
		function BalanceChip(props) {
			const { store, t } = props;
			const state = react.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			const [spinning, setSpinning] = react.useState(false);
			const spinningRef = react.useRef(false);

			const refresh = react.useCallback(() => {
				if (spinningRef.current) return;
				spinningRef.current = true;
				setSpinning(true);
				Promise.resolve(store.refresh()).finally(() => {
					spinningRef.current = false;
					setSpinning(false);
				});
			}, [store]);

			if (state.phase === "hidden") return null;

			const wallets = state.wallets;
			const bonus = state.bonusWallets.filter((wallet) => positive(wallet.balance));
			const ready = state.phase === "ready";
			const error = state.phase === "error";

			const amountText = ready
				? wallets.length === 0
					? "\u2014"
					: wallets.map((wallet) => symbol(wallet.currency) + amount(wallet.balance)).join(" \u00b7 ")
				: error
					? t("unavailable")
					: t("loading");
			const bonusText = ready && bonus.length > 0
				? bonus.map((wallet) => "+" + symbol(wallet.currency) + amount(wallet.balance)).join(" \u00b7 ")
				: "";
			const updated = state.updatedAt
				? new Date(state.updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
				: "";

			const tooltip = [
				t("balance") + " " + amountText,
				bonusText ? t("bonus") + " " + bonusText : "",
				updated ? t("updated") + " " + updated : "",
				error ? "" : t("refresh")
			].filter(Boolean).join(" \u00b7 ");

			return h(
				"button",
				{
					type: "button",
					className: "dsh-balance-chip",
					"data-phase": state.phase,
					title: tooltip,
					"aria-label": tooltip,
					"aria-busy": spinning || undefined,
					onClick: refresh
				},
				h("span", { className: "dsh-balance-dot", "aria-hidden": "true" }),
				h("span", { className: "dsh-balance-label" }, amountText),
				bonusText ? h("span", { className: "dsh-balance-bonus" }, bonusText) : null
			);
		}
		//#endregion

		//#region plugin
		const inject = ["slots", "locale", "remote", "remote.account"];

		/** Register the chip in the session header utilities next to the other header actions. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("balanceChip", { en, zh }));
			const store = createBalanceStore(ctx);
			ctx.effect(() => () => store.dispose(), "balance chip: polling lifetime");
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "dsh-plugin-balance-chip",
				order: 0,
				locale: "balanceChip",
				inject: () => ({ store })
			}, BalanceChip));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
