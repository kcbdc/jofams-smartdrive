// Dangollo long-form content preservation adapter (v7.6.27.54)
// This middleware WRAPS the existing /api/content handler; it does not replace its
// authentication, existing D1/KV schema or admin permission checks.
// Required Pages KV binding: CONTENT_LONG_KV.
const MAX_BYTES = 240000;
const encoder = new TextEncoder();
const out = (obj, code=503) => new Response(JSON.stringify(obj), {
  status:code, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
const isRecord = v => v && typeof v === 'object' && !Array.isArray(v);
function noticeKey(id){return `dangollo:notice:long:${String(id).slice(0,150)}`}
const contentKey='dangollo:site:long:content';
async function decodeJSON(response){try {return await response.clone().json()}catch{return null}}
function responseWithJSON(original, object){
 const headers=new Headers(original.headers);
 headers.set('content-type','application/json; charset=utf-8');
 headers.set('cache-control','private, no-store');
 headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
 return new Response(JSON.stringify(object), {status:original.status,statusText:original.statusText,headers});
}
function tooLarge(json){return encoder.encode(JSON.stringify(json)).byteLength>MAX_BYTES}
export async function onRequest(context){
 const url=new URL(context.request.url);
 if(url.pathname !== '/api/content')return context.next();
 const type=url.searchParams.get('type');
 if(type!=='notices'&&type!=='content')return context.next();
 const method=context.request.method.toUpperCase();
 const kv=context.env.CONTENT_LONG_KV;
 let body=null;
 if((method==='POST'||method==='PUT'||method==='DELETE') && method!=='DELETE'){
   try{body=await context.request.clone().json()}catch{return out({ok:false,error:'INVALID_JSON'},400)}
   if(!isRecord(body))return out({ok:false,error:'INVALID_BODY'},400);
   if(tooLarge(body))return out({ok:false,error:'CONTENT_TOO_LARGE_240KB'},413);
   const needExtended=type==='notices'&&method==='POST'&&String(body.body||'').length>5000 ||
    type==='content'&&method==='PUT'&&(String(body.appInfo||'').length>5000||String(body.privacy||'').length>5000);
   if(needExtended&&!kv)return out({ok:false,error:'CONTENT_LONG_KV_REQUIRED',message:'Cloudflare Pages에 CONTENT_LONG_KV 바인딩을 먼저 등록해 주세요.'});
 }
 const response=await context.next(); // The existing service still authenticates all writes.
 if(!response.ok || !kv)return response;
 try{
  if(type==='notices' && method==='POST' && body && typeof body.body==='string' && body.body.length>5000){
   const result=await decodeJSON(response);
   const id=result?.item?.id ?? result?.id;
   if(id==null)return out({ok:false,error:'NOTICE_ID_MISSING',message:'서버가 공지 ID를 응답하지 않아 긴 본문을 연결할 수 없습니다.'});
   await kv.put(noticeKey(id),JSON.stringify({title:String(body.title||''),body:body.body}),{metadata:{v:1}});
   if(result?.item)result.item.body=body.body;
   return responseWithJSON(response,result);
  }
  if(type==='content' && method==='PUT' && body){
   await kv.put(contentKey,JSON.stringify({appInfo:body.appInfo??'',privacy:body.privacy??''}),{metadata:{v:1}});
   return response;
  }
  if(type==='notices' && method==='DELETE'){
   const del=await context.request.clone().json().catch(()=>null);
   if(del?.id!=null)await kv.delete(noticeKey(del.id));
   return response;
  }
  if(method==='GET'){
   const data=await decodeJSON(response);
   if(!isRecord(data))return response;
   if(type==='notices' && Array.isArray(data.items)){
     await Promise.all(data.items.map(async item=>{
       if(item?.id==null)return;
       const saved=await kv.get(noticeKey(item.id),'json');
       if(saved && typeof saved.body==='string' && saved.title===String(item.title||''))item.body=saved.body;
     }));
     return responseWithJSON(response,data);
   }
   if(type==='content'){
      const long=await kv.get(contentKey,'json');
      if(isRecord(long))data.content={...(data.content||{}),...long};
      return responseWithJSON(response,data);
   }
  }
 }catch(err){
  // Do not claim a successful long-text save when the secondary store failed.
  if(method==='POST'||method==='PUT')return out({ok:false,error:'LONG_CONTENT_STORAGE_FAILED',message:'긴 본문 보존 저장에 실패했습니다. Cloudflare KV 바인딩을 확인해 주세요.'});
  return out({ok:false,error:'LONG_CONTENT_READ_FAILED',message:'보존된 장문 콘텐츠 조회에 실패했습니다.'});
 }
 return response;
}
