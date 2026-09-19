// supabase/functions/send-reminders/index.ts
//
// Runs on a schedule (see sql/schedule-reminders.sql). For every
// assignment due in roughly 24 hours or roughly 0-4 hours, sends a push
// notification to every subscribed browser — once per assignment per
// reminder type, tracked in the sent_reminders table.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function reminderFor(hoursLeft: number): { type: string; title: string } | null {
  if (hoursLeft >= 20 && hoursLeft <= 25) {
    return { type: "day_before", title: "Due tomorrow" };
  }
  if (hoursLeft >= 0 && hoursLeft <= 4) {
    return { type: "due_soon", title: "Due soon" };
  }
  return null;
}

Deno.serve(async () => {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("*");
  if (assignmentsError) {
    return new Response(JSON.stringify({ error: assignmentsError.message }), { status: 500 });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("*");
  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
  }

  const now = Date.now();
  let sent = 0;

  for (const assignment of assignments ?? []) {
    const effective = assignment.is_extended && assignment.extended_at
      ? assignment.extended_at
      : assignment.due_at;
    const hoursLeft = (new Date(effective).getTime() - now) / 3_600_000;

    const reminder = reminderFor(hoursLeft);
    if (!reminder) continue;

    const body = `${assignment.assignment_name} (${assignment.subject}) — ${
      new Date(effective).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    }`;
    const payload = JSON.stringify({ title: reminder.title, body, url: "/" });

    for (const sub of subscriptions ?? []) {
      // Record intent first: the unique constraint on
      // (assignment_id, subscription_id, reminder_type) means this insert
      // only succeeds the first time, so it doubles as the de-dupe check.
      const { error: insertError } = await supabase.from("sent_reminders").insert({
        assignment_id: assignment.id,
        subscription_id: sub.id,
        reminder_type: reminder.type,
      });
      if (insertError) continue; // already sent this one

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        // Expired or revoked subscription — remove it so future runs skip it.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
