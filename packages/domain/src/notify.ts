/**
 * Push is deferred. Callers use this interface so a later ticket can send
 * a nudge without changing booking. The default implementation does nothing
 * and does not register with APNs or FCM.
 */
export type SessionNotifier = {
  sessionBooked(sessionId: string): Promise<void>;
  sessionCancelled(sessionId: string): Promise<void>;
};

export const deferredPushNotifier: SessionNotifier = {
  async sessionBooked() {},
  async sessionCancelled() {},
};
