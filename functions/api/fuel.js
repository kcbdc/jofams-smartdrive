/* /api/fuel — 오피넷 주변 주유소 가격 (Cloudflare Pages Function)
 *
 * v7.6.26 개선 사항
 *  1) 반경 검색(aroundAll.do)을 우선 사용: 카카오 지역 키/시군구 코드 매핑 없이도 "현재 위치 주변" 결과를 돌려준다.
 *     기존 lowTop10.do 는 "시군구 최저가 N개"라 반경 개념이 없고, 지역을 못 찾으면 전국 목록/빈 목록이 나왔다.
 *  2) 실패 시 단계적 폴백: 반경 5km(가격순→거리순) → 시군구 lowTop10 → 시도 lowTop10 (전국 폴백은 하지 않음: 엉뚱한 지역 가격 방지)
 *  3) 오류·빈 응답은 캐시하지 않는다(no-store). 기존에는 오류도 public 120초 캐시되어 한 번 실패하면 재시도해도 같은 오류가 나왔다.
 *  4) 오피넷 호출에 User-Agent/Accept 헤더, certkey+code 두 인증 파라미터, https→http 폴백, 8초 타임아웃.
 *  5) 좌표(KATEC)를 서버에서 WGS84 로 변환해 lat/lng 를 항상 제공(카카오 지오코딩 불필요).
 *  6) ?diag=1 : 단계별 상태(키 값은 제외)를 돌려줘 배포 환경 문제를 바로 확인할 수 있다.
 */
