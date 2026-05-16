/**
 * MutationObserver-based ad detector.
 * Watches DOM changes to detect ad elements being inserted dynamically.
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

/**
 * Create and start a MutationObserver that fires `callback` whenever
 * DOM changes suggest an ad is playing.
 */
export function createMutationDetector(callback: MutationCallback): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    let adSignalDetected = false;
    const signals: string[] = [];

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const descriptor = `${element.className} ${element.id}`;

            for (const pattern of AD_MUTATION_PATTERNS) {
              if (pattern.test(descriptor)) {
                adSignalDetected = true;
                signals.push(`mutation:${descriptor.trim().slice(0, 40)}`);
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
            signals.push(`attr-mutation:${descriptor.trim().slice(0, 40)}`);
            break;
          }
        }
      }
    }

    if (adSignalDetected) {
      // Re-run full DOM check for accurate confidence
      const domResult = detectAdsInDom();
      // Mutation adds up to 10 bonus confidence
      const mutationBonus = Math.min(10, signals.length * 5);
      callback(domResult.confidence + mutationBonus, [
        ...domResult.matchedSelectors,
        ...signals,
      ]);
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
