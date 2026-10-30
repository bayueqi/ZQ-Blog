import type { Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { Mappable, Step } from "@tiptap/pm/transform";

/**
 * Helpers for a block that is inserted and opened for editing at once (a
 * formula, a video), so cancelling that first edit can take the insertion
 * back and give back what it replaced.
 */

/** Where `node` landed in the transaction's document, or -1. */
export function findNode(tr: Transaction, node: PMNode) {
  let found = -1;
  tr.doc.descendants((child, pos) => {
    if (child === node) found = pos;
    return found < 0;
  });
  return found;
}

/** The steps that undo `tr`'s steps from `start` on, in the order to apply. */
export function revertSteps(tr: Transaction, start: number) {
  const steps: Step[] = [];
  for (let index = tr.steps.length - 1; index >= start; index--) {
    steps.push(tr.steps[index].invert(tr.docs[index]));
  }
  return steps;
}

/** `steps` mapped through `mapping`; none once one of them no longer fits. */
export function mapSteps(steps: readonly Step[], mapping: Mappable) {
  const mapped: Step[] = [];
  for (const step of steps) {
    const next = step.map(mapping);
    if (!next) return [];
    mapped.push(next);
  }
  return mapped;
}
