/** Shared plan copy + display prices (checkout amounts come from Stripe price ids). */
export const PLANS = [
  {
    id: "task_runner",
    tier: "Task Runner",
    name: "Ally Task Runner",
    price: 9.99,
    compareAtPrice: 14.99,
    tagline: "Three tasks a day. That's it.",
    description:
      "Not a chat assistant — a task runner. Queue up to 3 jobs per day, Ally works them in the background, and texts you when each one finishes. No Gmail, Calendar, Drive, or Sheets. No conversation memory or back-and-forth. Just hand off a task and get a text when it's done.",
    stripeDescription:
      "Run up to 3 background tasks per day. Ally completes each job and texts you when it's done. No Gmail, Calendar, or Drive. No chat memory or proactive messages. Upgrade to Ally ($19.99) for Google tools and unlimited tasks.",
    features: [
      "3 background tasks per day (resets daily)",
      "Queue from web or SMS — Ally runs the job and texts you when it's done",
      "No Gmail, Calendar, Drive, or Sheets",
      "No ongoing conversation or chat memory",
      "Upgrade anytime for Google tools + unlimited tasks",
    ],
    footnote: "$9.99/mo. cancel anytime.",
  },
  {
    id: "starter",
    tier: "Starter",
    name: "Ally",
    price: 19.99,
    compareAtPrice: 34.99,
    tagline: "Text Ally when you need a hand.",
    features: [
      "Works with Gmail, Calendar, Drive, Sheets and more",
      "Unlimited background tasks",
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

export const TASK_RUNNER_MONTHLY_LABEL = planMonthlyLabel("task_runner");
export const STARTER_MONTHLY_LABEL = planMonthlyLabel("starter");
export const PRO_MONTHLY_LABEL = planMonthlyLabel("pro");
