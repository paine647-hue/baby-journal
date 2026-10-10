import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORRECT_PIN = "2707"

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://baby-journal-theta.vercel.app",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { pin } = await req.json()
    const valid = pin === CORRECT_PIN

    return new Response(
      JSON.stringify({ valid }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch {
    return new Response(
      JSON.stringify({ valid: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})
