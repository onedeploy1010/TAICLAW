import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detectAsset(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("bitcoin") || lower.includes("btc")) return "BTC";
  if (lower.includes("ethereum") || lower.includes("eth")) return "ETH";
  if (lower.includes("solana") || lower.includes("sol")) return "SOL";
  if (lower.includes("bnb") || lower.includes("binance coin")) return "BNB";
  if (lower.includes("dogecoin") || lower.includes("doge")) return "DOGE";
  if (lower.includes("xrp") || lower.includes("ripple")) return "XRP";
  return "CRYPTO";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const newsApiKey = Deno.env.get("NEWS_API_KEY");
    if (!newsApiKey) throw new Error("NEWS_API_KEY not set");

    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=bitcoin OR ethereum OR crypto OR cryptocurrency&language=en&sortBy=publishedAt&pageSize=15&apiKey=${newsApiKey}`,
      { headers: { Accept: "application/json" } }
    );

    if (!newsRes.ok) throw new Error(`NewsAPI error: ${newsRes.status}`);

    const newsData = await newsRes.json();
    const articles = (newsData.articles || []).filter(
      (a: any) => a.title && a.title !== "[Removed]" && a.description
    );

    if (articles.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const top8 = articles.slice(0, 8);
    const now = Date.now();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      // Fallback without AI
      const fallback = top8.map((article: any, i: number) => ({
        id: `news-${i}-${now}`,
        headline: article.title,
        source: article.source.name,
        publishedAt: article.publishedAt,
        url: article.url,
        asset: detectAsset(article.title + " " + (article.description || "")),
        prediction: "NEUTRAL",
        confidence: 50,
        impact: "MEDIUM",
        reasoning: "AI analysis temporarily unavailable",
      }));
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newsText = top8
      .map((a: any, i: number) => `${i + 1}. "${a.title}" - ${a.source.name} (${a.description?.slice(0, 120) || ""})`)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a crypto market analyst. Analyze each news headline for crypto market impact.
Return a JSON object with key "items" containing an array. Each element must have:
- "i": article number (1-8)
- "p": prediction ("BULLISH", "BEARISH", or "NEUTRAL")
- "c": confidence score (0-100)
- "imp": impact level ("HIGH", "MEDIUM", or "LOW")
- "r": one sentence reasoning about market impact
- "a": primary asset affected ("BTC","ETH","SOL","BNB","DOGE","XRP","CRYPTO")`,
          },
          { role: "user", content: `Analyze these headlines:\n${newsText}` },
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const items: any[] = parsed.items || parsed.analyses || parsed.predictions || parsed.results || [];

    const predictions = top8.map((article: any, i: number) => {
      const match = items.find((item: any) => item.i === i + 1 || item.index === i + 1) || items[i];
      const pred = match?.p || match?.prediction || "NEUTRAL";
      const conf = match?.c || match?.confidence || 50;
      const imp = match?.imp || match?.impact || "MEDIUM";
      const reason = match?.r || match?.reasoning || "Market impact analysis pending";
      const asset = match?.a || match?.asset || detectAsset(article.title + " " + (article.description || ""));

      return {
        id: `news-${i}-${now}`,
        headline: article.title,
        source: article.source.name,
        publishedAt: article.publishedAt,
        url: article.url,
        asset,
        prediction: ["BULLISH", "BEARISH", "NEUTRAL"].includes(pred) ? pred : "NEUTRAL",
        confidence: Math.min(100, Math.max(0, Number(conf) || 50)),
        impact: ["HIGH", "MEDIUM", "LOW"].includes(imp) ? imp : "MEDIUM",
        reasoning: reason,
      };
    });

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
