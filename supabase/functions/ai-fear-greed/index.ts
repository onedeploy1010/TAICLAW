import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    const data = await res.json();
    const fg = data.data?.[0];
    const value = fg ? parseInt(fg.value) : 50;
    const classification = fg?.value_classification || "Neutral";

    const buyPercent = Math.min(Math.max(value, 15), 85);
    const sellPercent = 100 - buyPercent;

    return new Response(
      JSON.stringify({
        buyPercent: buyPercent.toFixed(1),
        sellPercent: sellPercent.toFixed(1),
        index: value,
        label: classification,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
