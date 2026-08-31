export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(()=>({}));
  if (!env.DB) return json({ ok:true, stored:false, reason:'D1 binding not configured' });
  try {
    await env.DB.prepare(`INSERT INTO trip_events (event, destination, distance_m, duration_s, character, provider, guide_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .bind(body.event||'unknown', body.destination||null, numberOrNull(body.distance), numberOrNull(body.duration), body.character||null, body.provider||null, numberOrNull(body.guideType)).run();
  } catch (e) {
    // 0002 migration이 아직 적용되지 않은 기존 D1도 동작하도록 1차 스키마로 fallback.
    await env.DB.prepare(`INSERT INTO trip_events (event, destination, distance_m, duration_s, character, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
      .bind(body.event||'unknown', body.destination||null, numberOrNull(body.distance), numberOrNull(body.duration), body.character||null).run();
  }
  return json({ ok:true, stored:true });
}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
