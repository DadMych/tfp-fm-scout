/**
 * Assistant thresholds — single source of truth (docs/11-assistant-analytics.md §4).
 * All rule modules import from here; tune in one place.
 */
export const T = {
  WEAK_FIT: 62,
  GOOD_FIT: 72,
  ELITE_FIT: 80,
  THIN_BACKUP: 55,
  THIN_DROP: 18,
  AGE_RISK: 32,
  AGE_PEAK_END: 29,
  AGE_PREPEAK: 24,
  AGE_DEV: 21,
  GEM_FIT: 66,
  SELL_AGE_LO: 28,
  SELL_AGE_HI: 30,
  PARTNERSHIP_WARN: 45,
  PARTNERSHIP_GOOD: 70,
  DNA_BADGE: 70,
  VALUE_CONCENTRATION: 0.4,
  COVER_MIN: 2,
  // UX overhaul (doc 12 §2)
  BARGAIN_MAX_SHOWN: 4,
  MARKET_CLASS_CAP: 6,
  PRAISE_TOTAL_CAP: 3,
  CHEM_PRAISE_CAP: 1,
  PKG_MAX_OVERLAP: 0.5,
  PKG_SPEND_FLOOR: 0.6,
  MARQUEE_MIN_FRAC: 0.35,
  DEPTH_PASS_MIN_FIT: 62,
  PKG_MAX_SIGNINGS: 6,
  // Sporting director layer (doc 13 §13)
  DEADWOOD_FIT: 55,
  SELL_NOW_AGE: 31,
  ARBITRAGE_FRAC: 0.6,
  SUCC_READY_GAP: 5,
  VALUE_CLIFF_FRAC: 0.35,
  TRANSFER_CLASS_CAP: 6,
  /** Expected sale proceeds as a fraction of list value (doc 19 §4). */
  SALE_HAIRCUT: 0.9,
} as const;
