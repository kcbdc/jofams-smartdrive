# 단골로 Workers AI (Llama / Gemma)

Cloudflare Pages > Settings > Bindings > Add > Workers AI: variable name `AI`, then redeploy.

API: POST `/api/ai/narrate` with `{ "model":"llama" | "gemma", "facts": { "kind":"local", "label":"지역사랑", "name":"상점", "distanceM":200, "detourMin":2, "price":0, "savingPerLiter":0 } }`.

Default Llama. To select Gemma in browser console: `localStorage.setItem('dangollo_ai_model','gemma')` then reload. To revert: `localStorage.setItem('dangollo_ai_model','llama')`.

AI only rewrites recommendation explanation, never changes routes, camera logic, prices or scores. On AI failure/timeouts, original text is retained. No API key exposed to browser. Workers AI has account-specific free allowances, not unlimited free inference. Check current Cloudflare model availability and billing.

No live Cloudflare binding/inference test performed.
