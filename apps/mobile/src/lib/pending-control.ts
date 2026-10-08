/**
 * One in-flight action used to spin every sibling. Only the control that was
 * tapped shows a spinner; the others stay disabled and quiet.
 */
export function controlShowsSpinner(pending: string | null | undefined, id: string): boolean {
  return pending != null && pending === id;
}
