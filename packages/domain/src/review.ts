import type { InboxQueueItem } from "./inbox";

export const reviewCopy = {
  title: "Review",
  lede: "Answers held for you. Nothing here has reached the client.",
  empty: "No answers are waiting for review.",
  question: "Client asked",
  draft: "Held answer",
  yourEdit: "Your edit",
  why: "Why this was held",
  score: "Match score",
  scoreHelp: "A rule of thumb score from the notes search. It is not a probability.",
  cutoff: "Auto send cutoff",
  sources: "Sources",
  noSources: "No notes matched",
  approve: "Approve",
  edit: "Edit",
  reject: "Reject",
  sendEdit: "Send edit",
  cancelEdit: "Cancel",
  saveNote: "Save this fix as a note",
  saveNoteHelp: "The question and your answer become a note for the whole gym, so similar questions get your answer next time. Leave this off if the reply is personal to this client.",
  approved: "Approved and sent.",
  editSent: "Edit sent.",
  editSentNoted: "Edit sent and saved as a note.",
  editSentNoteFailed: "Edit sent. The note could not be saved.",
  rejected: "Rejected. Nothing was sent.",
  emptyEdit: "Write the reply before sending.",
  waiting: "waiting",
  openThread: "Open chat",
  audit: "Audit log",
} as const;

export type ReviewItem = InboxQueueItem & { draft: NonNullable<InboxQueueItem["draft"]> };

/** Held AI answers only, oldest first. Safety refusals have no draft and never appear here. */
export function reviewQueue(items: InboxQueueItem[]): ReviewItem[] {
  return items
    .filter((item): item is ReviewItem => item.priority === "p1" && item.draft !== null && item.templateId === null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** True when the coach changed the words, not only the spacing. */
export function reviewEditChanged(draftText: string, editedText: string): boolean {
  return squash(draftText) !== squash(editedText);
}

export function reviewCountLabel(count: number): string {
  return `${count} ${reviewCopy.waiting}`;
}

export function reviewBanner(input: { action: "approve" | "edit" | "reject"; noteAsked: boolean; noteSaved: boolean }): string {
  if (input.action === "approve") return reviewCopy.approved;
  if (input.action === "reject") return reviewCopy.rejected;
  if (!input.noteAsked) return reviewCopy.editSent;
  return input.noteSaved ? reviewCopy.editSentNoted : reviewCopy.editSentNoteFailed;
}
