import { Platform, Share } from "react-native";

/**
 * Share a claim / invite URL once.
 * iOS concatenates `url` onto `message` — putting the link in both doubles it.
 */
export async function shareLink(opts: { message: string; url: string }) {
  const message = opts.message.replace(/\s+$/, "");
  if (Platform.OS === "ios") {
    await Share.share({ message, url: opts.url });
    return;
  }
  await Share.share({
    message: message.includes(opts.url) ? message : `${message}\n${opts.url}`,
  });
}
