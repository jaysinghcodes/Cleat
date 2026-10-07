export type RefusalCheck = {
  implemented: false;
};

/** Ticket 4 hard-refuses injury, medication, and emergency clinical advice. */
export function checkRefusals(_message: string): RefusalCheck {
  return { implemented: false };
}
