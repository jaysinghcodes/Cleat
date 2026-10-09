/** Demo knowledge base. Ticket 7 seeds these articles and the eval set retrieves them. */

export type DemoArticle = {
  id: string;
  title: string;
  category: "safety" | "faq" | "rules";
  body: string;
};

export const DEMO_ORG_ID = "d1000000-0000-4000-8000-000000000001";

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    id: "d1500000-0000-4000-8000-000000000001",
    title: "Injury and pain policy",
    category: "safety",
    body: "If a set causes pain, stop that exercise. Do not keep loading a painful joint. Cleat does not diagnose injuries or tell you how to treat them. Message your coach and check with a medical professional if you are hurting.",
  },
  {
    id: "d1500000-0000-4000-8000-000000000002",
    title: "What is on my program today",
    category: "faq",
    body: "What is on my program today? Open Today for the day name, sets, and reps.",
  },
  {
    id: "d1500000-0000-4000-8000-000000000003",
    title: "How to book or cancel",
    category: "faq",
    body: "How do I book or cancel a session? Open the Book tab, pick an open slot, and cancel from that session before the cutoff.",
  },
  {
    id: "d1500000-0000-4000-8000-000000000004",
    title: "How does a deload week work",
    category: "faq",
    body: "How does a deload week work? Keep the same exercises and use lighter weights. Your coach assigns the deload week.",
  },
  {
    id: "d1500000-0000-4000-8000-000000000005",
    title: "Hard refusal rule",
    category: "rules",
    body: "The assistant refuses injury, pain, medication, and emergency messages. It sends a fixed safety reply and alerts the coach. It does not invent treatment advice.",
  },
];
