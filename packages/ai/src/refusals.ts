import { normalizeText } from "./text";

/**
 * Fixed safety templates. These strings are the only client facing refusal text.
 * They are constants, never model output.
 */
export const EMERGENCY_TEMPLATE =
  "This sounds urgent. Please call 911 or your local emergency number right now. Your coach has been alerted.";

export const SELF_HARM_LINE =
  "In the US you can call or text 988 to reach the Suicide and Crisis Lifeline.";

export const EMERGENCY_SELF_HARM_TEMPLATE = `${EMERGENCY_TEMPLATE}\n${SELF_HARM_LINE}`;

export const MEDICAL_SAFETY_TEMPLATE =
  "I can't help with that one. Please stop the exercise and check with a medical professional if you're hurting. Your coach has been alerted and will reply.";

export const TEMPLATE_IDS = ["emergency", "emergency_self_harm", "medical_safety"] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATE_TEXT: Record<TemplateId, string> = {
  emergency: EMERGENCY_TEMPLATE,
  emergency_self_harm: EMERGENCY_SELF_HARM_TEMPLATE,
  medical_safety: MEDICAL_SAFETY_TEMPLATE,
};

const SELF_HARM: RegExp[] = [
  /hurt(?:ing)? myself/,
  /harm(?:ing)? myself/,
  /kill(?:ing)? myself/,
  /self[-\s]?harm/,
  /suicid/,
  /end my life/,
  /want to die/,
  /wanna die/,
  /do not want to live/,
  /don't want to live/,
  /dont want to live/,
  /better off dead/,
  /no reason to live/,
  /end it all/,
  /don'?t want to be here/,
  /do not want to be here/,
  /dont want to be here/,
  /don'?t want to be alive/,
  /do not want to be alive/,
  /dont want to be alive/,
];

/** Emergency checks run before medical checks. Patterns lean toward over flagging. */
const EMERGENCY: RegExp[] = [
  /\bchest\b/,
  /passed out/,
  /pass(?:ing)? out/,
  /\bfaint/,
  /black(?:ed)? out/,
  /\bdizz/,
  /light[-\s]?headed/,
  /can(?:not|'t|t) catch (?:my )?breath/,
  /trouble breathing/,
  /can(?:not|'t|t) breathe/,
  /short(?:ness)? of breath/,
  /hard to breathe/,
  /struggling to breathe/,
  /\bbleed/,
  /won'?t stop bleeding/,
  /face (?:feels |is )?numb/,
  /side of my face/,
  /\bslurr/,
  /\bstroke\b/,
  /facial droop/,
  /\bnumb\b/,
  /heart attack/,
  /\bcardiac\b/,
  /palpitation/,
  /\b(?:racing|pounding|irregular)\b[^.]{0,40}\bheart(?:beat)?s?\b/,
  /\bheart(?:beat)?s?\b[^.]{0,40}\b(?:racing|pounding|irregular)\b/,
  /\bheart(?:beat)?s?\b[^.]{0,48}(?:won'?t|will not|can(?:not|'t|t)) (?:slow|settle)/,
];

const MEDICAL: RegExp[] = [
  /\bpain\b/,
  /\bhurts?\b/,
  /\bhurting\b/,
  /\binjur/,
  /\bknee\b/,
  /\bshoulder\b/,
  /\bankle\b/,
  /\bhip\b/,
  /pulled muscle/,
  /\bstrain\b/,
  /\bsprain\b/,
  /heart condition/,
  /heart disease/,
  /\bdiabetes\b/,
  /blood sugar/,
  /blood pressure/,
  /\bpregnan/,
  /\basthma\b/,
  /\bmedical\b/,
  /\bdoctor\b/,
  /ibuprofen/,
  /\badvil\b/,
  /\btylenol\b/,
  /\baspirin\b/,
  /\bmedication\b/,
  /\bmedicine\b/,
  /\bmeds\b/,
  /\bpills?\b/,
  /\bdosage\b/,
  /\bdose\b/,
  /meal plan/,
  /diet plan/,
  /\bmacros?\b/,
  /\bcalories?\b/,
  /what should i eat/,
  /eating plan/,
  /\bnutrition\b/,
];

const ASKS_FOR_COACH: RegExp[] = [
  /\btalk to (?:my )?(?:coach|trainer|alex)\b/,
  /\bspeak to (?:my )?(?:coach|trainer|alex)\b/,
  /\bchat with (?:my )?(?:coach|trainer|alex)\b/,
  /\bcan i (?:talk|speak|chat)\b/,
  /\bwhere(?:'s| is) (?:my )?(?:coach|alex|trainer)\b/,
  /\bask (?:my |the )?(?:coach|alex|trainer)\b/,
  /\bget (?:my |the )?coach\b/,
  /\bwant (?:my |the )?coach\b/,
  /\bmessage (?:my )?(?:coach|alex|trainer)\b/,
  /\bmy coach\b/,
];

const PROGRAM_SWAP: RegExp[] = [
  /\bswap (?:my |the )?program/,
  /\bswitch (?:my |the |to (?:a |another )?)?(?:different )?program/,
  /\bchange (?:my |the )?program/,
  /\bdifferent program\b/,
  /\banother program\b/,
  /\bnew program\b/,
  /\bswap (?:my |the )?plan\b/,
  /\bswitch (?:my |the )?plan\b/,
  /\bchange (?:my |the )?plan\b/,
  /program swap/,
];

export type HardRefusal = {
  kind: "hard_refuse";
  templateId: TemplateId;
  text: string;
  reasonCodes: Array<"emergency" | "self_harm" | "refusal_keyword">;
  emergency: boolean;
};

export type DraftHold = {
  kind: "hold";
  reasonCodes: Array<"asks_for_coach" | "program_swap">;
};

export type RefusalCheck = HardRefusal | DraftHold | { kind: "none" };

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Keyword and pattern rules. Emergency is checked before medical.
 * When a message could be an emergency, this returns the emergency template.
 * Asks for the coach and program swaps are holds, not refusals.
 */
export function checkRefusals(message: string): RefusalCheck {
  const text = normalizeText(message);
  if (matches(text, SELF_HARM)) {
    return {
      kind: "hard_refuse",
      templateId: "emergency_self_harm",
      text: EMERGENCY_SELF_HARM_TEMPLATE,
      reasonCodes: ["self_harm", "emergency"],
      emergency: true,
    };
  }
  if (matches(text, EMERGENCY)) {
    return {
      kind: "hard_refuse",
      templateId: "emergency",
      text: EMERGENCY_TEMPLATE,
      reasonCodes: ["emergency"],
      emergency: true,
    };
  }
  if (matches(text, MEDICAL)) {
    return {
      kind: "hard_refuse",
      templateId: "medical_safety",
      text: MEDICAL_SAFETY_TEMPLATE,
      reasonCodes: ["refusal_keyword"],
      emergency: false,
    };
  }
  const reasonCodes: Array<"asks_for_coach" | "program_swap"> = [];
  if (matches(text, ASKS_FOR_COACH)) reasonCodes.push("asks_for_coach");
  if (matches(text, PROGRAM_SWAP)) reasonCodes.push("program_swap");
  if (reasonCodes.length > 0) return { kind: "hold", reasonCodes };
  return { kind: "none" };
}
