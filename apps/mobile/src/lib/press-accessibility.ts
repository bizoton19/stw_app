type PressA11yState = {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | "mixed";
  busy?: boolean;
  expanded?: boolean;
};

/**
 * VoiceOver reads nothing once a label is swapped for a spinner, unless the
 * pressable keeps an accessible name and reports `busy` alongside `disabled`.
 */
export function pressAccessibilityState(
  accessibilityState: PressA11yState | undefined,
  disabled: boolean | null | undefined,
  busy: boolean | null | undefined,
): PressA11yState {
  return {
    ...accessibilityState,
    disabled: Boolean(disabled),
    busy: Boolean(busy) || Boolean(accessibilityState?.busy),
  };
}
