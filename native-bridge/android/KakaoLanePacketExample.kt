/* Reference mapping for Kakao Mobility KNLane -> Web packet.
   Put this code in the Android app module that already has the Kakao Navi SDK dependency. */

/*
fun KNLane.toWebPacket(): JSONObject = JSONObject().apply {
    put("source", "kakao-native")
    put("lanes", JSONArray().apply {
        laneInfos?.forEachIndexed { index, lane -> put(JSONObject().apply {
            put("index", index)
            put("turnType", lane.turnType.toInt())
            put("highlightType", lane.highlightType.toInt())
            put("pocketType", lane.pocketType.toInt())
            put("busType", lane.busType.toInt())
            put("facilityType", lane.facilityType.toInt())
            put("suggest", lane.suggest.toInt())
            put("colorType", lane.colorType.toInt())
        }) }
    })
}
// In your route-guide delegate: bridge.emitLane(guide.lane?.toWebPacket() ?: JSONObject())
*/
