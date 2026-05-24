/**
 * MutationObserver-based ad detector.
 * Watches DOM changes to detect ad elements being inserted dynamically.
 *
 * Fix #10: Debounced callback prevents rapid consecutive triggers on
 * large DOM updates (e.g. ad player injection batches).
 */

import { detectAdsInDom } from './domDetector';

export type MutationCallback = (confidence: number, signals: string[]) => void;

// Patterns in added node class/id names that indicate ads
const AD_MUTATION_PATTERNS = [
  /ad[-_]?show/i,
  /ad[-_]?player/i,
  /ad[-_]?overlay/i,
  /ad[-_]?container/i,
  /advertisement/i,
  /ytp-ad/i,
  /sponsor/i,
  /ad-banner/i,
];

// Debounce delay: collapse rapid mutation bursts into a single callback (#10)
const DEBOUNCE_MS = 250;

/**
 * Create and start a MutationObserver that fires `callback` whenever
 * DOM changes suggest an ad is playing.
 * The callback is debounced to avoid redundant work on large DOM batches.
 */
export function createMutationDetector(callback: MutationCallback): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSignals: string[] = [];

  // Flush the debounce — runs the full DOM check once after burst settles (#10)
  function flush(): void {
    debounceTimer = null;
    if (pendingSignals.length === 0) return;

    try {
      const domResult = detectAdsInDom();
      const mutationBonus = Math.min(10, pendingSignals.length * 5);
      const allSignals = [...domResult.matchedSelectors, ...pendingSignals];
      callback(domResult.confidence + mutationBonus, allSignals);
    } catch (err) {
      console.warn('[AutoMuteAds][Mutation] flush error:', err);
    } finally {
      pendingSignals = [];
    }
  }

  const observer = new MutationObserver((mutations) => {
    let adSignalDetected = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const descriptor = `${element.className} ${element.id}`;
            for (const pattern of AD_MUTATION_PATTERNS) {
              if (pattern.test(descriptor)) {
                adSignalDetected = true;
                pendingSignals.push(`mutation:${descriptor.trim().slice(0, 40)}`);
                break;
              }
            }
          }
        }
      }

      if (mutation.type === 'attributes') {
        const el = mutation.target as Element;
        const descriptor = `${el.className} ${el.id}`;
        for (const pattern of AD_MUTATION_PATTERNS) {
          if (pattern.test(descriptor)) {
            adSignalDetected = true;
            pendingSignals.push(`attr-mutation:${descriptor.trim().slice(0, 40)}`);
            break;
          }
        }
      }
    }

    if (adSignalDetected) {
      // Debounce: reset the timer on each new mutation (#10)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id', 'style'],
  });

  return observer;
}
