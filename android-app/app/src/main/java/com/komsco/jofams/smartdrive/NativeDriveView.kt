package com.komsco.jofams.smartdrive

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 8.4.0 Pure Native 주행 화면.
 * NativeNavigationMapView + Android View HUD 조합.
 */
class NativeDriveView(context: Context) : FrameLayout(context) {

    var onStopNavigation: (() -> Unit)? = null

    private val density=resources.displayMetrics.density
    private val mapView=NativeNavigationMapView(context)

    private val maneuverDistance=label(30,true)
    private val maneuverText=label(18,true)
    private val roadName=label(12,false)
    private val speedLimit=label(30,true)
    private val speedNow=label(34,true)
    private val safetyText=label(15,true)
    private val safetyDistance=label(24,true)
    private val remain=label(21,true)
    private val remainTime=label(17,true)
    private val eta=label(13,false)
    private val section=label(14,true)
    private val gnss=label(11,false)
    private val status=label(14,true)
    private val trafficLight=TrafficLightBadge(context)

    /**
     * 티맵처럼 제한속도 표지 위에 신호등 아이콘을 표시하는 작은 배지 뷰.
     * 신호(교차로) 관련 단속·신호가 전방에 있을 때만 빨간불을 켠 상태로 보여준다.
     */
    private class TrafficLightBadge(context: Context) : View(context) {
        var signalAhead: Boolean = false
            set(value) { field = value; invalidate() }
        private val density = resources.displayMetrics.density
        private val box = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(30, 33, 40) }
        private val off = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(70, 74, 82) }
        private val red = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(235, 64, 60) }
        private val yellow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(70, 74, 82) }
        private val green = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(70, 74, 82) }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val w = width.toFloat(); val h = height.toFloat()
            canvas.drawRoundRect(0f, 0f, w, h, 6f * density, 6f * density, box)
            val r = min(w, h) * 0.16f
            val cx = w / 2f
            canvas.drawCircle(cx, h * 0.28f, r, if (signalAhead) red else off)
            canvas.drawCircle(cx, h * 0.52f, r, yellow)
            canvas.drawCircle(cx, h * 0.76f, r, green)
        }

        private fun min(a: Float, b: Float) = if (a < b) a else b
    }

    init{
        setBackgroundColor(Color.rgb(15,18,24))
        addView(mapView,LayoutParams(LayoutParams.MATCH_PARENT,LayoutParams.MATCH_PARENT))
        addHud()
    }

    fun update(s:NativeGuidanceEngine.NativeDriveSnapshot){
        mapView.updateSnapshot(s)
        maneuverDistance.text=formatDistance(s.nextManeuverDistanceM)
        maneuverText.text=s.nextManeuverText.ifBlank{"경로를 따라 이동하세요"}
        roadName.text=s.roadName.ifBlank{"현재 도로"}
        speedLimit.text=if(s.speedLimitKmh>0)s.speedLimitKmh.toString() else "--"
        speedNow.text=s.speedKmh.toString()
        safetyText.text=s.safetyText
        safetyDistance.text=if(s.safetyDistanceM!=null)formatDistance(s.safetyDistanceM) else ""
        remain.text=formatDistance(s.remainingDistanceM)
        remainTime.text="${max(1,(s.remainingSeconds/60.0).roundToInt())}분"
        eta.text="도착 ${s.etaText}"
        section.text=if(s.sectionAverageKmh!=null)"구간평균 ${s.sectionAverageKmh}km/h · 제한 ${s.sectionLimitKmh ?: 0}" else ""
        gnss.text=if(s.estimated)"GPS 추정주행" else "GPS ${s.gpsAccuracyM.roundToInt()}m · 위성 ${s.satellitesUsed}/${s.satelliteCount}"

        // 티맵처럼 제한속도 위 신호등: 전방 500m 이내에 신호(교차로) 관련 단속/신호가 있으면 빨간불 표시.
        val signalTypeAhead = s.safetyType?.let { it == "signal_camera" || it == "signal_speed_camera" } ?: false
        val signalWithinRange = s.safetyDistanceM?.let { it in 0.0..500.0 } ?: false
        trafficLight.signalAhead = signalTypeAhead && signalWithinRange
    }

    fun setSafetyEvents(events:List<NativeGuidanceEngine.SafetyEvent>){
        mapView.setSafetyEvents(events)
    }

    fun setStatusMessage(message:String?){
        status.text=message.orEmpty()
        status.visibility=if(message.isNullOrBlank())View.GONE else View.VISIBLE
    }

    private fun addHud(){
        val top=LinearLayout(context).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(18),dp(14),dp(18),dp(12))
            setBackgroundColor(Color.argb(225,25,30,40))
            addView(maneuverDistance)
            addView(maneuverText)
            addView(roadName)
        }
        addView(top,LayoutParams(LayoutParams.MATCH_PARENT,dp(136),Gravity.TOP))

        status.setBackgroundColor(Color.rgb(39,104,220))
        status.gravity=Gravity.CENTER
        status.visibility=View.GONE
        addView(status,LayoutParams(LayoutParams.MATCH_PARENT,dp(40),Gravity.TOP).apply{
            topMargin=dp(138);leftMargin=dp(28);rightMargin=dp(28)
        })

        val speedBox=LinearLayout(context).apply{
            orientation=LinearLayout.VERTICAL
            gravity=Gravity.CENTER
            setPadding(dp(8),dp(6),dp(8),dp(6))
            setBackgroundColor(Color.argb(220,25,30,40))
            addView(speedLimit)
            addView(speedNow)
        }
        addView(speedBox,LayoutParams(dp(96),dp(118),Gravity.BOTTOM or Gravity.START).apply{
            leftMargin=dp(12);bottomMargin=dp(98)
        })

        addView(trafficLight,LayoutParams(dp(28),dp(64),Gravity.BOTTOM or Gravity.START).apply{
            leftMargin=dp(46);bottomMargin=dp(218)
        })

        val safetyBox=LinearLayout(context).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(12),dp(8),dp(12),dp(8))
            setBackgroundColor(Color.argb(225,160,43,48))
            addView(safetyText);addView(safetyDistance)
        }
        addView(safetyBox,LayoutParams(dp(170),dp(82),Gravity.BOTTOM or Gravity.END).apply{
            rightMargin=dp(12);bottomMargin=dp(112)
        })

        val bottom=LinearLayout(context).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(18),dp(8),dp(18),dp(8))
            setBackgroundColor(Color.argb(235,25,30,40))
            addView(remain);addView(remainTime);addView(eta);addView(section);addView(gnss)
        }
        addView(bottom,LayoutParams(LayoutParams.MATCH_PARENT,dp(94),Gravity.BOTTOM))

        val stop=TextView(context).apply{
            text="안내종료"
            gravity=Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize=15f
            typeface=Typeface.DEFAULT_BOLD
            setBackgroundColor(Color.rgb(164,38,45))
            setOnClickListener{onStopNavigation?.invoke()}
        }
        addView(stop,LayoutParams(dp(94),dp(44),Gravity.BOTTOM or Gravity.END).apply{
            rightMargin=dp(14);bottomMargin=dp(18)
        })
    }

    private fun label(size:Int,bold:Boolean)=TextView(context).apply{
        setTextColor(Color.WHITE)
        textSize=size.toFloat()
        typeface=if(bold)Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        maxLines=1
    }

    private fun formatDistance(v:Double?):String{
        if(v==null||!v.isFinite())return "--"
        return if(v<1000)"${v.roundToInt()}m" else String.format("%.1fkm",v/1000.0)
    }
    private fun dp(v:Int)= (v*density).roundToInt()
}
