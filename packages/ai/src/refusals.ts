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
  /harm(?:ing)? myself/,
  /kill(?:ing)? myself/,
  /self[-\s]?harm/,
  /suicid/,
  /end(?:ing)? my life/,
  /want(?:s|ed|ing)? to (?:(?:just|really|finally|honestly) )?die\b/,
  /\bwanna die\b/,
  /\bwish(?:ed|ing)? (?:that )?i (?:was|were) dead\b/,
  /\bwish(?:ed|ing)? (?:that )?i (?:would|could) die\b/,
  /\bwish i'?d die\b/,
  /do not want to live/,
  /don't want to live/,
  /dont want to live/,
  /better off dead/,
  /no reason to live/,
  /want(?:s|ed|ing)? to be dead\b/,
  /\brather (?:die|be dead)\b/,
  /\bend(?:ing)? it all\b/,
  /\bwant it(?: all)? (?:to|2) end\b/,
  /\bwant it (?:to|2) be over\b/,
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
  /**
   * tore, torn, pulled, strained, or tweaked, next to a hamstring, calf, quad, groin, or acl.
   * "hamstring curls" and "calf raises" do not match. A die joke later in the message still does.
   */
  /\b(?:tore|torn|pulled|strained|tweaked)\b(?:\s+(?:a|an|my|the|his|her|their|left|right|both|badly|really|just|up|slightly|pretty|so|very)){0,4}\s+(?:hamstrings?|calves|calf|quadriceps|quads?|groins?|acls?)\b/,
  /\b(?:(?:a|an|my|the|his|her|their)\s+)?(?:(?:left|right|both)\s+)?(?:hamstrings?|calves|calf|quadriceps|quads?|groins?|acls?)\b(?:\s+(?:is|was|got|feels|feel|feeling|really|badly|just|so|very|still)){0,3}\s+(?:tore|torn|pulled|strained|tweaked)\b/,
];

/** Training words that make "hurt myself" or "injured myself" an injury, not self harm. */
const TRAINING_CONTEXT =
  /\b(?:lifting|lifts?|deadlifts?|squats?|squatting|lunges?|lunging|bench(?:es|ing)?|workouts?|gym|sets?|reps?|sessions?|press(?:es|ing)?|cleans?|snatches?|curls?|rowing|rows?|rdls?|pull-?ups?|push-?ups?|barbells?|dumbbells?|kettlebells?|overhead)\b/;

/**
 * Intent to cause the harm. "going to the gym" is not intent.
 * "going to hurt", "on purpose", and "kill myself" are.
 * "end it" is handled separately: an intent or feeling verb in front of it is
 * self harm, unless the same clause continues with training talk.
 * Intent wins even when the message also names a training context.
 */
const HARM_INTENT =
  /\b(?:on purpose|deliberately|intentionally|purposely)\b|\bkill(?:ing)? myself\b|\b(?:want(?:ed|ing)? to|going to|gonna|intend(?:ed|ing)? to|plan(?:ned|ning)? to|try(?:ing)? to|tried to|about to)\s+(?:hurt|injur)/;