const OK_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=120'};
const ERR_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const UA='Mozilla/5.0 (compatible; DangolroNavi/7.6)';
const PRODUCTS={B027:'휘발유',D047:'경유',B034:'고급휘발유',K015:'LPG'};

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
  const prodcd=PRODUCTS[url.searchParams.get('prodcd')]?url.searchParams.get('prodcd'):'B027';
  const cnt=Math.max(1,Math.min(20,Number(url.searchParams.get('cnt'))||8));
  const diag=url.searchParams.get('diag')==='1';
  const trace=[];
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180||(lat===0&&lng===0))
    return json({error:'올바른 lat/lng가 필요합니다.',code:'INVALID_COORDINATES'},400);

  const certKey=String(env.OPINET_CERT_KEY||env.OPINET_API_KEY||env.OPINET_KEY||env.OIL_API_KEY||'').trim();
  if(!certKey)return json({
    error:'오피넷 인증키가 서버에 연결되지 않았습니다.',code:'OPINET_KEY_MISSING',
    setup:'Cloudflare Pages > Settings > Variables and Secrets (Production)에 OPINET_CERT_KEY 를 등록하고 재배포하세요.'
  },503);

  try{
    let stations=[],source='',radius=0,areaName='',upstreamError=null,sawEmptyOk=false;
    // 1) 반경 검색 — 5km 가격순. 비어 있으면(드문 경우) 같은 반경에서 거리순으로 한 번 더.
    try{
      const [x,y]=wgs84ToKatec(lat,lng);
      for(const sort of ['1','2']){
        const found=await opinetAround(x,y,prodcd,5000,sort,certKey,trace);
        if(!found.length)sawEmptyOk=true;
        if(found.length){
          stations=found.sort((a,b)=>a.price-b.price).slice(0,cnt);
          source='aroundAll';radius=5000;break;
        }
      }
    }catch(e){upstreamError=upstreamError||e;trace.push({step:'aroundAll',error:String(e?.message||e).slice(0,160)})}

    // 2) 폴백: 시군구/시도 기준 최저가 (카카오 키가 있어 지역 판별이 가능할 때만)
    if(!stations.length){
      const region=await kakaoRegion(lat,lng,env.KAKAO_REST_API_KEY).catch(()=>null);
      if(region){
        const area=await resolveOpinetArea(region,certKey,trace).catch(e=>{upstreamError=upstreamError||e;trace.push({step:'area',error:String(e?.message||e).slice(0,160)});return null});
        if(area){
          areaName=[region.region1,region.region2].filter(Boolean).join(' ');
          for(const code of [area.sigunCode,area.sidoCode].filter(Boolean)){
            const rowsFound=await opinetLow(code,prodcd,cnt,certKey,trace).catch(e=>{upstreamError=upstreamError||e;return []});
            if(rowsFound.length){stations=rowsFound;source='lowTop10';break}
          }
        }
      }
    }

    if(!stations.length){
      // 조회 API 둘 다 빈 배열이면 "5km 내 주유소 없음"으로 단정하면 안 된다.
      // 전국 시도 목록은 정상 인증/서비스라면 비어 있지 않아야 하므로 독립 점검한다.
      let catalogOk=false, catalogError=null;
      try {
        const catalog=rows(await fetchOpinetJson('areaCode.do',{},certKey,trace));
        catalogOk=catalog.length>0;
      }catch(e){catalogError=String(e?.message||e);}
      if(!catalogOk){
        return json({
          error:'오피넷 공개 API가 주유소와 지역코드 모두 빈 목록을 반환했습니다. 주변 주유소 부재가 아니라 인증키의 공개 API 권한·이용 상태 또는 오피넷 서비스 응답을 확인해야 합니다.',
          code:'OPINET_UPSTREAM_EMPTY',
          product:prodcd,productName:PRODUCTS[prodcd],stations:[],
          ...(diag?{diagnosis:'aroundAll·areaCode 모두 빈 결과입니다. 오피넷 웹사이트 지도와 공개 API 제공 상태는 별개이며, OPINET_CERT_KEY 발급·승인·사용 권한을 확인하세요.',catalogError,trace}:{})
        },502);
      }
      // 지역코드 목록은 정상이고 반경 결과만 비어 있을 때만 실제 데이터 부재 가능성을 표시한다.
      if(upstreamError&&!sawEmptyOk){
        const msg=String(upstreamError?.message||upstreamError);
        return json({error:msg,code:classify(msg),...(diag?{trace}:{})},502);
      }
      return json({
        error:'반경 5km 안에 해당 유종의 판매가격 정보가 없습니다.',code:'FUEL_EMPTY',
        product:prodcd,productName:PRODUCTS[prodcd],stations:[],...(diag?{trace}:{})
      },200,true);
    }

    const detailed=await Promise.race([
      enrichAddresses(stations.slice(0,8),certKey),
      new Promise(resolve=>setTimeout(()=>resolve(stations.slice(0,8)),2200))
    ]);
    const avg=stations.length?Math.round(stations.reduce((s,x)=>s+x.price,0)/stations.length):null;
    return json({
      provider:'opinet',source,radius,product:prodcd,productName:PRODUCTS[prodcd],
      areaName:areaName||(source==='aroundAll'?'현재 위치 주변 5km':'현재 지역'),
      averagePrice:avg,updatedAt:new Date().toISOString(),stations:detailed,
      ...(diag?{trace}:{})
    });
  }catch(e){
    const msg=String(e?.message||'오피넷 유가 조회에 실패했습니다.');
    return json({error:msg,code:classify(msg),...(diag?{trace}:{})},502);
  }
}

function classify(msg){
  if(/시간 초과|timeout|abort/i.test(msg))return 'OPINET_UPSTREAM_ERROR';
  if(/인증|certkey|등록되지|승인|만료|제한|초과|access denied|permission|invalid|unauthorized|key/i.test(msg))return 'OPINET_KEY_REJECTED';
  if(/차단|forbidden|403|html/i.test(msg))return 'OPINET_BLOCKED';
  return 'OPINET_UPSTREAM_ERROR';
}

