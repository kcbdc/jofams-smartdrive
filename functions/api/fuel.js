/* /api/fuel — 오피넷 주변 주유소 가격 (Cloudflare Pages Function)
 *
 * v7.6.26.3 개선 사항
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

  // Do not expose the key or its value in logs, traces, error messages, or returned URLs.
  const selectedKeyName=['OPINET_CERT_KEY','OPINET_API_KEY','OPINET_KEY','OIL_API_KEY'].find(name=>String(env[name]||'').trim())||null;
  const key=normalizeKey(selectedKeyName?env[selectedKeyName]:'');
  if(!key)return json({
    error:'오피넷 인증키가 서버에 연결되지 않았습니다.',code:'OPINET_KEY_MISSING',
    setup:'Cloudflare Pages > Settings > Variables and secrets 에 OPINET_CERT_KEY 를 등록하고 재배포하세요.'
  },503);

  let stations=[],source='',radius=0,areaName='',upstreamError=null,aroundEmpty=false;
  const [x,y]=wgs84ToKatec(lat,lng);
  try{
    // Opinet official documentation requires the certkey parameter, not 'code'.
    // One price-sorted nearby request, then one distance-sorted retry only if it is empty.
    // aroundAll.do 의 radius 최대값은 5000m. 그 이상은 잘못된 요청이므로 5km로 고정하고,
    // 비면 정렬만 바꿔 1회 재시도한다. 그래도 비면 아래 시군구/시도 lowTop10 폴백이 처리한다.
    // 정렬만 다른 재시도는 결과 집합이 같아 호출 한도만 소모하므로 1회만 호출한다.
    try{
      const found=await opinetAround(x,y,prodcd,5000,'1',key,trace);
      aroundEmpty=found.length===0;
      if(found.length){stations=found.sort((a,b)=>a.price-b.price).slice(0,cnt);source='aroundAll';radius=5000}
    }catch(e){upstreamError ||= e}

    if(!stations.length){
      const region=await kakaoRegion(lat,lng,env.KAKAO_REST_API_KEY).catch(()=>null);
      if(region){
        try{
          const area=await resolveOpinetArea(region,key,trace);
          if(area){
            areaName=[region.region1,region.region2].filter(Boolean).join(' ');
            for(const areaCode of [area.sigunCode,area.sidoCode].filter(Boolean)){
              try{
                const found=await opinetLow(areaCode,prodcd,cnt,key,trace);
                if(found.length){stations=found;source='lowTop10';break}
              }catch(e){upstreamError ||= e;trace.push({step:'lowTop10.do',error:safeError(e)})}
            }
          }
        }catch(e){upstreamError ||= e;trace.push({step:'area',error:safeError(e)})}
      }
    }

    if(!stations.length){
      // Critical: region lookup being empty is NOT evidence that no petrol station exists.
      // Verify the same key with coordinate-independent reference endpoints.
      // Catalog diagnostics are expensive and not product-specific. Run them only on
      // explicit ?diag=1; otherwise a transient empty result is not 'invalid key'.
      if(!diag){
        // 오피넷이 오류를 돌려준 경우(인증 거부/한도 초과/차단 등)를 '가격 없음'으로 숨기지 않는다.
        const summary=trace.map(t=>({step:t.step,status:t.status,rows:t.rowCount,error:t.error})).slice(0,6);
        // 위치와 무관한 지역코드 조회(areaCode.do)까지 200 + 0건이면 좌표·유종 문제가 아니라
        // 인증키 단위로 빈 응답이 오는 상태(일일 한도 초과, 키 승인/IP 제한, 키 만료 등)다.
        if(summary.some(t=>t.step==='areaCode.do'&&t.status===200&&t.rows===0)){
          return json({provider:'opinet',product:prodcd,productName:PRODUCTS[prodcd],stations:[],
            error:'오피넷이 인증키 요청에 빈 응답을 반환하고 있습니다(지역코드 조회도 0건).',
            code:'OPINET_KEY_QUOTA_SUSPECT',trace:summary},502);
        }
        if(upstreamError){
          const msg=String(upstreamError?.message||upstreamError);
          return json({provider:'opinet',product:prodcd,productName:PRODUCTS[prodcd],stations:[],
            error:'오피넷 응답 오류: '+safeError(upstreamError),code:classify(msg),trace:summary},502);
        }
        return json({provider:'opinet',source:'none',product:prodcd,productName:PRODUCTS[prodcd],
          stations:[],code:'OPINET_PRODUCT_UNAVAILABLE',trace:summary,
          error:`${PRODUCTS[prodcd]}의 주변 판매가격을 현재 확인하지 못했습니다. 다른 유종의 정상 조회와 인증 오류는 별개입니다.`,
          retryable:true},200,true);
      }
      const check=await checkOpinetCatalog(key,trace);
      const diagnostic={
        keySource:selectedKeyName,
        aroundEmpty, catalog:check,
        coordinateSystem:'KATEC',
        ...(diag?{testedLocation:{lat,lng,katecX:Math.round(x),katecY:Math.round(y)},trace}:{})
      };
      if(!check.areaOk && !check.averageOk){
        return json({
          error:'오피넷 API가 선택 유종 및 진단 요청에 빈 목록을 반환했습니다. 인증 문제로 확정할 수 없으므로 유종별 가격 게시 여부·일시 응답·호출 한도를 확인하세요.',
          code:'OPINET_KEY_OR_UPSTREAM',product:prodcd,productName:PRODUCTS[prodcd],stations:[],diagnostic,
          action:`Cloudflare의 ${selectedKeyName} Secret에 오피넷 공식 공개 API 인증키가 설정되어 있는지 확인하고 재배포하세요. 인증키·일일 이용량·공급 API 응답은 서버 밖에서 확인해야 합니다.`
        },502);
      }
      // Reference endpoints are healthy; do not claim an empty region if all region lookup failed.
      if(!check.areaOk){
        return json({
          error:'전국평균유가는 조회되지만 반경·지역코드 API는 빈 목록을 반환합니다. 반경 좌표/서비스별 이용 권한 또는 공급 응답을 점검하세요.',
          code:'OPINET_SEARCH_EMPTY_UNVERIFIED',product:prodcd,productName:PRODUCTS[prodcd],stations:[],diagnostic
        },502);
      }
      return json({
        error:'지역코드 API는 정상이나 주변 유가 검색에서 판매가격 자료를 확보하지 못했습니다. 실제 반경 내 주유소가 없다는 뜻은 아닙니다.',
        code:'OPINET_PRICE_NOT_AVAILABLE',product:prodcd,productName:PRODUCTS[prodcd],stations:[],diagnostic
      },200,true);
    }

    const detailed=await Promise.race([
      enrichAddresses(stations.slice(0,8),key),
      new Promise(resolve=>setTimeout(()=>resolve(stations.slice(0,8)),2200))
    ]);
    const avg=stations.length?Math.round(stations.reduce((sum,row)=>sum+row.price,0)/stations.length):null;
    return json({provider:'opinet',source,radius,product:prodcd,productName:PRODUCTS[prodcd],
      areaName:areaName||(source==='aroundAll'?`현재 위치 주변 ${Math.round(radius/1000)}km`:'현재 지역'),
      averagePrice:avg,updatedAt:new Date().toISOString(),stations:detailed,
      ...(diag?{trace,testedLocation:{lat,lng,katecX:Math.round(x),katecY:Math.round(y)}}:{})});
  }catch(e){
    return json({error:safeError(e),code:classify(String(e?.message||e)),...(diag?{trace}:{})},502);
  }
}

function normalizeKey(raw){
  // Support accidental wrapping quotes in Wrangler secrets, but do not mutate valid key content.
  const value=String(raw||'').trim();
  return value.length>1 && ((value[0]==='"'&&value.at(-1)==='"')||(value[0]==="'"&&value.at(-1)==="'"))?value.slice(1,-1).trim():value;
}
function safeError(e){return String(e?.message||e||'API error').replace(/(?:certkey|code|key)=([^&\s]+)/gi,'$1=[redacted]').slice(0,160)}
function classify(msg){
  if(/시간 초과|timeout|abort/i.test(msg))return 'OPINET_UPSTREAM_ERROR';
  if(/인증|certkey|등록되지|access denied|permission|invalid/i.test(msg))return 'OPINET_KEY_REJECTED';
  if(/차단|forbidden|403|html/i.test(msg))return 'OPINET_BLOCKED';
  return 'OPINET_UPSTREAM_ERROR';
}

/* The official API lists certkey as the sole authentication query parameter.
   Do not use HTTP fallback: an HTTP request leaks the credential. */
