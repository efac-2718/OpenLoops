#!/usr/bin/env bash
# Times a few Gemini API calls with GEMINI_API_KEY (never printed), from wherever this runs.
cd "$(dirname "$0")"
API=https://generativelanguage.googleapis.com/v1beta
summary() {
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const b = JSON.parse(s);
        if (b.error) return console.log("  error:", b.error.code, b.error.status, (b.error.message || "").slice(0, 200));
        if (b.models) return console.log("  flash models:", b.models.map(m => m.name).filter(n => /flash/.test(n)).join(", "));
        const c = (b.candidates || [])[0] || {};
        const text = ((c.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
        console.log("  model:", b.modelVersion, "| finish:", c.finishReason, "| tokens:", JSON.stringify(b.usageMetadata || {}));
        console.log("  text:", JSON.stringify(text.slice(0, 300)), "| length:", text.length);
      } catch (e) { console.log("  not JSON:", s.slice(0, 200)); }
    });'
}
call() { # name, model, body file
  echo "--- $1"
  curl -sS --max-time 90 -o /tmp/out.json -w "  HTTP %{http_code} in %{time_total}s\n" \
    -H "x-goog-api-key: $GEMINI_API_KEY" -H 'content-type: application/json' \
    -X POST --data @"$3" "$API/models/$2:generateContent" || echo "  curl failed"
  summary < /tmp/out.json
}
echo "--- models list"
curl -sS --max-time 30 -o /tmp/models.json -w "  HTTP %{http_code} in %{time_total}s\n" -H "x-goog-api-key: $GEMINI_API_KEY" "$API/models?pageSize=200" || echo "  curl failed"
summary < /tmp/models.json
call "Say OK (gemini-flash-latest, no schema)" gemini-flash-latest ok.json
call "Our request (gemini-flash-latest, schema)" gemini-flash-latest sort.json
call "Our request, output capped at 2048 tokens" gemini-flash-latest sort-capped.json
call "Our request (gemini-flash-lite-latest)" gemini-flash-lite-latest sort-capped.json
call "Our request (gemini-2.5-flash)" gemini-2.5-flash sort-capped.json
