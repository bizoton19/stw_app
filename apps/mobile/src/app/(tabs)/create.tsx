import { Redirect } from "expo-router";

/** Tab target; Create button routes to /host via the tab bar. */
export default function CreateTab() {
  return <Redirect href="/host" />;
}
