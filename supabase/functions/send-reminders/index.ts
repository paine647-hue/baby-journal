import webpush from "npm:web-push@3.6.7"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TZ = "Asia/Kolkata"
const GRACE_MIN = 30 // never fire a reminder more than this long after its time

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
)

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

function nowInTz() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

Deno.serve(async () => {
  const { date, minutes } = nowInTz()
  const reminders: any[] = await (await rest("bj_reminders?select=*&enabled=eq.true")).json()
  const due = reminders.filter((r) => {
    const [h, m] = r.time_local.split(":").map(Number)
    const diff = minutes - (h * 60 + m)
    return r.last_sent_date !== date && diff >= 0 && diff <= GRACE_MIN
  })
  if (!due.length) return Response.json({ sent: 0 })

  const subs: any[] = await (await rest("bj_push_subs?select=*")).json()
  let sent = 0
  for (const r of due) {
    // mark first so an overlapping run cannot double-send
    await rest(`bj_reminders?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ last_sent_date: date }) })
    const payload = JSON.stringify({ title: r.label, body: r.body, tag: `rem-${r.id}` })
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await rest(`bj_push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" })
        } else console.error("push failed", e.statusCode, e.body)
      }
    }))
  }
  return Response.json({ due: due.length, sent })
})
