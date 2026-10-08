/**
 * Push delivery is deferred until the chat ticket.
 * Sending a nudge writes a row. This stub is the seam for a later sender.
 * It does not import Expo Notifications or any native module.
 */
export type NudgePush = {
  clientId: string;
  title: string;
  body: string;
};

export type PushDelivery = {
  sendNudge(input: NudgePush): Promise<"deferred">;
};

export const deferredPushDelivery: PushDelivery = {
  async sendNudge() {
    return "deferred";
  },
};
