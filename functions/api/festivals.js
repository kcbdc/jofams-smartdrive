// Dangollo festivals — Korea Tourism Organization TourAPI 4.0.
// Configure TOUR_API_KEY as a Cloudflare Pages secret. No scraping of Naver pages.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=600':'no-store','x-content-type-options':'nosniff'}});
function ymd(date){return `${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}`}
function normalized(s){return String(s||'').replace(/<[^>]+>/g,'').trim().slice(0,240)}
export async function onRequestGet({request,env}){
  const uri=new URL(request.url);const key=env.TOUR_API_KEY||env.TOURAPI_KEY;
  if(!key)return reply({items:[],configurationRequired:true,message:'한국관광공사 TourAPI 인증키가 필요합니다. Cloudflare Pages 환경변수 TOUR_API_KEY를 등록하세요.'},503);
  const now=new Date();const kstDate=new Date(now.getTime()+9*3600000);
  const today=ymd(kstDate),start=new Date(kstDate.getTime()-120*86400000);
  const query=new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2');
  query.searchParams.set('serviceKey',key);query.searchParams.set('MobileOS','ETC');query.searchParams.set('MobileApp','Dangollo');query.searchParams.set('_type','json');
  query.searchParams.set('eventStartDate',ymd(start));query.searchParams.set('numOfRows','500');query.searchParams.set('pageNo','1');query.searchParams.set('arrange','A');
  let response;
  try{response=await fetch(query.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(9000),cf:{cacheEverything:true,cacheTtl:600}})}catch{return reply({items:[],message:'축제 정보 서버의 응답이 지연되고 있습니다.'},502)}
  if(!response.ok)return reply({items:[],message:`축제 정보 서버 오류 (${response.status})`},502);
  let json;try{json=await response.json()}catch{return reply({items:[],message:'축제 정보 응답 형식을 확인할 수 없습니다.'},502)}
  const root=json?.response;
  if(root?.header?.resultCode&&String(root.header.resultCode)!=='0000')return reply({items:[],message:'축제 API 인증키와 이용 권한을 확인해 주세요.',code:String(root.header.resultCode)},502);
  let arr=root?.body?.items?.item||[];if(!Array.isArray(arr))arr=[arr];
  const items=arr.map(x=>({
    id:String(x.contentid||''),name:normalized(x.title),address:normalized(x.addr1),
    start:String(x.eventstartdate||''),end:String(x.eventenddate||''),
    image:/^https:\/\//i.test(x.firstimage||'')?x.firstimage:'',
    lng:Number(x.mapx),lat:Number(x.mapy),tel:normalized(x.tel),
    source:'한국관광공사 TourAPI'
  })).filter(x=>x.id&&x.name&&/^\d{8}$/.test(x.start)&&/^\d{8}$/.test(x.end)&&x.end>=today&&x.start<=ymd(new Date(kstDate.getTime()+180*86400000)));
  return reply({items,total:items.length,updatedAt:new Date().toISOString(),source:'한국관광공사 TourAPI',partial:Number(root?.body?.totalCount||0)>arr.length});
}