async function fetchOpinetJson(endpoint,params,key,trace){
  const url=new URL('https://www.opinet.co.kr/api/'+endpoint);
  url.searchParams.set('out','json');
  url.searchParams.set('certkey',key);
  for(const [k,v] of Object.entries(params||{}))if(v!==''&&v!=null)url.searchParams.set(k,String(v));
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
  try{
    const r=await fetch(url,{headers:{accept:'application/json, text/plain, */*','user-agent':UA},signal:ctrl.signal});
    const body=await r.text();
    const t={step:endpoint,status:r.status,bytes:body.length};
    if(!r.ok)throw new Error('오피넷 HTTP '+r.status);
    let obj;
    try{obj=JSON.parse(body)}catch{throw new Error(/<html|<!doctype/i.test(body)?'오피넷 HTML 응답':'오피넷 JSON 형식 오류')}
    const result=obj?.RESULT;
    if(result?.CODE && !['00','0','200'].includes(String(result.CODE)))throw new Error('오피넷 서비스 오류 '+String(result.CODE));
    // Log only structural metadata; never a response snippet or key.
    t.rowCount=Array.isArray(result?.OIL)?result.OIL.length:0;
    trace?.push(t);
    return obj;
  }catch(e){
    const err=e?.name==='AbortError'?new Error('오피넷 응답 시간 초과'):e;
    trace?.push({step:endpoint,error:safeError(err)});
    throw err;
  }finally{clearTimeout(timer)}
}
function rows(data){
  const obj=data?.RESULT;
  if(obj?.CODE && !['00','0','200'].includes(String(obj.CODE)))throw new Error('오피넷 서비스 오류 '+String(obj.CODE));
  const arr=obj?.OIL??obj?.AREA??obj??[];
  return Array.isArray(arr)?arr:(arr&&typeof arr==='object'&&!arr.CODE?[arr]:[]);
}
async function checkOpinetCatalog(key,trace){
  const result={areaOk:false,averageOk:false,areaCount:0,averageCount:0};
  for(const [endpoint,field] of [['areaCode.do','area'],['avgAllPrice.do','average']]){
    try{
      const data=rows(await fetchOpinetJson(endpoint,{},key,trace));
      result[field+'Count']=data.length;
      result[field+'Ok']=data.length>0;
    }catch(e){result[field+'Error']=safeError(e)}
  }
  return result;
}
function mapStation(row){
  const kx=Number(row.GIS_X_COOR),ky=Number(row.GIS_Y_COOR);
  const pos=Number.isFinite(kx)&&Number.isFinite(ky)&&kx>0&&ky>0?katecToWgs84(kx,ky):null;
  return{id:row.UNI_ID||row.OS_ID||'',name:row.OS_NM||row.OS_NM_KOR||'주유소',
    price:Number(row.PRICE)||0,brand:row.POLL_DIV_CD||row.POLL_DIV_CO||'',address:row.NEW_ADR||row.VAN_ADR||'',
    ...(row.DISTANCE!=null&&Number.isFinite(Number(row.DISTANCE))?{distance:Math.round(Number(row.DISTANCE))}:{}),
    ...(pos?{lat:pos[0],lng:pos[1]}:{})};
}
async function opinetAround(x,y,prodcd,radius,sort,key,trace){
  const data=await fetchOpinetJson('aroundAll.do',{x:x.toFixed(1),y:y.toFixed(1),radius,prodcd,sort},key,trace);
  return rows(data).map(mapStation).filter(s=>s.price>0);
}
async function opinetLow(area,prodcd,cnt,key,trace){
  const data=await fetchOpinetJson('lowTop10.do',{prodcd,area,cnt},key,trace);
  return rows(data).map(mapStation).filter(s=>s.price>0).sort((a,b)=>a.price-b.price);
}
async function enrichAddresses(items,key){
  return Promise.all(items.map(async station=>{
    if(station.address||!station.id)return station;
    try{
      const detail=rows(await fetchOpinetJson('detailById.do',{id:station.id},key,null))[0]||{};
      return {...station,name:detail.OS_NM||station.name,brand:detail.POLL_DIV_CD||detail.POLL_DIV_CO||station.brand,
        address:detail.NEW_ADR||detail.VAN_ADR||station.address};
    }catch{return station}
  }));
}
async function kakaoRegion(lat,lng,key){
  if(!key)return null;
  const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  u.searchParams.set('x',lng);u.searchParams.set('y',lat);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4000);
  try{
    const r=await fetch(u,{headers:{Authorization:'KakaoAK '+key},signal:ctrl.signal});
    if(!r.ok)return null;
    const d=await r.json(),doc=(d.documents||[]).find(v=>v.region_type==='H')||(d.documents||[])[0];
    return doc?{region1:doc.region_1depth_name||'',region2:doc.region_2depth_name||''}:null;
  }finally{clearTimeout(timer)}
}
function normName(s=''){return String(s).replace(/특별자치시|특별자치도|특별시|광역시|도|시|군|구|\s/g,'').toLowerCase()}
async function resolveOpinetArea(region,key,trace){
  const sidoRows=rows(await fetchOpinetJson('areaCode.do',{},key,trace));
  const n1=normName(region.region1);
  const sido=sidoRows.find(v=>normName(v.AREA_NM)===n1)||sidoRows.find(v=>n1&&(n1.includes(normName(v.AREA_NM))||normName(v.AREA_NM).includes(n1)));
  if(!sido)return null;
  let sigun=null;
  if(region.region2){
    const sigunRows=rows(await fetchOpinetJson('areaCode.do',{area:sido.AREA_CD},key,trace));
    const n2=normName(region.region2);
    sigun=sigunRows.find(v=>normName(v.AREA_NM)===n2)||sigunRows.find(v=>n2.includes(normName(v.AREA_NM))||normName(v.AREA_NM).includes(n2));
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
