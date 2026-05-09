import {
  useFloating,
  autoUpdate,
  useInteractions,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  offset,
  flip,
  shift,
  arrow,
  type Placement,
} from '@floating-ui/react';
import { useMemo, useRef } from 'react';

/** Subset of Floating UI AriaRole values relevant to tooltip/coachmark surfaces. */
type TooltipRole = 'tooltip' | 'dialog' | 'alertdialog';

interface UseFloatingTooltipBaseOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  role?: TooltipRole;
}

export function useFloatingTooltipBase({
  open,
  onOpenChange,
  placement = 'top',
  role: roleProp = 'tooltip' as TooltipRole,
}: UseFloatingTooltipBaseOptions) {
  const arrowRef = useRef<SVGSVGElement>(null);

  const middleware = useMemo(
    // passing a MutableRefObject to Floating UI middleware is the documented safe pattern.
    // eslint-disable-next-line react-hooks/refs
    () => [offset(8), flip(), shift({ padding: 8 }), arrow({ element: arrowRef })],
    [arrowRef],
  );

  const { refs, floatingStyles, context, middlewareData, placement: resolvedPlacement } = useFloating({
    open,
    onOpenChange,
    placement,
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: roleProp });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return {
    refs,
    floatingStyles,
    context,
    arrowRef,
    getReferenceProps,
    getFloatingProps,
    middlewareData,
    placement: resolvedPlacement,
  };
}
