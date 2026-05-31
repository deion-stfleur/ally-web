/** Shared plan copy + display prices (checkout amounts come from Stripe price ids). */
export const PLANS = [
  {
    id: "starter",
    tier: "Starter",
    name: "Ally",
    price: 19.99,
    compareAtPrice: 34.99,
    tagline: "Text Ally when you need a hand.",
    features: [
      "Works with Gmail, Calendar, Drive, Sheets and more",
      "Handles tasks and searches web for you",
      "Keeps going until the job's done, then texts you",
      "Available on web and iMessage",
      "Learns your habits and preferences from chat",
    ],
    footnote: "$19.99/mo. cancel anytime.",
  },
  {
    id: "pro",
    tier: "Pro",
    name: "Ally Pro",
    price: 49.99,
    compareAtPrice: 79.99,
    tagline: "Ally stays on it and texts you first.",
    featured: true,
    footnote: "cancel anytime. switch plans from your dashboard.",
    features: [
      "Everything in Starter",
      "Remembers your interests, schedule, and tasks across all chats",
      "Texts you automatically when there's an update",
      "Handles complex tasks until they're done, all in one thread",
      "Sends scheduled recaps, check-ins, and reminders",
      "Run 24/7 background tasks for you",
      "Live website checks (Browser automation for hard tasks)",
    ],
  },
];

export function formatPlanPrice(price) {
  return Number(price).toFixed(2);
}

export function planMonthlyLabel(planId) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return "";
  return `${plan.name} ($${formatPlanPrice(plan.price)}/mo)`;
}

export const STARTER_MONTHLY_LABEL = planMonthlyLabel("starter");
export const PRO_MONTHLY_LABEL = planMonthlyLabel("pro");
