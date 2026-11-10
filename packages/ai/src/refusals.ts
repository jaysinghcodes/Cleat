import { oneEditApart } from "./keywords";
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
  // Red team additions. Slang, softer wording, and overdose wording.
  /\bunaliv/,
  /\bkms\b/,
  /\boff(?:ing)? myself\b/,
  /\bcutting myself\b/,
  /\b(?:hang|shoot|drown)(?:ing)? myself\b/,
  /\btak(?:e|ing) my (?:own )?life\b/,
  /\b(?:think(?:ing)?|thought|thoughts) (?:about|of) ending (?:things|everything)\b/,
  /\bend(?:ing)? everything\b/,
  /\bpoint (?:in|to|of) (?:living|life|going on)\b/,
  /\bbetter off without me\b/,
  /\b(?:life|living) (?:is not|isn'?t|isnt) worth\b/,
  /\bnot worth living\b/,
  /\bcan(?:not|'t|t) go on (?:anymore|any more|any longer|like this|living)\b/,
  /\bnever wake up\b/,
  /\b(?:want(?:s|ed|ing)?|wish(?:ed|ing)?|like) to (?:just )?disappear\b/,
  /\bdisappear forever\b/,
  /\boverdos/,
  /\b(?:pills?|meds|medication|tablets)\b[^.]{0,40}\bon purpose\b/,
  /\bon purpose\b[^.]{0,40}\b(?:pills?|meds|medication|tablets)\b/,
  // Red team round two. Hopeless wording that never names death.
  /\b(?:reason|point) to (?:live|be here|be alive|exist|go on|carry on|keep going)\b(?! (?:with|to the|on the))/,
  /\b(?:not|stop|cease to|rather not) exist(?:ing)?\b/,
  /\b(?:happier|better|better off|easier)\b[^.]{0,30}\bif i (?:was|were|wasn'?t|am) (?:gone|dead|not here|not around|never born)\b/,
  /\b(?:want|wish|hope|like)\b[^.]{0,30}\bnot wake up\b/,
  /\b(?:done|finished|through) with (?:life|living|it all)\b/,
  /\b(?:hate|tired of|sick of) (?:my life|living|being alive)\b/,
  /\bjump(?:ing)? (?:off|in front of) (?:a |the |my )?(?:bridge|building|roof|balcony|cliff|train|bus|car)\b/,
  /\b(?:nobody|no one|noone)(?: would| will|'d)? (?:even )?(?:miss me|care if i)\b/,
  /\b(?:my )?life (?:is|feels|seems) (?:pointless|meaningless|worthless|not worth)\b|\bi(?:'m| am|m) (?:worthless|a burden)\b/,
  /\bdark thoughts\b|\bgoodbye (?:everyone|everybody|forever|world)\b|\bmy last message\b|\blast time you(?:'ll| will) hear from me\b/,
  /\b(?:fine|better|happier|ok|okay) without me\b|\bnothing (?:left for me|to live for)\b|\bno way out\b/,
  /\btake (?:all|the whole bottle of|a bunch of|too many)\b[^.]{0,20}\b(?:pills?|meds|medication|tablets)\b/,
  /\b(?:going to|gonna|want to|wanna|about to|plan(?:ning)? to|ready to) end (?:things|everything)\b/,
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
  /(?<!\b(?:rowing|row|rower|swim|swimming|each|per|every|long|short|power|pull|bike) )\bstroke\b(?! rate)/,
  /facial droop/,
  /\bnumb\b/,
  /heart attack/,
  /\bcardiac\b/,
  /palpitation/,
  /\b(?:racing|pounding|irregular)\b[^.]{0,40}\bheart(?:beat)?s?\b/,
  /\bheart(?:beat)?s?\b[^.]{0,40}\b(?:racing|pounding|irregular)\b/,
  /\bheart(?:beat)?s?\b[^.]{0,48}(?:won'?t|will not|can(?:not|'t|t)) (?:slow|settle)/,
  // Red team additions. Misspellings, plain language for the same symptoms, and signs that were missing.
  /\bche(?:a|s)st\b|\bchets\b|\bchst\b/,
  /can(?:not|'t|t)(?: \w+)? breathe?\b/,
  /\b(?:barely|hardly|unable to|struggl\w+ to) breathe?\b/,
  /\bgasp(?:s|ed|ing)?\b/,
  /\bwheez/,
  /\bdizz?[yi]/,
  /\bwooz/,
  /\b(?:room|everything|head|world) (?:is|was|started|keeps|kept) spinning\b/,
  /\bwent (?:black|dark)\b/,
  /\bcollaps/,
  /\bunconscious\b|\bunresponsive\b|\bnot responding\b/,
  /\bblood\b(?! (?:is |was )?(?:pressure|sugar|pumping|flow|flowing|test|tests|work))/,
  /\bseizure|\bconvuls/,
  /\bthroat\b[^.]{0,24}\b(?:closing|closed|tight|swelling|swollen)\b/,
  /\ballergic reaction\b|\banaphyla|\bepipen\b/,
  /\bnumbness\b|\btingl/,
  /\bhit (?:my|his|her|their) head\b|\bconcuss|\bhead injury\b/,
  /\b(?:vision|eyesight)\b[^.]{0,30}\b(?:blurr\w*|black|dark|tunnel|double)\b/,
  /\bblurr(?:y|ed) vision\b|\bseeing (?:stars|double|spots)\b/,
  /\bjaw\b[^.]{0,30}\b(?:ach\w*|hurts?|pain\w*|tight)\b/,
  /\bheart(?:beat)?s?\b[^.]{0,40}\b(?:beating|going|thumping) (?:so |really |very |too |super )?(?:fast|hard)\b/,
  /\bheart(?:beat)?s?\b[^.]{0,48}(?:won'?t|will not|can(?:not|'t|t)) calm\b/,
  // Red team round two. Colour change, loss of feeling, and breathing attacks.
  /\b(?:lips?|face|fingers?|fingertips|skin)\b[^.]{0,20}\b(?:turn(?:s|ing|ed)?|going|gone|went|are|is|look(?:s|ing)?) (?:blue|purple|grey|gray|white|pale)\b/,
  /\b(?:can(?:not|'t|t)|could ?n[o']?t|couldnt|unable to) feel my\b/,
  /\basthma attack\b|\bpanic attack\b|\bslurr/,
  /\bheart(?:beat)?s?\b[^.]{0,40}\b(?:skip\w*|flutter\w*)\b|\bpalpitat/,
  /\bwent (?:fuzzy|blurry|white|grey|gray)\b|\bi hit the (?:floor|ground)\b/,
  /\b(?:get|getting|catch|catching) (?:any |enough )?air\b|\bchok(?:e|ed|ing)\b(?! up on)/,
  /\b(?:worst|sudden|severe|splitting|thunderclap) headache\b/,
  /\b(?:not|isn'?t|is not|won'?t|will not|stopped) (?:waking up|wake up|breathing|moving)\b(?<!\bdid not wake up)/,
];

const MEDICAL: RegExp[] = [
  /\bpain(?:s|ful|fully|killers?)?\b/,
  /\bhurt(?:s|ing|y)?\b/,
  /\binjur/,
  /\bknees?\b/,
  /\bshoulders?\b/,
  /\bankles?\b/,
  /\bhips?\b/,
  /pulled muscle/,
  /\bstrain(?:s|ed)?\b/,
  /\bsprain(?:s|ed)?\b/,
  /heart condition/,
  /heart disease/,
  /\bdiabet/,
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
  // Red team additions. Conditions, clinicians, drugs, supplements, illness, and diet asks that were missing.
  /\bach(?:e|es|ing|y)\b/,
  /\bswollen\b|\bswelling\b|\binflam/,
  /\brotator cuff\b|\bmeniscus\b|\bsciatic|\bhernia|\b(?:slipped|bulging|herniated) dis[ck]\b/,
  /\bfractur|\bdislocat|\bbroken? (?:my|a|an|his|her|their)\b|\bstitches\b|\bconcuss/,
  /\bsurger|\bsurgeon\b|\bphysio|\bphysical therap|\bchiropract|\bx-?ray\b|\bmri\b|\bdiagnos/,
  /\bfever|\bflu\b|\bnause|\bvomit|\bthrew up\b|\bthrowing up\b|\binfection\b|\bcovid\b|\bmigraine/,
  /\b(?:feel(?:s|ing)?|felt|am|i'm|im|been|got|getting|was) (?:\w+ )?sick\b(?! of)/,
  /\bnaproxen\b|\baleve\b|\bmotrin\b|\bacetaminophen\b|\bparacetamol\b|\bmuscle relax/,
  /\bantibiotic|\bantidepress|\binsulin\b|\binhaler\b|\bprescri|\bcortisone\b|\bprednisone\b/,
  /\bsteroids?\b|\bsarms?\b|\btestosterone\b|\bcreatine\b|\bsupplements?\b|\bpre-?workout\b|\bfat burners?\b/,
  /\b(?:how (?:much|many)|should i|do i need|what)\b[^.?!]{0,40}\b(?:protein|carbs?|carbohydrates?|fats?|sugar|fib(?:er|re)|sodium)\b[^.?!]{0,30}\b(?:eat|eating|have|need|take|get|consume|a day|per day|daily)\b/,
  /\bfasting\b|\bketo\b|\blow carb\b|\b(?:what|which|best|good|a|my|crash|on a|this) diet\b(?! (?:coke|soda|pepsi|sprite|drinks?))|\bdieting\b|\blos(?:e|ing) weight\b|\bweight loss\b/,
  // Red team round two. Named conditions, more drugs, clinicians, not eating, and stomach trouble.
  /\b[a-z]+itis\b|\bsplints?\b|\btendon|\barthrit|\basthma|\bscolios|\bosteo|\bepilep|\bcancer\b|\bchemo|\banemi|\bthyroid|\bcholesterol|\bhypertens|\bvertigo\b/,
  /\badderall\b|\bbeta ?blockers?\b|\bstatins?\b|\bblood thinners?\b|\bxanax\b|\bopioid|\boxy(?:codone|contin)\b|\bantihistamine|\bmetformin\b|\bozempic\b|\bwegovy\b|\bsemaglutide\b/,
  /\b(?:dr|doc|docs|gp|cardiologist|physician|nurse|specialist|orthopedist|ortho)\b/,
  /\b(?:have ?n[o']?t|havent|not|did ?n[o']?t|didnt|barely|hardly) (?:eaten|eat|ate|eating)\b|\bstarv|\bskip(?:ping|ped)? meals\b|\bpurg(?:e|ing)\b|\bbinge|\blaxative/,
  /\bsick to my stomach\b|\bstomach (?:ache|hurts|bug|cramps?)\b|\bqueasy\b/,
  /\bthrew (?:out )?my (?:lower |upper )?(?:back|neck|shoulder)\b|\bthrew (?:my )?(?:lower |upper )?(?:back|neck) out\b/,
  /\b(?:back|neck|spine|knees?|elbows?|wrists?|ankles?|hips?|shoulders?|joints?)\b[^.]{0,30}\bon fire\b/,
  /\b(?:been|am|i'?m|started|start|back to) cutting\b(?! (?:the|my|this|that|it|out|back|down|up)\b)/,
  /\bbad (?:dis[ck]|back|neck|wrist|elbow)\b|\bdis[ck] (?:issue|problem|injur)/,
  /\b(?:high|low) bp\b|\bbp (?:is|was|meds)\b/,
  /\b(?:can|should|could|may) i take\b(?! (?:a|an|the|my|this|that|time|some time|more|longer|extra|two|three|\d+)\b)|\bmelatonin\b|\bsleeping pills?\b|\bsleep aids?\b|\bcaffeine pills?\b/,
  /\bsafe to (?:lift|train|run|work ?out|exercise|squat|deadlift|bench|press|row)\b/,
  /\bwater weight\b|\bweigh ?in\b|\bsweat(?:ing)? (?:it|weight) (?:out|off)\b|\bdehydrat|\bsauna suit\b/,
  /\b(?:bad|awful|terrible|severe|horrible) cramps?\b|\bcramps? (?:are|is|were) (?:so |really )?(?:bad|awful|terrible|severe)\b|\bperiod cramps?\b|\bmenstrua/,
  /\b(?:tennis|golfers?) elbow\b|\b(?:runners?|jumpers?) knee\b|\bfrozen shoulder\b|\bcarpal tunnel\b/,
  /\b(?:got|have|having|caught|with|fighting) a (?:bad |head |chest )?cold\b|\bunder the weather\b|\bunwell\b|\bsore throat\b|\bcough|\bcongest|\bfeel(?:ing)? ill\b/,
  /\b(?:achilles|acl|mcl|pcl|labrum|it band)\b|\b(?:repair|reconstruction|replacement|operation|post ?op|rehab)\b/,
  /\burin|\bpee(?:ing)? (?:is |was )?(?:dark|brown|red|blood)|\bdark pee\b|\bheadaches?\b/,
  /\bic(?:e|ing) (?:it|or heat|my)\b|\bheat (?:it|pack|pad)\b|\bice pack\b|\b(?:slept|sleeping) (?:wrong|funny|weird)\b/,
  /**
   * tore, torn, pulled, strained, or tweaked, next to a hamstring, calf, quad, groin, or acl.
   * "hamstring curls" and "calf raises" do not match. A die joke later in the message still does.
   */
  /\b(?:tore|torn|pulled|strained|tweaked)\b(?:\s+(?:a|an|my|the|his|her|their|left|right|both|badly|really|just|up|slightly|pretty|so|very)){0,4}\s+(?:hamstrings?|calves|calf|quadriceps|quads?|groins?|acls?)\b/,
  /\b(?:(?:a|an|my|the|his|her|their)\s+)?(?:(?:left|right|both)\s+)?(?:hamstrings?|calves|calf|quadriceps|quads?|groins?|acls?)\b(?:\s+(?:is|was|got|feels|feel|feeling|really|badly|just|so|very|still)){0,3}\s+(?:tore|torn|pulled|strained|tweaked)\b/,
];

/** A body part and a symptom word in one message is an injury, even when neither word is on the list alone. */
const BODY_PART =
  /\b(?:back|spine|neck|wrists?|elbows?|knees?|shoulders?|ankles?|hips?|legs?|arms?|forearms?|hands?|fingers?|thumbs?|foot|feet|toes?|heels?|shins?|calf|calves|thighs?|quads?|hamstrings?|glutes?|groin|biceps?|triceps?|pecs?|lats?|traps?|abs|ribs?|joints?|muscles?|tendons?|ligaments?|achilles|head|jaw|collarbone)\b/;

/** "sore", "tired", and "dead" are left out on purpose. They are normal after training. */
const SYMPTOM =
  /\b(?:killing me|pop(?:ped|ping)?|snapp(?:ed|ing)|buckl(?:ed|ing|es)|flar(?:e|es|ed|ing) up|acting up|shooting|radiat(?:es|ing)|unstable|wobbly|lumps?|bumps?|tweak(?:s|ed|ing|y)?|pulled|tore|torn|tear|spasm(?:s|ing)?|cramp(?:s|ed|ing)?|twinge(?:s|d)?|pinch(?:ed|ing)?|sharp|stabbing|throbbing|bruis(?:e|ed|ing)|locked up|gave out|giving out|click(?:s|ing)?|grind(?:s|ing)?|messed up|jacked up|feels (?:off|wrong|weird|funny))\b/;

type Severity = "self_harm" | "emergency" | "medical";

/**
 * Longer safety words that are still caught when one letter is wrong, missing, extra, or swapped.
 * The word has to start with the same letter. Short words like chest are not here because
 * one edit turns them into everyday words. They have their own spelled out patterns.
 */
const TYPO_KEYWORDS: [string, Severity][] = [
  ["suicide", "self_harm"],
  ["suicidal", "self_harm"],
  ["breathe", "emergency"],
  ["breathing", "emergency"],
  ["bleeding", "emergency"],
  ["fainted", "emergency"],
  ["fainting", "emergency"],
  ["dizziness", "emergency"],
  ["unconscious", "emergency"],
  ["seizure", "emergency"],
  ["injury", "medical"],
  ["injured", "medical"],
  ["ibuprofen", "medical"],
  ["tylenol", "medical"],
  ["aspirin", "medical"],
  ["medication", "medical"],
  ["medicine", "medical"],
  ["shoulder", "medical"],
  ["sprained", "medical"],
  ["painful", "medical"],
  ["painkiller", "medical"],
  ["pregnant", "medical"],
  ["diabetes", "medical"],
  ["naproxen", "medical"],
  ["swollen", "medical"],
];

/** Everyday words one edit away from a safety word. */
const TYPO_ALLOWED = new Set(["breather", "aspiring", "blending", "breeding"]);

function typoSeverity(text: string): Severity | null {
  let worst: Severity | null = null;
  for (const word of text.match(/[a-z]+/g) ?? []) {
    if (word.length < 5 || TYPO_ALLOWED.has(word)) continue;
    for (const [keyword, severity] of TYPO_KEYWORDS) {
      if (word[0] !== keyword[0] || !oneEditApart(word, keyword)) continue;
      if (severity === "self_harm") return "self_harm";
      if (severity === "emergency" || worst === null) worst = severity;
    }
  }
  return worst;
}

/** Look alike letters from other alphabets, mapped to the plain letter. */
const LOOK_ALIKE: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s",
  "һ": "h", "ԁ": "d", "к": "k", "м": "m", "т": "t", "н": "h", "в": "b",
  "α": "a", "ε": "e", "ο": "o", "ι": "i", "κ": "k", "ρ": "p", "τ": "t", "υ": "u", "ν": "v",
};

const DIGIT_LETTER: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/**
 * Undoes the common ways a word is disguised: accents, look alike letters, hidden
 * characters, a digit or symbol standing in for a letter inside a word, letters
 * spaced or dotted apart, and a letter held down.
 * "8am" and "3 sets" are left alone because the digit is not inside a word.
 */
export function undisguise(text: string, runLength: 1 | 2 = 2): string {
  const plain = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "")
    .replace(/[^\u0000-\u007f]/g, (char) => LOOK_ALIKE[char] ?? char);
  const letters = plain.replace(/(?<=[a-z][013457@$!]*)[013457@$!](?=[013457@$!]*[a-z])/g, (char) => DIGIT_LETTER[char] ?? char);
  const joined = letters.replace(/\b(?:[a-z][ .\-_*]){2,}[a-z]\b/g, (run) => run.replace(/[ .\-_*]/g, ""));
  return joined.replace(/([a-z])\1{2,}/g, (_run, letter: string) => letter.repeat(runLength));
}

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
  // Red team additions. Asking for a person without the word coach.
  /\b(?:real|actual|live) (?:person|human|coach|trainer)\b/,
  /\ba human\b|\bsomeone real\b|\bnot a bot\b/,
  /\b(?:tell|get|have|ask) (?:alex|(?:my |the )?(?:coach|trainer))\b/,
  /\b(?:call|phone|ring) me\b/,
  /\b(?:speak|talk|chat) (?:to|with) (?:someone|somebody|a person|him|her|alex)\b/,
  /\bis (?:alex|(?:my |the )?(?:coach|trainer)) (?:around|there|in|available|free|online|here|about)\b/,
  /\bsomeone who can (?:actually |really )?help\b|\bget me (?:someone|somebody|help)\b/,
  /\b(?:speak|talk|chat) (?:to|with) (?:whoever|the (?:owner|manager|boss)|management)\b|\bwhoever (?:runs|is in charge)\b/,
  /\b(?:alex|coach|trainer)\b[^.]{0,20}\b(?:text|call|message|email|ring|phone|contact|reach) me\b|\btext me\b/,
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
  // Red team additions. A program change without the word program, or with it misspelled.
  /\b(?:different|another|new) (?:routine|split|workouts?)\b/,
  /\b(?:switch|swap|change|rewrite|redo|replace|quit) (?:me to |up )?(?:my |the |this |a |to a )?(?:whole )?(?:program\w*|routine|plan|workouts|split)\b/,
  /\b(?:put|move|get) me on(?:to)? (?:a |another |the |some )?(?:different |new |other )?(?:plan|program\w*|routine|split)\b/,
  /\b(?:different|another|new) plan\b/,
  /\b(?:fresh|different|another|new) (?:routine|split|plan|program\w*)\b/,
  /\b(?:program\w*|routine|plan|split)\b[^.]{0,30}\b(?:is not|isn'?t|not) (?:for me|working)\b|\bgive me something (?:else|different|new)\b/,
  /\b(?:cancel|scrap|ditch|drop|restart|reset) (?:my |the |this )?(?:whole )?(?:program\w*|routine|plan|split)\b|\bstart (?:over|again from scratch|from scratch)\b/,
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

/** Giving up wording that names no cause. */
const HOPELESS =
  /\bcan(?:not|'?t) (?:do|take|handle) (?:this|it|any of this) (?:anymore|any more|any longer)\b|\bwhat(?:'?s| is) the point\b(?! of\b)|\bno point (?:anymore|any more)\b/;

/**
 * "I can't do this anymore" and "what's the point" are self harm when the message
 * has no training talk. With training talk they are a coach hold, the same rule
 * the die jokes follow. "what's the point of a deload" is a normal question and is skipped.
 */
function hopelessClass(text: string): "self_harm" | "hold" | null {
  if (!HOPELESS.test(text)) return null;
  return DIE_TRAINING.test(text) ? "hold" : "self_harm";
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
function classify(text: string): RefusalCheck {
  if (matches(text, SELF_HARM)) return selfHarmRefusal();
  const die = dieClass(text);
  if (die === "self_harm") return selfHarmRefusal();
  const endIt = endItClass(text);
  if (endIt === "self_harm") return selfHarmRefusal();
  const hopeless = hopelessClass(text);
  if (hopeless === "self_harm") return selfHarmRefusal();
  const directed = selfDirectedInjury(text);
  if (directed?.templateId === "emergency" && die === "hold") return selfHarmRefusal();
  if (directed) return directed;
  if (matches(text, EMERGENCY)) {
    if (die === "hold") return selfHarmRefusal();
    return emergencyRefusal();
  }
  if (matches(text, MEDICAL)) return medicalRefusal();
  if (BODY_PART.test(text) && SYMPTOM.test(text)) return medicalRefusal();
  if (die === "hold" || endIt === "hold" || hopeless === "hold") return distressHold(text);
  const reasonCodes: HoldReason[] = [];
  if (matches(text, ASKS_FOR_COACH)) reasonCodes.push("asks_for_coach");
  if (matches(text, PROGRAM_SWAP)) reasonCodes.push("program_swap");
  if (reasonCodes.length > 0) return { kind: "hold", reasonCodes };
  return { kind: "none" };
}

function rank(check: RefusalCheck): number {
  if (check.kind === "none") return 0;
  if (check.kind === "hold") return 1;
  if (check.templateId === "medical_safety") return 2;
  if (check.templateId === "emergency") return 3;
  return 4;
}

function typoRefusal(text: string): RefusalCheck {
  const severity = typoSeverity(text);
  if (severity === "self_harm") return selfHarmRefusal();
  if (severity === "emergency") return emergencyRefusal();
  if (severity === "medical") return medicalRefusal();
  return { kind: "none" };
}

/**
 * The safety gate. Runs on the raw message, before retrieval, and never calls a model.
 * The message is classified as written, then again with common disguises undone
 * (look alike letters, digits for letters, spaced out letters, held down letters),
 * and longer safety words are also caught one typo away.
 * The most serious result wins: self harm, then emergency, then medical, then a hold.
 */
export function checkRefusals(message: string): RefusalCheck {
  const text = normalizeText(message);
  const variants = [...new Set([text, undisguise(text, 2), undisguise(text, 1)])];
  let worst = classify(text);
  for (const variant of variants.slice(1)) {
    const next = classify(variant);
    if (rank(next) > rank(worst)) worst = next;
  }
  for (const variant of variants) {
    const next = typoRefusal(variant);
    if (rank(next) > rank(worst)) worst = next;
  }
  return worst;
}
