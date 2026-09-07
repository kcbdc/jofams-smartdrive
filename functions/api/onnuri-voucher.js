const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'};

export async function onRequestGet({request,env}){
  const q=new URL(request.url);
  const west=num(q.searchParams.get('west')),south=num(q.searchParams.get('south'));
  const east=num(q.searchParams.get('east')),north=num(q.searchParams.get('north'));
  const lng=num(q.searchParams.get('lng')),lat=num(q.searchParams.get('lat'));
  const source=String(env.ONNURI_MERCHANT_DATA_URL||'').trim();
  if(!source)return json({ok:false,configured:false,error:'ONNURI_MERCHANT_DATA_URL is not configured',items:[]},503);

  try{
    const rows=await fetchSource(source,env);
    const boundsValid=[west,south,east,north].every(Number.isFinite);
    const regionWords=await resolveRegionWords(lat,lng,env.KAKAO_REST_API_KEY);
    const localRows=rows.filter(x=>{
      const addr=pick(x,['주소','소재지','가맹점주소','도로명주소','지번주소','address','addr']);
      if(!regionWords.length)return true;
      const text=String(addr||'');
      return regionWords.some(w=>w&&text.includes(w));
    }).slice(0,700);

    const items=[];
    for(const row of localRows){
      const name=String(pick(row,['가맹점명','점포명','상호명','상점명','상호','name'])||'온누리상품권 가맹점').trim();
      const address=String(pick(row,['주소','소재지','가맹점주소','도로명주소','지번주소','address','addr'])||'').trim();
      let x=num(pick(row,['경도','longitude','lng','x','X']));
      let y=num(pick(row,['위도','latitude','lat','y','Y']));
      if(!(validKorea(y,x))&&address&&env.KAKAO_REST_API_KEY){
        const g=await geocode(address,env.KAKAO_REST_API_KEY);
        if(g){x=g.lng;y=g.lat}
      }
      if(!validKorea(y,x))continue;
      if(boundsValid&&(x<west-.02||x>east+.02||y<south-.02||y>north+.02))continue;
      items.push({
        id:String(pick(row,['가맹점코드','가맹점번호','id','ID'])||`${name}:${address}`),
        name,address,lng:x,lat:y,
        market:String(pick(row,['시장명','소속시장명','전통시장명','market'])||''),
        category:String(pick(row,['취급품목','업종','품목','category'])||''),
        paper:yes(pick(row,['지류취급여부','지류','종이상품권','paper'])),
        digital:yes(pick(row,['디지털취급여부','충전식카드','모바일','digital','card'])),
        source:'onnuri-official-data'
      });
      if(items.length>=500)break;
    }
    return json({ok:true,configured:true,provider:'소상공인시장진흥공단 온누리상품권 가맹점 데이터',items},200);
  }catch(e){
    return json({ok:false,configured:true,error:String(e?.message||e),items:[]},502);
  }
}

async function fetchSource(source,env){
  const u=new URL(source);
  const key=String(env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||env.ONNURI_SERVICE_KEY||'').trim();
  if(key&&!u.searchParams.has('serviceKey')&&!u.searchParams.has('service-key'))u.searchParams.set('serviceKey',key);
  if(/api\.odcloud\.kr/i.test(u.hostname)){
    if(!u.searchParams.has('page'))u.searchParams.set('page','1');
    if(!u.searchParams.has('perPage'))u.searchParams.set('perPage','1000');
  }
  const r=await fetch(u,{headers:{accept:'application/json,text/csv,text/plain;q=.9'}});
  if(!r.ok)throw new Error(`온누리 원천데이터 HTTP ${r.status}`);
  const ct=String(r.headers.get('content-type')||'').toLowerCase(),text=await r.text();
  if(ct.includes('json')||text.trim().startsWith('{')||text.trim().startsWith('[')){
    const d=JSON.parse(text);
    const rows=d?.data||d?.items||d?.response?.body?.items?.item||d?.response?.body?.items||d;
    return Array.isArray(rows)?rows:(rows?[rows]:[]);
  }
  return parseCsv(text);
}
function parseCsv(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return [];
  const head=csvLine(lines[0]);
  return lines.slice(1).map(line=>{const vals=csvLine(line),o={};head.forEach((h,i)=>o[h]=vals[i]??'');return o});
}
function csvLine(line){
  const out=[];let cur='',quote=false;
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++}else quote=!quote}else if(ch===','&&!quote){out.push(cur);cur=''}else cur+=ch}
  out.push(cur);return out;
}
async function resolveRegionWords(lat,lng,key){
  if(!key||!Number.isFinite(lat)||!Number.isFinite(lng))return [];
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');u.searchParams.set('x',lng);u.searchParams.set('y',lat);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});
    if(!r.ok)return [];
    const d=await r.json(),x=(d.documents||[]).find(v=>v.region_type==='H')||(d.documents||[])[0];
    return [x?.region_2depth_name,x?.region_1depth_name].filter(Boolean);
  }catch{return []}
}
async function geocode(address,key){
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/address.json');u.searchParams.set('query',address);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});
    if(!r.ok)return null;
    const d=await r.json(),x=(d.documents||[])[0];if(!x)return null;
    return{lng:num(x.x),lat:num(x.y)};
  }catch{return null}
}
function pick(o,keys){for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k];return ''}
function yes(v){return /^(y|yes|true|1|가능|취급|사용)$/i.test(String(v||'').trim())}
function num(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function validKorea(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=32&&lat<=39.8&&lng>=124&&lng<=132}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