const NEGATED_HARM_INTENT =
  /\b(?:do not|don't|dont|never|not) want(?:ed|ing)? to (?:hurt|injur\w*)|\b(?:not|never) going to (?:hurt|injur\w*)|\bnot on purpose\b|\bnot deliberately\b/g;

/** "hurt myself" and "injured myself", including hurting and will hurt. */
const SELF_DIRECTED_INJURY = /\b(?:hurt(?:ing)?|injur(?:e|ed|ing)) myself\b/;

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

export type HoldReason = "asks_for_coach" | "program_swap" | "distress_wording";

export type DraftHold = {
  kind: "hold";
  reasonCodes: HoldReason[];
};

export type RefusalCheck = HardRefusal | DraftHold | { kind: "none" };

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasHarmIntent(text: string): boolean {
  return HARM_INTENT.test(text.replace(NEGATED_HARM_INTENT, " "));
}

function selfHarmRefusal(): HardRefusal {
  return {
    kind: "hard_refuse",
    templateId: "emergency_self_harm",
    text: EMERGENCY_SELF_HARM_TEMPLATE,
    reasonCodes: ["self_harm", "emergency"],
    emergency: true,
  };
}

function emergencyRefusal(): HardRefusal {
  return {
    kind: "hard_refuse",
    templateId: "emergency",
    text: EMERGENCY_TEMPLATE,
    reasonCodes: ["emergency"],
    emergency: true,
  };
}

function medicalRefusal(): HardRefusal {
  return {
    kind: "hard_refuse",
    templateId: "medical_safety",
    text: MEDICAL_SAFETY_TEMPLATE,
    reasonCodes: ["refusal_keyword"],
    emergency: false,
  };
}

/**
 * "hurt myself" and "injured myself" are an injury only when the message names
 * a training context and has no self harm wording and no intent wording.
 * A self harm phrase wins first, including when the message also names a lift.
 * A separate emergency symptom still wins over the remaining injury path.
 */
function selfDirectedInjury(text: string): HardRefusal | null {
  if (!SELF_DIRECTED_INJURY.test(text)) return null;
  if (matches(text, SELF_HARM) || hasHarmIntent(text) || !TRAINING_CONTEXT.test(text)) return selfHarmRefusal();
  if (matches(text, EMERGENCY)) return emergencyRefusal();
  return medicalRefusal();
}

/**
 * Intent or feeling in front of "end it" or "ending it".
 * One or more filler words (just, really, finally, honestly) may sit between them.
 * "planning on" and "thinking of" count with "planning to" and "thinking about".
 * "need to", "might", "considering", and "feel like i should" are the same kind of phrase.
 * "2" stands in for "to". Other words may come before the verb.
 * Tense and casual forms stay inside this phrase.
 * "I'll", "Ill", and "I will" are separate: training talk after them stays clear.
 */
const END_IT_INTENT =
  /\b(?:want(?:s|ed|ing)?\s+(?:to|2)|wanna|plan(?:s|ned|ning)?\s+(?:to|2|on)|about\s+(?:to|2)|tried\s+(?:to|2)|try(?:ing|s)?\s+(?:to|2)|thought\s+(?:about|of)|think(?:s|ing)?\s+(?:about|of)|felt\s+like(?:\s+i\s+should)?|feel(?:s|ing)?\s+like(?:\s+i\s+should)?|going\s+(?:to|2)|gonna|ready\s+(?:to|2)|need(?:s|ed)?\s+(?:to|2)|might|consider(?:s|ed|ing)?)\s+(?:(?:just|really|finally|honestly)\s+)*end(?:ing)?\s+it\b/;

/**
 * "I'll", "Ill", and "I will" are self harm when the same clause does not
 * continue with training talk. "Ill" is the same phrase without an apostrophe.
 * A cooldown, a set count, or "early" keeps the message clear.
 */
const END_IT_WILL =
  /\b(?:i'll|ill|i will)\s+(?:(?:just|really|finally|honestly)\s+)*end(?:ing)?\s+it\b/;

/**
 * Training talk that comes right after "end it" in the same clause.
 * That continuation is a coach review, not a 988 refusal.
 */
const TRAINING_AFTER_END_IT =
  /^(?:at\s+\d+\s+(?:sets?|reps?)|with\s+a\s+(?:cooldown|warmup)|early\b|after\s+this\s+set\b|the\s+(?:gym|session|workout)\b)/;

function sameClauseAfter(text: string, end: number): string {
  const rest = text.slice(end);
  const cut = rest.search(/[.,!?;:\n]/);
  return (cut === -1 ? rest : rest.slice(0, cut)).trim();
}

/**
 * Scan one "end it" pattern.
 * A hit with no training continuation is self harm.
 * When trainingIsHold is set, a training continuation is a coach hold.
 * "I'll" passes false so "I'll end it with a cooldown walk" stays clear.
 */
function scanEndIt(text: string, source: string, trainingIsHold: boolean): "self_harm" | "hold" | null {
  const pattern = new RegExp(source, "g");
  let hold = false;
  for (const match of text.matchAll(pattern)) {
    const after = sameClauseAfter(text, (match.index ?? 0) + match[0].length);
    if (!TRAINING_AFTER_END_IT.test(after)) return "self_harm";
    if (trainingIsHold) hold = true;
  }
  return hold ? "hold" : null;
}

/**
 * "end it" with an intent or feeling verb is self harm.
 * When the same clause continues with training talk, it is a hold instead.
 * "I'll", "Ill", and "I will" are self harm only without that training talk.
 * A later bare "end it" in the same message still counts as self harm.
 */
function endItClass(text: string): "self_harm" | "hold" | null {
  const intent = scanEndIt(text, END_IT_INTENT.source, true);
  if (intent === "self_harm") return "self_harm";
  const will = scanEndIt(text, END_IT_WILL.source, false);
  if (will === "self_harm") return "self_harm";
  return intent;
}

/**
 * Training talk for "going to die", "gonna die", "about to die", and "ready to die".
 * Injury rules keep their own list. "run", "burpees", and "leg day" belong here.
 */
const DIE_TRAINING =
  /\b(?:sets?|reps?|runs?|running|squats?|squatting|workouts?|gym|burpees?|leg[-\s]?days?|lifting|lifts?|deadlifts?|lunges?|lunging|bench(?:es|ing)?|sessions?|press(?:es|ing)?|cleans?|snatches?|curls?|rowing|rows?|rdls?|pull-?ups?|push-?ups?|barbells?|dumbbells?|kettlebells?|overhead|cardio|sprints?|sprinting|jogs?|jogging|miles?|hiit|planks?|cooldowns?|warmups?|warm ups?|training|exercises?|circuits?|amrap|emom|wods?)\b/;

/** lol, lmao, haha (and longer ha repeats), or an emoji. */
const JOKE_MARKER = /\b(?:lol|lmao|ha(?:ha)+)\b|\p{Extended_Pictographic}/u;

const PROSPECTIVE_DIE_SOURCE = "\\b(?:going to|gonna|about to|ready to) die\\b";

/** Words that sit between a subject and "going to die" and are not the subject. */
const SUBJECT_FILLER =
  /^(?:is|are|was|were|am|be|been|being|really|just|actually|still|totally|literally|almost|so|definitely|probably|maybe|not|never|even|also|now|soon|already|basically|honestly|finally|very|pretty|kinda|sorta)$/;

const SUBJECT_DETERMINER = /^(?:my|the|this|that|our|your|his|her|their|a|an|its|some|any|these|those)$/;

const PERSON_HEAD =
  /^(?:i|im|i'm|we|we're|you|you're|youre|he|he's|she|she's|they|they're|theyre|someone|somebody|anyone|anybody|everybody|everyone|people|person|friend|friends|buddy|coach|trainer|mom|dad|mother|father|kid|kids|baby|man|woman|boy|girl|guy|guys|dude|bro|sis|husband|wife|boyfriend|girlfriend|client|athlete|human|humans)$/;

/** A phone, a battery, a car, and the same kind of thing. Not a person. */
const THING_HEAD =
  /^(?:phones?|smartphones?|cellphones?|batter(?:y|ies)|chargers?|powerbanks?|laptops?|computers?|tablets?|ipads?|iphones?|watches|watch|airpods?|earbuds?|headphones?|headsets?|devices?|power|charge|wifi|wi-fi|internet|signals?|connections?|routers?|modems?|speakers?|tvs?|televisions?|screens?|keyboards?|apps?|cars?|trucks?|bikes?|bicycles?|scooters?|engines?|motors?|vehicles?|vans?|bus(?:es)?|plants?|flowers?|lights?|bulbs?|flashlights?|cameras?|mics?|microphones?|drones?|printers?|macbooks?|androids?|mobiles?|kindles?|notebooks?|pcs?|desktops?|monitors?|trackers?|pods?)$/;

const THING_PHRASE = /^(?:power bank|cell phone|mobile phone|smart watch|apple watch|air pods|smart phone)$/;

function clauseBounds(text: string, start: number, end: number): { from: number; to: number } {
  const prior = text.slice(0, start);
  let from = 0;
  for (const mark of prior.matchAll(/[.,!?;:\n]/g)) {
    from = (mark.index ?? 0) + 1;
  }
  const rest = text.slice(end);
  const after = rest.search(/[.,!?;:\n]/);
  const to = after === -1 ? text.length : end + after;
  return { from, to };
}

/** The subject of "going to die" is a thing, not a person. */
function subjectIsThing(before: string): boolean {
  const words = before
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9'-]+/)
    .filter((word) => word.length > 0);
  while (words.length > 0) {
    const last = words[words.length - 1] ?? "";
    if (SUBJECT_FILLER.test(last) || SUBJECT_DETERMINER.test(last)) {
      words.pop();
      continue;
    }
    break;
  }
  if (words.length === 0) return false;
  const head = words[words.length - 1] ?? "";
  if (PERSON_HEAD.test(head)) return false;
  if (THING_HEAD.test(head)) return true;
  if (words.length >= 2 && THING_PHRASE.test(`${words[words.length - 2]} ${head}`)) return true;
  return false;
}

/**
 * The word "die" is self harm unless it sits inside one of these jokes or idioms.
 * "dying" and "killed" are different words, so "I'm dying" and "killed me" stay clear.
 * "I'll die on this hill", "die on a hill", and "hill to die on" are idioms, along with
 * "die hard", "to die for", "could die for", and "never say die".
 * "going to", "gonna", "about to", and "ready to" die stay self harm when the subject
 * is a person and the same clause has no training talk and no joke marker.
 * Training talk or a joke marker in that clause is a coach hold.
 * When that "die" is already inside an idiom, the phrase stays clear.
 * A subject that is not a person stays clear.
 * Explicit self harm wording is checked earlier and still wins.
 */
function dieClass(text: string): "self_harm" | "hold" | null {
  const covered = Array.from({ length: text.length }, () => false);
  const idioms = [
    /\bdie hard\b/g,
    /\b(?:could|i would|i'?d) die for\b/g,
    /\bto die for\b/g,
    /\bnever say die\b/g,
    /\bdie on (?:this|that|a) hill\b/g,
    /\bhills? to die on\b/g,
    /\b(?:burpees?|squats?|workouts?)\b[^.]{0,80}?\bmake me die lol\b/g,
  ];
  for (const pattern of idioms) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      for (let index = start; index < end; index += 1) covered[index] = true;
    }
  }

  let hold = false;
  for (const match of text.matchAll(new RegExp(PROSPECTIVE_DIE_SOURCE, "g"))) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (covered[end - 3]) continue;
    for (let index = end - 3; index < end; index += 1) covered[index] = true;
    const bounds = clauseBounds(text, start, end);
    if (subjectIsThing(text.slice(bounds.from, start))) continue;
    const clause = text.slice(bounds.from, bounds.to);
    if (DIE_TRAINING.test(clause) || JOKE_MARKER.test(clause)) {
      hold = true;
      continue;
    }
    return "self_harm";
  }

  for (const match of text.matchAll(/\bdie\b/g)) {
    if (!covered[match.index ?? 0]) return "self_harm";
  }
  return hold ? "hold" : null;
}

