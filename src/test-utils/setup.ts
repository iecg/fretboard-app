import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';
import { configure } from '@testing-library/react';
import { configureAxe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';
expect.extend({ toHaveNoViolations });

// vitest-axe: registers toHaveNoViolations matcher globally.
// color-contrast rule disabled — jsdom cannot compute CSS custom property values.
// Use @axe-core/playwright for contrast checks in a real browser environment.
configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

// Nested lazy-loaded components (Suspense fallback={null}) can take >1 s to
// settle in jsdom. Raise the RTL async timeout to prevent spurious failures.
configure({ asyncUtilTimeout: 5000 });

// Fix __APP_VERSION__ to prevent snapshot breakage on version bumps
(globalThis as Record<string, unknown>).__APP_VERSION__ = '0.0.0-test';

// jsdom does not implement ResizeObserver
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver =
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

// The DOM stubs below only apply when a DOM is present. Tests that opt into the
// `node` environment (e.g. CSS-token parsing helpers that read files) have no
// `window`, so guard these so the shared setup stays environment-agnostic.
if (typeof window !== 'undefined') {
  // jsdom does not implement scrollTo on DOM elements
  window.HTMLElement.prototype.scrollTo = () => {};

  // jsdom does not implement scrollIntoView on DOM elements
  window.HTMLElement.prototype.scrollIntoView = () => {};

  // jsdom does not implement Pointer Capture. Radix Select calls these on its
  // trigger during pointer interactions; stub them so the listbox can open.
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};

  // jsdom does not implement matchMedia
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// motion/react uses RAF-sequenced animations which never fire in jsdom, causing
// AnimatePresence to defer rendering its children indefinitely and making any
// waitFor that depends on animated content flaky. Replace with instant renders.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "layoutId",
    "layout",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
  ]);
  const makeElement = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
      const rest: Record<string, unknown> = {};
      Object.entries(props).forEach(([key, value]) => {
        if (!ANIMATION_PROPS.has(key)) {
          rest[key] = value;
        }
      });
      return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
    });

  const componentCache = new Map<string, React.ForwardRefExoticComponent<unknown>>();
  const motionProxy = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!componentCache.has(prop)) {
        componentCache.set(prop, makeElement(prop) as React.ForwardRefExoticComponent<unknown>);
      }
      return componentCache.get(prop);
    },
  });

  // Reorder.Group renders as the `as` prop element (default "ul"),
  // Reorder.Item renders as the `as` prop element (default "li").
  // Both strip animation/drag props before forwarding to the DOM.
  const REORDER_STRIP = new Set([
    ...Array.from(ANIMATION_PROPS),
    "axis",
    "values",
    "onReorder",
    "dragListener",
    "dragControls",
    "onDragStart",
    "onDragEnd",
    "value",
  ]);
  const ReorderGroup = React.forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, as: tag = "ul", ...props }, ref) => {
      const rest: Record<string, unknown> = {};
      Object.entries(props).forEach(([key, value]) => {
        if (!REORDER_STRIP.has(key)) rest[key] = value;
      });
      return React.createElement(tag as string, { ...rest, ref }, children as React.ReactNode);
    },
  );
  ReorderGroup.displayName = "Reorder.Group";

  const ReorderItem = React.forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, as: tag = "li", ...props }, ref) => {
      const rest: Record<string, unknown> = {};
      Object.entries(props).forEach(([key, value]) => {
        if (!REORDER_STRIP.has(key)) rest[key] = value;
      });
      return React.createElement(tag as string, { ...rest, ref }, children as React.ReactNode);
    },
  );
  ReorderItem.displayName = "Reorder.Item";

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    MotionConfig: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    useReducedMotion: vi.fn().mockReturnValue(null),
    useDragControls: vi.fn(() => ({ start: vi.fn() })),
    Reorder: {
      Group: ReorderGroup,
      Item: ReorderItem,
    },
  };
});

/**
 * Snapshot serializer that normalizes React useId() generated IDs.
 * React generated IDs (e.g., _r_c_) shift between runs, causing snapshot instability.
 * This serializer replaces them with stable tokens like react-id-1, react-id-2, etc.
 */
const normalizedNodes = new WeakSet<Node>();

expect.addSnapshotSerializer({
  test(val) {
    return (
      val &&
      typeof val === 'object' &&
      (val.nodeType === 1 || val.nodeType === 11) &&
      !normalizedNodes.has(val)
    );
  },
  serialize(val, config, indentation, depth, refs, printer) {
    const clone = val.cloneNode(true) as Element | DocumentFragment;
    normalizedNodes.add(val);
    normalizedNodes.add(clone);

    const idMap = new Map<string, string>();
    let idCounter = 1;
    const reactIdRegExp = /_r_[a-z0-9]+_/g;

    const normalize = (text: string) => {
      return text.replace(reactIdRegExp, (match) => {
        if (!idMap.has(match)) {
          idMap.set(match, `react-id-${idCounter++}`);
        }
        return idMap.get(match)!;
      });
    };

    const walk = (node: Node) => {
      if (node.nodeType === 1) {
        // Element
        const el = node as Element;
        const attrs = el.attributes;
        for (let i = 0; i < attrs.length; i++) {
          const attr = attrs[i];
          if (attr.value.match(reactIdRegExp)) {
            attr.value = normalize(attr.value);
          }
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
    };

    walk(clone);

    return printer(clone, config, indentation, depth, refs);
  },
});
