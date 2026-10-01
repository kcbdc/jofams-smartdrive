package com.komsco.jofams.smartdrive

import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.*

/**
 * 주행 중 안전정보를 WebView 없이 네이티브에서 직접 조회/정규화한다.
 *
 * 기대 API:
 * - /api/cameras?bbox=... 또는 /api/cameras?lat=...&lng=...&radius=...
 * - /api/its-vsl?lat=...&lng=...
 *
 * 서버 응답 필드명이 일부 달라도 흔히 쓰는 alias를 폭넓게 수용한다.
 */
class NativeSafetyRepository(
    private val baseUrl: String,
    private val listener: Listener
) {
    interface Listener {
        fun onSafetyUpdated(events: List<NativeGuidanceEngine.SafetyEvent>)
        fun onVariableSpeedLimit(limit: Int?, roadName: String?)
        fun onSafetyError(message: String)
    }

    private val executor=Executors.newSingleThreadExecutor()
    private val main=Handler(Looper.getMainLooper())
    @Volatile private var cameraLoading=false
    @Volatile private var vslLoading=false
    private var lastCameraAt=0L
    private var lastVslAt=0L
    private var lastCameraLat=Double.NaN
    private var lastCameraLng=Double.NaN

    fun refresh(lat:Double,lng:Double,route:List<NativeGuidanceEngine.Point>,force:Boolean=false){
        val now=System.currentTimeMillis()
        val moved=if(lastCameraLat.isFinite()&&lastCameraLng.isFinite()) haversine(lastCameraLat,lastCameraLng,lat,lng) else Double.MAX_VALUE
        if(force || (!cameraLoading && (now-lastCameraAt>20_000L || moved>500.0))){
            refreshCameras(lat,lng,route)
        }
        if(force || (!vslLoading && now-lastVslAt>4_000L)){
            refreshVsl(lat,lng)
        }
    }

    private fun refreshCameras(lat:Double,lng:Double,route:List<NativeGuidanceEngine.Point>){
        cameraLoading=true
        executor.execute{
            try{
                val bbox=routeBbox(route,lat,lng)
                val q=buildString{
                    append(baseUrl.trimEnd('/')).append("/api/cameras?")
                    append("minLat=").append(bbox[0]).append("&minLng=").append(bbox[1])
                    append("&maxLat=").append(bbox[2]).append("&maxLng=").append(bbox[3])
                    append("&lat=").append(lat).append("&lng=").append(lng)
                    append("&radius=5000")
                }
                val json=getJson(q)
                val rows=when{
                    json is JSONArray -> json
                    json is JSONObject && json.optJSONArray("items")!=null -> json.optJSONArray("items")!!
                    json is JSONObject && json.optJSONArray("rows")!=null -> json.optJSONArray("rows")!!
                    json is JSONObject && json.optJSONArray("cameras")!=null -> json.optJSONArray("cameras")!!
                    json is JSONObject && json.optJSONArray("data")!=null -> json.optJSONArray("data")!!
                    else -> JSONArray()
                }
                val parsed=parseCameraRows(rows,route)
                main.post{
                    cameraLoading=false
                    lastCameraAt=System.currentTimeMillis()
                    lastCameraLat=lat;lastCameraLng=lng
                    listener.onSafetyUpdated(parsed)
                }
            }catch(e:Exception){
                main.post{
                    cameraLoading=false
                    listener.onSafetyError(e.message?:"CCTV 조회 실패")
                }
            }
        }
    }

    private fun refreshVsl(lat:Double,lng:Double){
        vslLoading=true
        executor.execute{
            try{
                val q="${baseUrl.trimEnd('/')}/api/its-vsl?lat=$lat&lng=$lng"
                val json=getJson(q)
                var bestLimit:Int?=null
                var road:String?=null
                if(json is JSONObject){
                    val direct=pickInt(json,"speedLimit","limit","maxspeed","lmttVe")
                    if(direct in 10..130){bestLimit=direct;road=pickStr(json,"roadName","road","roadNm")}
                    val arr=json.optJSONArray("items")?:json.optJSONArray("rows")?:json.optJSONArray("data")
                    if(arr!=null){
                        for(i in 0 until arr.length()){
                            val o=arr.optJSONObject(i)?:continue
                            val n=pickInt(o,"speedLimit","limit","maxspeed","lmttVe")
                            if(n in 10..130){
                                bestLimit=n
                                road=pickStr(o,"roadName","road","roadNm")
                                break
                            }
                        }
                    }
                }
                main.post{
                    vslLoading=false
                    lastVslAt=System.currentTimeMillis()
                    listener.onVariableSpeedLimit(bestLimit,road)
                }
            }catch(e:Exception){
                main.post{
                    vslLoading=false
                    listener.onSafetyError(e.message?:"ITS 제한속도 조회 실패")
                }
            }
        }
    }

    private fun parseCameraRows(rows:JSONArray,route:List<NativeGuidanceEngine.Point>):List<NativeGuidanceEngine.SafetyEvent>{
        if(route.size<2)return emptyList()
        // 카메라를 경로 정점(정수 index)에만 스냅하면 정점 간격(도로 형태에 따라 수십 m)만큼
        // 위치·거리 오차가 생길 수 있다. 정점 사이 보간 비율(t)로 연속 누적거리를 계산해
        // 카메라 단속 위치의 정밀도를 높인다.
        val cum=buildCum(route)
        val out=ArrayList<NativeGuidanceEngine.SafetyEvent>()
        for(i in 0 until rows.length()){
            val o=rows.optJSONObject(i)?:continue
            val lat=pickDouble(o,"lat","latitude","y","위도")
            val lng=pickDouble(o,"lng","longitude","x","경도")
            if(!lat.isFinite()||!lng.isFinite())continue

            val roadName=pickStr(o,"roadName","도로명","도로노선명","roadNm")
            val name=pickStr(o,"name","설치장소","itlpc","address","소재지도로명주소").ifBlank{"단속카메라"}
            val rawType=pickStr(o,"type","cameraType","카메라구분","단속구분","sectionPosition")
            val maxSpeed=pickInt(o,"maxspeed","speedLimit","제한속도","lmttVe").coerceAtLeast(0)
            val projection=projectToRoute(lat,lng,roadName,route)?:continue

            // 경로 스냅은 일반 카메라는 72m, 구간단속은 95m까지 허용한다.
            // 방향각이 제공되는 데이터는 역방향/평행도로 카메라를 추가로 제외한다.
            if(roadName.isNotBlank()&&projection.routeRoad.isNotBlank()&&!sameRoad(roadName,projection.routeRoad)&&projection.distanceM>22.0)continue

            val sectionPos=pickStr(o,"sectionPosition","구간단속구분","단속구간구분")
            val type=normalizeType(rawType,sectionPos)
            val cameraHeading=pickDouble(o,"heading","bearing","directionDeg","설치방향각도","단속방향각도")
            val maxSnapDistance = if(type=="section_speed_camera") 95.0 else 72.0
            if(projection.distanceM>maxSnapDistance)continue
            if(cameraHeading.isFinite() && angleDiff(cameraHeading, projection.routeHeading)>105.0)continue

            val segStart=cum[(projection.index-1).coerceIn(0,cum.lastIndex)]
            val segEnd=cum[projection.index.coerceIn(0,cum.lastIndex)]
            val preciseDistanceM=segStart+(segEnd-segStart)*projection.t

            out += NativeGuidanceEngine.SafetyEvent(
                id=pickStr(o,"id","manageNo","관리번호","cameraId").ifBlank{"native-cam-$i-${lat}-${lng}"},
                type=type,
                routeIndex=projection.index,
                endRouteIndex=null,
                name=name,
                roadName=roadName,
                maxSpeed=maxSpeed,
                lat=projection.lat,
                lng=projection.lng,
                sectionPosition=normalizeSectionPosition(sectionPos),
                sectionLengthMeters=pickDouble(o,"sectionLengthMeters","과속단속구간길이","sectionLength","구간길이").takeIf{it.isFinite()&&it>0},
                routeDistanceM=preciseDistanceM
            )
        }

        return pairSections(out,route)
    }

    private fun pairSections(events:List<NativeGuidanceEngine.SafetyEvent>,route:List<NativeGuidanceEngine.Point>):List<NativeGuidanceEngine.SafetyEvent>{
        val cum=buildCum(route)
        val starts=events.filter{it.sectionPosition=="start"}
        val ends=events.filter{it.sectionPosition=="end"}
        val used=HashSet<String>()
        val out=ArrayList<NativeGuidanceEngine.SafetyEvent>()
        out += events.filter{it.sectionPosition==null}

        for(st in starts){
            var best:NativeGuidanceEngine.SafetyEvent?=null
            var bestScore=Double.MAX_VALUE
            for(en in ends){
                if(en.id in used || en.routeIndex<=st.routeIndex)continue
                if(st.maxSpeed>0&&en.maxSpeed>0&&st.maxSpeed!=en.maxSpeed)continue
                val gap=cum[en.routeIndex]-cum[st.routeIndex]
                if(gap !in 250.0..30_000.0)continue
                val same=sameRoad(st.roadName,en.roadName)
                val stated=st.sectionLengthMeters?:en.sectionLengthMeters
                val lenPenalty=if(stated!=null)abs(gap-stated)/max(600.0,stated) else 0.0
                if(stated!=null&&lenPenalty>1.25&&!same)continue
                val score=gap/30_000.0+(if(same)-1.0 else 0.0)+lenPenalty*2
                if(score<bestScore){best=en;bestScore=score}
            }
            if(best!=null){
                used+=best.id
                out+=st.copy(
                    id="native-section:${st.id}:${best.id}",
                    type="section_speed_camera",
                    endRouteIndex=best.routeIndex,
                    maxSpeed=if(st.maxSpeed>0)st.maxSpeed else best.maxSpeed
                )
            }else{
                val stated=st.sectionLengthMeters
                if(stated!=null&&stated>=250){
                    val target=cum[st.routeIndex]+stated
                    var endIdx=st.routeIndex
                    while(endIdx<cum.lastIndex&&cum[endIdx]<target)endIdx++
                    if(endIdx>st.routeIndex){
                        out+=st.copy(
                            id="native-section:length:${st.id}",
                            type="section_speed_camera",
                            endRouteIndex=endIdx
                        )
                    }else out+=st.copy(type="speed_camera")
                }else out+=st.copy(type="speed_camera")
            }
        }

        for(en in ends){
            if(en.id in used)continue
            val stated=en.sectionLengthMeters
            if(stated!=null&&stated>=250){
                val target=cum[en.routeIndex]-stated
                var startIdx=en.routeIndex
                while(startIdx>0&&cum[startIdx]>target)startIdx--
                if(startIdx<en.routeIndex){
                    out+=en.copy(
                        id="native-section:length:${en.id}",
                        type="section_speed_camera",
                        routeIndex=startIdx,
                        endRouteIndex=en.routeIndex,
                        sectionPosition="start"
                    )
                }else out+=en.copy(type="speed_camera")
            }else out+=en.copy(type="speed_camera")
        }

        return out.distinctBy{it.id}
    }

    private data class Projection(val lat:Double,val lng:Double,val index:Int,val t:Double,val distanceM:Double,val routeRoad:String,val routeHeading:Double)

    private fun projectToRoute(lat:Double,lng:Double,roadName:String,route:List<NativeGuidanceEngine.Point>):Projection?{
        var best:Projection?=null
        var bestScore=Double.MAX_VALUE
        for(i in 1 until route.size){
            val a=route[i-1];val b=route[i]
            val p=project(lat,lng,a,b)
            val d=haversine(lat,lng,p.first,p.second)
            if(d>100)continue
            // route road name is not available in Point-only repository; keep blank and validate later in Guidance with segments.
            val score=d
            if(score<bestScore){
                bestScore=score
                best=Projection(p.first,p.second,i,p.third,d,"",bearingDeg(a.lat,a.lng,b.lat,b.lng))
            }
        }
        return best
    }

    private fun normalizeType(raw:String,section:String):String{
        val t="$raw $section".lowercase()
        return when{
            "구간" in t || "section" in t -> "section_speed_camera"
            "신호" in t && "과속" in t -> "signal_speed_camera"
            "신호" in t -> "signal_camera"
            "버스" in t -> "bus_lane_camera"
            "이동" in t -> "mobile_camera"
            "과속" in t || "speed" in t -> "speed_camera"
            else -> "speed_camera"
        }
    }

    private fun normalizeSectionPosition(v:String):String?{
        val t=v.lowercase()
        return when{
            "시점" in t || "시작" in t || "start" in t -> "start"
            "종점" in t || "종료" in t || "end" in t -> "end"
            else -> null
        }
    }

    private fun sameRoad(a:String,b:String):Boolean{
        val x=a.replace(" ","").lowercase()
        val y=b.replace(" ","").lowercase()
        if(x.isBlank()||y.isBlank())return false
        return x==y||x.contains(y)||y.contains(x)
    }

    private fun routeBbox(route:List<NativeGuidanceEngine.Point>,lat:Double,lng:Double):DoubleArray{
        if(route.isEmpty()){
            val d=.05
            return doubleArrayOf(lat-d,lng-d,lat+d,lng+d)
        }
        var minLat=Double.MAX_VALUE;var minLng=Double.MAX_VALUE
        var maxLat=-Double.MAX_VALUE;var maxLng=-Double.MAX_VALUE
        route.forEach{
            minLat=min(minLat,it.lat);maxLat=max(maxLat,it.lat)
            minLng=min(minLng,it.lng);maxLng=max(maxLng,it.lng)
        }
        val pad=.008
        return doubleArrayOf(minLat-pad,minLng-pad,maxLat+pad,maxLng+pad)
    }

    private fun getJson(url:String):Any{
        val conn=(URL(url).openConnection() as HttpURLConnection).apply{
            requestMethod="GET";connectTimeout=5000;readTimeout=8000
            setRequestProperty("Accept","application/json");useCaches=false
        }
        val code=conn.responseCode
        val stream=if(code in 200..299)conn.inputStream else conn.errorStream
        val text=BufferedReader(stream.reader(Charsets.UTF_8)).use{it.readText()}
        conn.disconnect()
        if(code !in 200..299)throw IllegalStateException("HTTP $code")
        val trim=text.trim()
        return if(trim.startsWith("["))JSONArray(trim) else JSONObject(trim)
    }

    private fun pickStr(o:JSONObject,vararg keys:String):String{
        for(k in keys){
            if(o.has(k)&&!o.isNull(k)){
                val v=o.optString(k).trim()
                if(v.isNotBlank())return v
            }
        }
        return ""
    }
    private fun pickInt(o:JSONObject,vararg keys:String):Int{
        for(k in keys){
            if(o.has(k)&&!o.isNull(k)){
                val n=o.optString(k).replace(",","").toDoubleOrNull()?.roundToInt()
                if(n!=null)return n
            }
        }
        return 0
    }
    private fun pickDouble(o:JSONObject,vararg keys:String):Double{
        for(k in keys){
            if(o.has(k)&&!o.isNull(k)){
                val n=o.optString(k).replace(",","").toDoubleOrNull()
                if(n!=null)return n
            }
        }
        return Double.NaN
    }

    private fun buildCum(route:List<NativeGuidanceEngine.Point>):DoubleArray{
        val c=DoubleArray(route.size)
        for(i in 1 until route.size)c[i]=c[i-1]+haversine(route[i-1].lat,route[i-1].lng,route[i].lat,route[i].lng)
        return c
    }
    private fun project(lat:Double,lng:Double,a:NativeGuidanceEngine.Point,b:NativeGuidanceEngine.Point):Triple<Double,Double,Double>{
        val kx=max(.2,cos(Math.toRadians(lat)))
        val x0=a.lng*kx;val y0=a.lat;val x1=b.lng*kx;val y1=b.lat
        val x=lng*kx;val y=lat;val dx=x1-x0;val dy=y1-y0
        val len2=dx*dx+dy*dy
        val t: Double = if (len2 > 0.0) {
            (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0.0, 1.0)
        } else {
            0.0
        }
        return Triple(y0+dy*t,(x0+dx*t)/kx,t)
    }
    private fun bearingDeg(lat1:Double,lng1:Double,lat2:Double,lng2:Double):Double{
        val p1=Math.toRadians(lat1);val p2=Math.toRadians(lat2);val dl=Math.toRadians(lng2-lng1)
        val y=sin(dl)*cos(p2)
        val x=cos(p1)*sin(p2)-sin(p1)*cos(p2)*cos(dl)
        return (Math.toDegrees(atan2(y,x))+360.0)%360.0
    }
    private fun angleDiff(a:Double,b:Double):Double{
        val d=abs((a-b)%360.0)
        return if(d>180.0)360.0-d else d
    }

    private fun haversine(a:Double,b:Double,c:Double,d:Double):Double{
        val r=6371000.0;val p=Math.PI/180.0
        val x=sin((c-a)*p/2).pow(2)+cos(a*p)*cos(c*p)*sin((d-b)*p/2).pow(2)
        return 2*r*asin(sqrt(x))
    }
}