function distressHold(text: string): DraftHold {
  const reasonCodes: HoldReason[] = ["distress_wording"];
  if (matches(text, ASKS_FOR_COACH)) reasonCodes.push("asks_for_coach");
  if (matches(text, PROGRAM_SWAP)) reasonCodes.push("program_swap");
  return { kind: "hold", reasonCodes };
}

/**
 * Keyword and pattern rules. Self harm is checked before injury and emergency.
 * Emergency is checked before medical.
 * When a message could be an emergency, this returns the emergency template.
 * The word "die" is self harm. A listed joke or idiom is the exception.
 * "I'll die on this hill", "die hard", and "to die for" are clear.
 * "going to", "gonna", "about to", or "ready to" die, with training talk or a joke
 * marker in the same clause, is a coach hold. A subject that is not a person is clear.
 * A bare "going to die" stays self harm. Explicit self harm wording still wins.
 * tore, torn, pulled, strained, or tweaked, with a hamstring, calf, quad, groin, or acl,
 * is the medical safety template, including when a die joke is in the same message.
 * "end it" plus training talk in the same clause is a hold, not a refusal.
 * Those holds run only after emergency and injury. A medical emergency plus a
 * die hold still gets the emergency template and the 988 line.
 * Asks for the coach and program swaps are holds, not refusals.
 * This runs on the raw message, before retrieval.
 */
export function checkRefusals(message: string): RefusalCheck {
  const text = normalizeText(message);
  if (matches(text, SELF_HARM)) return selfHarmRefusal();
  const die = dieClass(text);
  if (die === "self_harm") return selfHarmRefusal();
  const endIt = endItClass(text);
  if (endIt === "self_harm") return selfHarmRefusal();
  const directed = selfDirectedInjury(text);
  if (directed?.templateId === "emergency" && die === "hold") return selfHarmRefusal();
  if (directed) return directed;
  if (matches(text, EMERGENCY)) {
    if (die === "hold") return selfHarmRefusal();
    return emergencyRefusal();
  }
  if (matches(text, MEDICAL)) return medicalRefusal();
  if (die === "hold" || endIt === "hold") return distressHold(text);
  const reasonCodes: HoldReason[] = [];
  if (matches(text, ASKS_FOR_COACH)) reasonCodes.push("asks_for_coach");
  if (matches(text, PROGRAM_SWAP)) reasonCodes.push("program_swap");
  if (reasonCodes.length > 0) return { kind: "hold", reasonCodes };
  return { kind: "none" };
}
