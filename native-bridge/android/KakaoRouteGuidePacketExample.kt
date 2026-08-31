/*
 * Kakao Navi SDK -> Jofams SmartDrive v4 packet mapping reference.
 *
 * This file is intentionally a reference snippet because actual SDK class names and
 * callback signatures must follow the Kakao Navi SDK version installed in your host app.
 * Keep the generic JofamsWebBridge.kt buildable without a Kakao SDK dependency.
 *
 * Typical guide callback mapping:
 *
 * val routeGuide = ... // KNGuide_Route
 * routeGuide.lane?.let { bridge.emitLane(it.toWebLanePacket()) }
 * routeGuide.imgDirection?.let { bridge.emitImageDirection(it.toWebImagePacket()) }
 * routeGuide.roadEvents?.let { bridge.emitRoadEvents(it.toWebRoadEventsPacket()) }
 * routeGuide.multiRouteInfo?.let { bridge.emitAlternativeRoute(it.toWebAlternativePacket()) }
 *
 * Safety callbacks can be reduced to the web packet below:
 * {
 *   "source":"kakao-native",
 *   "speedLimit":80,
 *   "message":"과속 단속 구간입니다.",
 *   "urgent":false
 * }
 *
 * Image-direction packet:
 * {
 *   "source":"kakao-native",
 *   "distance":250,
 *   "imageDataUrl":"data:image/png;base64,..."
 * }
 *
 * Road-event packet:
 * {
 *   "events":[{"code":0,"type":2,"title":"전방 사고","distance":1200}]
 * }
 * code: 0 accident, 1 construction, 2 event, 3 closure
 * type: 0 none, 1 full closure, 2 partial restriction
 *
 * Multi-route packet:
 * {
 *   "source":"kakao-native",
 *   "distGap":-1300,
 *   "timeGap":-240,
 *   "costGap":0,
 *   "routeId":"sdk-candidate-id"
 * }
 * A web 'acceptAlternative' command should be mapped to the SDK's route-change API
 * appropriate to the installed Kakao Navi SDK version.
 *
 * Tunnel/map-matched packet:
 * {
 *   "lng":127.0,"lat":36.0,"speedMps":18.3,"heading":95,"accuracy":5,"tunnel":true
 * }
 */
