import { Redirect } from "expo-router";

/** Old Create-tab deep link — host flow lives at /host. */
export default function CreateTab() {
  return <Redirect href="/host" />;
}
