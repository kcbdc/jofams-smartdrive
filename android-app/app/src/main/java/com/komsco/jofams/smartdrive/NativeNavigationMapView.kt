package com.komsco.jofams.smartdrive

import android.content.Context
import android.graphics.*
import android.view.View
import kotlin.math.*

/**
 * Pure Native Navigation Map renderer.
 * 외부 SDK 없이 현재 route geometry/roadSegments/safety 정보를 Android Canvas에 렌더링한다.
 *
 * 기능:
 * - heading-up 주행 지도
 * - 현재 경로/지난 경로
 * - 분기 확대뷰
 * - 차로 안내 화살표
 * - CCTV/구간단속 시작·종료 아이콘
 * - 속도제한 표지
 * - 터널/추정주행 상태
 */
class NativeNavigationMapView(context: Context) : View(context) {

    data class JunctionPreview(
        val visible:Boolean=false,
        val title:String="",
        val instruction:String="",
        val distanceM:Double=0.0,
        val maneuverType:Int?=null
    )

    private var snapshot = NativeGuidanceEngine.NativeDriveSnapshot()
    private var safetyEvents: List<NativeGuidanceEngine.SafetyEvent> = emptyList()
    private var junction = JunctionPreview()
    private val density = resources.displayMetrics.density

    private val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color=Color.rgb(22,25,31) }
    private val road = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color=Color.rgb(58,63,72);style=Paint.Style.STROKE;strokeWidth=16f*density;strokeCap=Paint.Cap.ROUND;strokeJoin=Paint.Join.ROUND
    }
    private val route = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color=Color.rgb(63,131,255);style=Paint.Style.STROKE;strokeWidth=10f*density;strokeCap=Paint.Cap.ROUND;strokeJoin=Paint.Join.ROUND
    }
    private val past = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color=Color.rgb(82,88,98);style=Paint.Style.STROKE;strokeWidth=7f*density;strokeCap=Paint.Cap.ROUND
    }
    private val white = Paint(Paint.ANTI_ALIAS_FLAG).apply { color=Color.WHITE }
    private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color=Color.WHITE;typeface=Typeface.create(Typeface.DEFAULT,Typeface.BOLD)
    }
    private val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply { color=Color.rgb(195,202,214) }

    fun updateSnapshot(s:NativeGuidanceEngine.NativeDriveSnapshot){
        snapshot=s
        if(s.route.size>=2)loadingPulseStartMs=0L
        junction=buildJunctionPreview(s)
        invalidate()
    }

    fun setSafetyEvents(events:List<NativeGuidanceEngine.SafetyEvent>){
        safetyEvents=events
        invalidate()
    }

    private var loadingPulseStartMs = 0L

    override fun onDraw(canvas:Canvas){
        super.onDraw(canvas)
        canvas.drawRect(0f,0f,width.toFloat(),height.toFloat(),bg)
        if(snapshot.route.size<2){
            drawRouteLoadingState(canvas)
            return
        }
        drawNavigationBase(canvas)
        drawSafetyOverlay(canvas)
        drawCar(canvas)
        drawJunctionPreview(canvas)
        drawLaneGuide(canvas)
    }

    /**
     * 안내 시작 직후, 웹에서 경로 좌표(routeGeometry/navigationPayload)가 아직 도착하지 않은
     * 짧은 구간에는 텅 빈 암전 화면 대신 브랜드 로딩 화면을 보여준다.
     * ("길안내 시작전 이상한 검정화면" 현상 개선)
     */
    private fun drawRouteLoadingState(canvas:Canvas){
        if(loadingPulseStartMs==0L)loadingPulseStartMs=System.currentTimeMillis()
        val brand=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.rgb(28,60,140)}
        canvas.drawRect(0f,0f,width.toFloat(),height.toFloat(),brand)

        val cx=width/2f
        val cy=height*0.46f
        val elapsed=System.currentTimeMillis()-loadingPulseStartMs
        val phase=(elapsed%1400L)/1400.0
        for(i in 0 until 3){
            val p=((phase-i*0.18)+1.0)%1.0
            val radius=(18+p*30).toFloat()*density
            val alpha=(220*(1.0-p)).toInt().coerceIn(0,220)
            val ring=Paint(Paint.ANTI_ALIAS_FLAG).apply{
                color=Color.argb(alpha,99,153,255);style=Paint.Style.STROKE;strokeWidth=3f*density
            }
            canvas.drawCircle(cx,cy,radius,ring)
        }
        val dot=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.WHITE}
        canvas.drawCircle(cx,cy,10f*density,dot)

        val title=Paint(Paint.ANTI_ALIAS_FLAG).apply{
            color=Color.WHITE;textSize=17f*density;textAlign=Paint.Align.CENTER;typeface=Typeface.DEFAULT_BOLD
        }
        canvas.drawText("경로를 준비하고 있습니다",cx,cy+62f*density,title)
        val subText=Paint(Paint.ANTI_ALIAS_FLAG).apply{
            color=Color.rgb(200,214,255);textSize=12f*density;textAlign=Paint.Align.CENTER
        }
        canvas.drawText("GPS와 경로 정보를 불러오는 중이에요",cx,cy+86f*density,subText)

        // 경로 데이터가 도착할 때까지 부드럽게 애니메이션을 이어간다.
        postInvalidateDelayed(60L)
    }

    private val routeArrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(235, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 3.4f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    /**
     * 티맵처럼 경로선 위에 진행방향 화살표(셰브론)를 일정 간격으로 표시한다.
     * 자차 위치보다 앞쪽 구간에만 그려 진행 방향을 직관적으로 보여준다.
     */
    private fun drawRouteDirectionArrows(canvas: Canvas, aheadPath: Path) {
        val measure = PathMeasure(aheadPath, false)
        val spacing = 46f * density
        val arrowSize = 8.5f * density
        val pos = FloatArray(2)
        val tan = FloatArray(2)

        do {
            val total = measure.length
            var distance = 22f * density
            while (distance < total) {
                measure.getPosTan(distance, pos, tan)
                val angle = atan2(tan[1], tan[0])
                val cx = pos[0]
                val cy = pos[1]
                val backX = cx - cos(angle) * arrowSize
                val backY = cy - sin(angle) * arrowSize
                val perpAngle = angle + (Math.PI / 2f).toFloat()
                val leftX = backX - cos(perpAngle) * arrowSize * 0.55f
                val leftY = backY - sin(perpAngle) * arrowSize * 0.55f
                val rightX = backX + cos(perpAngle) * arrowSize * 0.55f
                val rightY = backY + sin(perpAngle) * arrowSize * 0.55f
                val chevron = Path().apply {
                    moveTo(leftX, leftY)
                    lineTo(cx, cy)
                    lineTo(rightX, rightY)
                }
                canvas.drawPath(chevron, routeArrowPaint)
                distance += spacing
            }
        } while (measure.nextContour())
    }

    private fun drawNavigationBase(canvas:Canvas){
        val g=snapshot.route
        if(g.size<2)return
        val idx=snapshot.currentRouteIndex.coerceIn(0,g.lastIndex)
        val center=g[idx]
        val headingRad=Math.toRadians(snapshot.heading.toDouble())
        val scale=3.7f*density
        val centerY=height*0.64f

        fun project(p:NativeGuidanceEngine.Point):Pair<Float,Float>{
            val dy=(p.lat-center.lat)*111320.0
            val dx=(p.lng-center.lng)*111320.0*cos(Math.toRadians(center.lat))
            val rx= dx*cos(headingRad)-dy*sin(headingRad)
            val ry= dx*sin(headingRad)+dy*cos(headingRad)
            return (width/2f+(rx*scale).toFloat()) to (centerY-(ry*scale).toFloat())
        }

        val start=max(0,idx-120)
        val end=min(g.lastIndex,idx+320)

        val base=Path()
        for(i in start..end){
            val (x,y)=project(g[i])
            if(i==start)base.moveTo(x,y) else base.lineTo(x,y)
        }
        canvas.drawPath(base,road)
        canvas.drawPath(base,route)

        if(idx<end){
            val ahead=Path()
            for(i in idx..end){
                val (x,y)=project(g[i])
                if(i==idx)ahead.moveTo(x,y) else ahead.lineTo(x,y)
            }
            drawRouteDirectionArrows(canvas,ahead)
        }

        if(idx>start){
            val pth=Path()
            for(i in start..idx){
                val (x,y)=project(g[i])
                if(i==start)pth.moveTo(x,y) else pth.lineTo(x,y)
            }
            canvas.drawPath(pth,past)
        }

        // 현재 도로명
        label.textSize=14f*density
        label.textAlign=Paint.Align.CENTER
        canvas.drawText(snapshot.roadName.ifBlank{"현재 도로"},width/2f,38f*density,label)
        label.textAlign=Paint.Align.LEFT
    }

    private fun drawSafetyOverlay(canvas:Canvas){
        val g=snapshot.route
        if(g.size<2)return
        val idx=snapshot.currentRouteIndex.coerceIn(0,g.lastIndex)
        val center=g[idx]
        val headingRad=Math.toRadians(snapshot.heading.toDouble())
        val scale=3.7f*density
        val centerY=height*0.64f

        fun projectIndex(routeIndex:Int):Pair<Float,Float>?{
            val i=routeIndex.coerceIn(0,g.lastIndex)
            val p=g[i]
            val dy=(p.lat-center.lat)*111320.0
            val dx=(p.lng-center.lng)*111320.0*cos(Math.toRadians(center.lat))
            val rx= dx*cos(headingRad)-dy*sin(headingRad)
            val ry= dx*sin(headingRad)+dy*cos(headingRad)
            return (width/2f+(rx*scale).toFloat()) to (centerY-(ry*scale).toFloat())
        }

        safetyEvents.filter{it.routeIndex in idx..min(g.lastIndex,idx+260)}.forEach{e->
            val p=projectIndex(e.routeIndex)?:return@forEach
            val x=p.first;val y=p.second
            if(x<-40*density||x>width+40*density||y<-40*density||y>height+40*density)return@forEach

            when(e.type){
                "section_speed_camera"->{
                    drawCameraIcon(canvas,x,y,Color.rgb(255,145,30),"구간")
                    e.endRouteIndex?.let{end->
                        projectIndex(end)?.let{q->drawCameraIcon(canvas,q.first,q.second,Color.rgb(230,96,28),"종료")}
                    }
                }
                "signal_camera","signal_speed_camera"->drawCameraIcon(canvas,x,y,Color.rgb(200,42,50),"신호")
                "bus_lane_camera"->drawCameraIcon(canvas,x,y,Color.rgb(42,112,210),"버스")
                else->drawCameraIcon(canvas,x,y,Color.rgb(200,42,50),if(e.maxSpeed>0)e.maxSpeed.toString() else "CCTV")
            }
        }
    }

    private fun drawCameraIcon(canvas:Canvas,x:Float,y:Float,color:Int,text:String){
        val p=Paint(Paint.ANTI_ALIAS_FLAG).apply{this.color=color}
        canvas.drawCircle(x,y,17f*density,p)
        val inner=Paint(Paint.ANTI_ALIAS_FLAG).apply{this.color=Color.WHITE}
        canvas.drawCircle(x,y,12f*density,inner)
        val t=Paint(Paint.ANTI_ALIAS_FLAG).apply{
            this.color=Color.BLACK;textSize=8.5f*density;textAlign=Paint.Align.CENTER;typeface=Typeface.DEFAULT_BOLD
        }
        canvas.drawText(text,x,y+3f*density,t)
    }

    private fun drawCar(canvas:Canvas){
        val cx=width/2f
        val cy=height*0.64f
        val p=Path().apply{
            moveTo(cx,cy-25*density)
            lineTo(cx-17*density,cy+17*density)
            lineTo(cx,cy+10*density)
            lineTo(cx+17*density,cy+17*density)
            close()
        }
        canvas.drawPath(p,white)
        if(snapshot.estimated){
            val halo=Paint(Paint.ANTI_ALIAS_FLAG).apply{
                color=Color.rgb(255,174,54);style=Paint.Style.STROKE;strokeWidth=3*density
            }
            canvas.drawCircle(cx,cy,31*density,halo)
        }
    }

    private fun buildJunctionPreview(s:NativeGuidanceEngine.NativeDriveSnapshot):JunctionPreview{
        val d=s.nextManeuverDistanceM?:return JunctionPreview()
        val t=s.nextManeuverType
        val isJunction=t in setOf(7,8,9,10,11,12,42,43,44,45,46,47,48,49,82,83,86)
        if(!isJunction||d>900)return JunctionPreview()
        return JunctionPreview(
            visible=true,
            title=when(t){
                9,12,44,47,49->"오른쪽 진출"
                8,11,43,46,48->"왼쪽 진출"
                else->"분기 안내"
            },
            instruction=s.nextManeuverText,
            distanceM=d,
            maneuverType=t
        )
    }

    private fun drawJunctionPreview(canvas:Canvas){
        if(!junction.visible)return
        val w=width*0.46f
        val left=width-w-12*density
        val top=55*density
        val right=width-12*density
        val bottom=172*density
        val panel=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.argb(235,25,30,40)}
        canvas.drawRoundRect(left,top,right,bottom,20*density,20*density,panel)

        label.textSize=15*density
        canvas.drawText(junction.title,left+14*density,top+28*density,label)
        label.textSize=21*density
        canvas.drawText(formatDistance(junction.distanceM),left+14*density,top+58*density,label)

        sub.textSize=11*density
        val txt=ellipsize(junction.instruction,right-left-28*density,sub)
        canvas.drawText(txt,left+14*density,top+84*density,sub)

        val arrow=Paint(Paint.ANTI_ALIAS_FLAG).apply{
            color=Color.WHITE;style=Paint.Style.STROKE;strokeWidth=5*density;strokeCap=Paint.Cap.ROUND
        }
        val cx=right-45*density;val cy=top+58*density
        val path=Path()
        when(junction.maneuverType){
            9,12,44,47,49->{
                path.moveTo(cx-18*density,cy+22*density);path.lineTo(cx-18*density,cy-5*density)
                path.lineTo(cx+15*density,cy-5*density)
                path.moveTo(cx+15*density,cy-5*density);path.lineTo(cx+3*density,cy-18*density)
                path.moveTo(cx+15*density,cy-5*density);path.lineTo(cx+3*density,cy+8*density)
            }
            else->{
                path.moveTo(cx,cy+22*density);path.lineTo(cx,cy-18*density)
            }
        }
        canvas.drawPath(path,arrow)
    }

    private fun drawLaneGuide(canvas:Canvas){
        val type=snapshot.nextManeuverType?:return
        val d=snapshot.nextManeuverDistanceM?:return
        if(d>650)return
        val y=height-88*density
        val lanePaint=Paint(Paint.ANTI_ALIAS_FLAG).apply{color=Color.argb(220,28,33,43)}
        val laneW=52*density
        val count=3
        val total=count*laneW
        val left=(width-total)/2
        for(i in 0 until count){
            val l=left+i*laneW
            canvas.drawRoundRect(l,y,l+laneW-4*density,y+44*density,10*density,10*density,lanePaint)
        }

        val preferred=when(type){
            9,12,44,47,49,2->2
            8,11,43,46,48,1->0
            else->1
        }
        val arrow=Paint(Paint.ANTI_ALIAS_FLAG).apply{
            color=Color.WHITE;style=Paint.Style.STROKE;strokeWidth=4*density;strokeCap=Paint.Cap.ROUND
        }
        val cx=left+preferred*laneW+(laneW-4*density)/2
        val path=Path().apply{
            moveTo(cx,y+34*density);lineTo(cx,y+10*density)
            moveTo(cx,y+10*density);lineTo(cx-8*density,y+18*density)
            moveTo(cx,y+10*density);lineTo(cx+8*density,y+18*density)
        }
        canvas.drawPath(path,arrow)
    }

    private fun formatDistance(v:Double):String=
        if(v<1000)"${v.roundToInt()}m" else String.format("%.1fkm",v/1000.0)

    private fun ellipsize(text:String,maxWidth:Float,paint:Paint):String{
        if(paint.measureText(text)<=maxWidth)return text
        var s=text
        while(s.length>2&&paint.measureText("$s…")>maxWidth)s=s.dropLast(1)
        return "$s…"
    }
}