/* ---------------- 오피넷 호출 ---------------- */
async function fetchOpinetJson(endpoint,params,key,trace){
  let lastErr=null,emptyResponse=null;
  // 공식 문서: certkey. 일부 연동 환경에서 code를 쓰므로 빈 목록도 다음 파라미터로 재검증.
  // 인증키를 암호화되지 않은 HTTP에 보내지 않는다.
  for(const keyParam of ['certkey','code']){
    const u=new URL(`https://www.opinet.co.kr/api/${endpoint}`);
    u.searchParams.set('out','json');u.searchParams.set(keyParam,key);
    for(const [k,v] of Object.entries(params||{}))if(v!==''&&v!=null)u.searchParams.set(k,String(v));
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
    try{
      const r=await fetch(u,{headers:{'user-agent':UA,accept:'application/json, text/plain, */*'},signal:ctrl.signal});
      const body=await r.text();
      trace?.push({step:endpoint,scheme:'https',keyParam,status:r.status,bytes:body.length,sample:mask(body,key).slice(0,260)});
      if(!r.ok)throw new Error(`오피넷 응답 오류 (HTTP ${r.status})`);
      let data;
      try{data=JSON.parse(body)}
      catch{throw new Error(/<html|<!doctype/i.test(body)?'오피넷 HTML 응답 (차단 또는 장애)':`오피넷 응답 형식 오류: ${mask(body,key).slice(0,120)}`)}
      assertOpinetEnvelope(data,key);
      const list=rows(data);
      if(list.length)return data;
      // 정상 JSON 모양의 빈 배열도 인증키 유형·서비스 상태에 따라 반환될 수 있다.
      // 바로 확정하지 않고 code 인증 방식까지 한 번 더 점검한다.
      emptyResponse=data;
    }catch(e){
      lastErr=e?.name==='AbortError'?new Error('오피넷 응답 시간 초과'):e;
      trace?.push({step:endpoint,keyParam,error:String(lastErr.message).slice(0,180)});
    }finally{clearTimeout(timer)}
  }
  if(emptyResponse)return emptyResponse;
  throw lastErr||new Error('오피넷 호출 실패');
}

function mask(text,key){const t=String(text||'');return key?t.split(key).join('***'):t}
/* 정상 응답은 {"RESULT":{"OIL":[...]}} 형태다. 그 외(인증 오류·호출 제한 안내 등)가 200 으로 오면 "데이터 없음"이 아니라 오류로 취급한다. */
function assertOpinetEnvelope(d,key){
  if(!d||typeof d!=='object')throw new Error('오피넷 응답 형식 오류');
  if(!('RESULT' in d)){
    const msg=mask(JSON.stringify(d),key).slice(0,160);
    throw new Error(`오피넷 오류 응답: ${msg}`);
  }
  const r=d.RESULT;
  if(r&&typeof r==='object'&&!Array.isArray(r)&&!('OIL' in r)&&!('AREA' in r)&&Object.keys(r).length){
    throw new Error(`오피넷 오류 응답: ${mask(JSON.stringify(r),key).slice(0,160)}`);
  }
}
function rows(d){
  const result=d?.RESULT;
  if(result&&typeof result==='object'&&!Array.isArray(result)&&result.CODE&&String(result.CODE)!=='00')
    throw new Error(`오피넷 인증/조회 오류: ${String(result.MESSAGE||result.CODE)}`);
  const r=d?.RESULT?.OIL??d?.RESULT?.AREA??d?.RESULT??[];
  return Array.isArray(r)?r:(r&&typeof r==='object'&&!r.CODE?[r]:[]);
}
function mapStation(x){
  const kx=Number(x.GIS_X_COOR),ky=Number(x.GIS_Y_COOR);
  const pos=Number.isFinite(kx)&&Number.isFinite(ky)&&kx>0&&ky>0?katecToWgs84(kx,ky):null;
  return{
    id:x.UNI_ID||x.OS_ID||'',name:x.OS_NM||x.OS_NM_KOR||'주유소',price:Number(x.PRICE)||0,
    brand:x.POLL_DIV_CD||x.POLL_DIV_CO||'',address:x.NEW_ADR||x.VAN_ADR||'',
    ...(x.DISTANCE!=null&&Number.isFinite(Number(x.DISTANCE))?{distance:Math.round(Number(x.DISTANCE))}:{}),
    ...(pos?{lat:pos[0],lng:pos[1]}:{})
  };
}
async function opinetAround(x,y,prodcd,radius,sort,key,trace){
  const d=await fetchOpinetJson('aroundAll.do',{x:x.toFixed(1),y:y.toFixed(1),radius,prodcd,sort},key,trace);
  return rows(d).map(mapStation).filter(s=>s.price>0);
}
async function opinetLow(area,prodcd,cnt,key,trace){
  const d=await fetchOpinetJson('lowTop10.do',{prodcd,area,cnt},key,trace);
  return rows(d).map(mapStation).filter(s=>s.price>0).sort((a,b)=>a.price-b.price);
}
async function enrichAddresses(items,key){
  return Promise.all(items.map(async s=>{
    if(s.address||!s.id)return s;
    try{
      const row=rows(await fetchOpinetJson('detailById.do',{id:s.id},key,null))[0]||{};
      return{...s,name:row.OS_NM||s.name,brand:row.POLL_DIV_CD||s.brand,address:row.NEW_ADR||row.VAN_ADR||s.address};
    }catch{return s}
  }));
}

