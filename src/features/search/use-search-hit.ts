import { useEffect, type RefObject } from "react";

export type SearchHitTarget = {
  /** 从搜索结果里点进来的词。 */
  term: string;
  /** 该词在全文里第几次出现，从 1 开始。 */
  occurrence: number;
};

type MarkedNode = {
  node: Text;
  start: number;
  end: number;
  /** 全文里的出现序号，用来还原文档顺序。 */
  order: number;
};

/** 把文本节点里所有 `needle` 出现处包成 `<mark>`，返回按文档顺序排好的标记。 */
function markAll(root: HTMLElement, needle: string): Array<HTMLElement> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") {
        return NodeFilter.FILTER_REJECT;
      }
      // 已经标过的不再重复包一层。
      if (parent.closest(".search-hit-mark")) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const jobs: Array<MarkedNode> = [];
  const grouped = new Map<Text, Array<MarkedNode>>();
  let order = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    const lower = text.toLowerCase();
    let from = 0;
    while (from <= lower.length - needle.length) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const job = {
        node: node as Text,
        start: idx,
        end: idx + needle.length,
        order,
      };
      order += 1;
      jobs.push(job);
      const list = grouped.get(job.node);
      if (list) list.push(job);
      else grouped.set(job.node, [job]);
      from = idx + needle.length;
    }
  }

  if (jobs.length === 0) return [];

  const marks: Array<HTMLElement | null> = new Array(jobs.length).fill(null);
  for (const [textNode, list] of grouped) {
    // 从后往前切开，前面的偏移才不会被前面那次切割破坏。
    for (let i = list.length - 1; i >= 0; i--) {
      const job = list[i];
      textNode.splitText(job.end);
      const middle = textNode.splitText(job.start);
      const mark = document.createElement("mark");
      mark.className = "search-hit-mark";
      mark.dataset.term = needle;
      middle.parentNode?.insertBefore(mark, middle);
      mark.appendChild(middle);
      marks[job.order] = mark;
    }
  }

  return marks.filter((mark): mark is HTMLElement => mark !== null);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 搜索结果点进来时，把正文里的命中词全部标出来，并滚到点的那一处。
 * 正文可能还在水合，找不到就先等一会儿再试。
 */
export function useSearchHit(
  rootRef: RefObject<HTMLElement | null>,
  hit: SearchHitTarget | null,
) {
  const term = hit?.term ?? "";
  const occurrence = hit?.occurrence ?? 1;
  const needle = term.trim().toLowerCase();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !needle) return;

    let timer = 0;
    let tries = 0;
    let disposed = false;

    const run = () => {
      if (disposed) return;
      // 同一个词已经标过就直接复用，只换滚动目标。
      const cached = root.querySelectorAll<HTMLElement>(
        `.search-hit-mark[data-term="${CSS.escape(needle)}"]`,
      );
      const marks =
        cached.length > 0 ? Array.from(cached) : markAll(root, needle);
      if (marks.length === 0) {
        tries += 1;
        if (tries <= 10) timer = window.setTimeout(run, 200);
        return;
      }
      const target = marks[Math.min(Math.max(occurrence, 1), marks.length) - 1];
      for (const mark of root.querySelectorAll<HTMLElement>(
        '.search-hit-mark[data-active="true"]',
      )) {
        delete mark.dataset.active;
      }
      target.dataset.active = "true";
      target.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    };

    // 等首屏动画和内容渲染落定再定位。
    timer = window.setTimeout(run, 200);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [rootRef, needle, occurrence]);
}
