import { Redirect } from "expo-router";

/** Old Create-tab deep link — new tabs start from Home camera / upload. */
export default function CreateTab() {
  return <Redirect href="/" />;
}
