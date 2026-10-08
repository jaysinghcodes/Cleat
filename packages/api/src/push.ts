/**
 * Push sending is deferred.
 * Call notify when a trainer message is stored. The default implementation
 * does not contact the Expo push service and does not read a service role key.
 * Nudge delivery from programs should later call notify with screen "today".
 * Do not import expo-notifications from this package.
 */
export type PushNotice = {
  userId: string;
  title: string;
  body: string;
  data: {
    screen: "chat" | "today";
    threadId?: string;
  };
};

export type PushNotifier = {
  notify(notice: PushNotice): Promise<void>;
};

export const noopPushNotifier: PushNotifier = {
  async notify() {
    return undefined;
  },
};
