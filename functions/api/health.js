export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok:true,
    service:'jofams-smartdrive',
    version:'6.0.0',
    integrations:{
      kakao:Boolean(env.KAKAO_REST_API_KEY),
      koroadAccidentStats:Boolean(env.KOROAD_AUTH_KEY),
      safetyStatsDb:Boolean(env.DB),
      kakaoDirectionsTier:String(env.KAKAO_DIRECTIONS_TIER||'standard').toLowerCase(),
      d1:Boolean(env.DB)
    }
  }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