/* ---------------- 지역 판별(폴백 전용) ---------------- */
async function kakaoRegion(lat,lng,key){
  if(!key)return null;
  const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  u.searchParams.set('x',lng);u.searchParams.set('y',lat);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4000);
  try{
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`},signal:ctrl.signal});
    if(!r.ok)return null;
    const d=await r.json();
    const doc=(d.documents||[]).find(x=>x.region_type==='H')||(d.documents||[])[0];
    return doc?{region1:doc.region_1depth_name||'',region2:doc.region_2depth_name||''}:null;
  }finally{clearTimeout(timer)}
}
function normName(s=''){return String(s).replace(/특별자치시|특별자치도|특별시|광역시|도|시|군|구|\s/g,'').toLowerCase()}
async function resolveOpinetArea(region,key,trace){
  const sidoRows=rows(await fetchOpinetJson('areaCode.do',{},key,trace));
  const n1=normName(region.region1);
  const sido=sidoRows.find(x=>normName(x.AREA_NM)===n1)||sidoRows.find(x=>n1&&(n1.includes(normName(x.AREA_NM))||normName(x.AREA_NM).includes(n1)));
  if(!sido)return null;
  let sigun=null;
  if(region.region2){
    const sigunRows=rows(await fetchOpinetJson('areaCode.do',{area:sido.AREA_CD},key,trace));
    const n2=normName(region.region2);
    sigun=sigunRows.find(x=>normName(x.AREA_NM)===n2)||sigunRows.find(x=>n2.includes(normName(x.AREA_NM))||normName(x.AREA_NM).includes(n2));
  }
  return{sidoCode:sido.AREA_CD||'',sigunCode:sigun?.AREA_CD||''};
}

/* ---------------- 좌표 변환: WGS84 <-> KATEC (오피넷 GIS 좌표) ----------------
   KATEC = Bessel 1841 TM(lat0=38, lon0=128, k=0.9999, FE=400000, FN=600000) + Helmert 7-parameter.
   PROJ 문자열 "+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43" 과 동일하게 구현(pyproj 와 교차 검증). */
const D2R=Math.PI/180,ARCSEC=Math.PI/(180*3600);
const BESSEL={a:6377397.155,f:1/299.1528128},WGS84={a:6378137,f:1/298.257223563};
const TM={lat0:38*D2R,lon0:128*D2R,k0:0.9999,fe:400000,fn:600000};
const HELMERT={dx:-115.80,dy:474.99,dz:674.11,rx:1.16*ARCSEC,ry:-2.31*ARCSEC,rz:-1.63*ARCSEC,m:1+6.43e-6};
function e2(el){return el.f*(2-el.f)}
function geodeticToEcef(lat,lng,el){const s=Math.sin(lat),c=Math.cos(lat),E=e2(el),N=el.a/Math.sqrt(1-E*s*s);return[N*c*Math.cos(lng),N*c*Math.sin(lng),N*(1-E)*s]}
function ecefToGeodetic(x,y,z,el){
  const E=e2(el),p=Math.hypot(x,y);let lat=Math.atan2(z,p*(1-E));
  for(let i=0;i<8;i++){const s=Math.sin(lat),N=el.a/Math.sqrt(1-E*s*s);lat=Math.atan2(z+E*N*s,p)}
  return[lat,Math.atan2(y,x)];
}
function besselToWgsEcef([x,y,z]){const H=HELMERT;return[H.dx+H.m*(x-H.rz*y+H.ry*z),H.dy+H.m*(H.rz*x+y-H.rx*z),H.dz+H.m*(-H.ry*x+H.rx*y+z)]}
function wgsToBesselEcef([X,Y,Z]){const H=HELMERT,x=(X-H.dx)/H.m,y=(Y-H.dy)/H.m,z=(Z-H.dz)/H.m;return[x+H.rz*y-H.ry*z,-H.rz*x+y+H.rx*z,H.ry*x-H.rx*y+z]}
function meridianArc(phi,el){
  const E=e2(el),E2=E*E,E3=E2*E;
  return el.a*((1-E/4-3*E2/64-5*E3/256)*phi-(3*E/8+3*E2/32+45*E3/1024)*Math.sin(2*phi)+(15*E2/256+45*E3/1024)*Math.sin(4*phi)-(35*E3/3072)*Math.sin(6*phi));
}
function tmForward(lat,lng,el){
  const E=e2(el),ep2=E/(1-E),s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=el.a/Math.sqrt(1-E*s*s),T=t*t,C=ep2*c*c,A=(lng-TM.lon0)*c;
  const M=meridianArc(lat,el),M0=meridianArc(TM.lat0,el);
  const x=TM.fe+TM.k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120);
  const y=TM.fn+TM.k0*(M-M0+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
  return[x,y];
}
function tmInverse(x,y,el){
  const E=e2(el),ep2=E/(1-E),M0=meridianArc(TM.lat0,el),M=M0+(y-TM.fn)/TM.k0;
  const mu=M/(el.a*(1-E/4-3*E*E/64-5*E**3/256)),e1=(1-Math.sqrt(1-E))/(1+Math.sqrt(1-E));
  const phi1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
  const s=Math.sin(phi1),c=Math.cos(phi1),t=Math.tan(phi1),N1=el.a/Math.sqrt(1-E*s*s),R1=el.a*(1-E)/Math.pow(1-E*s*s,1.5),T1=t*t,C1=ep2*c*c,D=(x-TM.fe)/(N1*TM.k0);
  const lat=phi1-(N1*t/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*D**6/720);
  const lng=TM.lon0+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*D**5/120)/c;
  return[lat,lng];
}
function wgs84ToKatec(latDeg,lngDeg){
  const ecef=geodeticToEcef(latDeg*D2R,lngDeg*D2R,WGS84);
  const [la,ln]=ecefToGeodetic(...wgsToBesselEcef(ecef),BESSEL);
  return tmForward(la,ln,BESSEL);
}
function katecToWgs84(x,y){
  const [la,ln]=tmInverse(x,y,BESSEL);
  const [lat,lng]=ecefToGeodetic(...besselToWgsEcef(geodeticToEcef(la,ln,BESSEL)),WGS84);
  return[Number((lat/D2R).toFixed(6)),Number((lng/D2R).toFixed(6))];
}

function json(data,status=200,noStore=false){
  return new Response(JSON.stringify(data),{status,headers:(status===200&&!noStore)?OK_HEADERS:ERR_HEADERS});
}
