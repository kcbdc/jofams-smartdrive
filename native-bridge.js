/* Jofams SmartDrive v4 native bridge adapter.
   Android/iOS hosts can inject Kakao Navi SDK lane, safety, image-direction,
   road-event, alternative-route, map-matched location and AR packets.
   Pure web browsers keep using the web fallbacks. */
export const NativeBridge = {
  isAndroid(){ return Boolean(window.JofamsNavigationBridge); },
  isIOS(){ return Boolean(window.webkit?.messageHandlers?.jofamsNavigation); },
  available(){ return this.isAndroid() || this.isIOS(); },
  hasNativeAR(){
    try{
      if(window.__JOFAMS_NATIVE_CAPABILITIES__?.ar===true)return true;
      if(this.isAndroid()&&typeof window.JofamsNavigationBridge.hasAR==='function')return Boolean(window.JofamsNavigationBridge.hasAR());
    }catch{}
    return false;
  },
  post(type,payload={}){
    const msg={type,payload,ts:Date.now()};
    try{
      if(this.isAndroid()) window.JofamsNavigationBridge.postMessage(JSON.stringify(msg));
      else if(this.isIOS()) window.webkit.messageHandlers.jofamsNavigation.postMessage(msg);
    }catch(e){ console.warn('native bridge post failed',e); }
  },
  startAR(payload){ this.post('startAR',payload); },
  stopAR(){ this.post('stopAR',{}); },
  requestLane(){ this.post('requestLane',{}); },
  requestSafety(){ this.post('requestSafety',{}); },
  requestImageDirection(){ this.post('requestImageDirection',{}); },
  requestRoadEvents(){ this.post('requestRoadEvents',{}); },
  requestAlternatives(){ this.post('requestAlternatives',{}); },
  acceptAlternative(payload={}){ this.post('acceptAlternative',payload); },
  setNavigationState(payload){ this.post('navigationState',payload); }
};

function emit(name,eventName,packet){
  try{const detail=typeof packet==='string'?JSON.parse(packet):packet;window.dispatchEvent(new CustomEvent(eventName,{detail}))}catch(e){console.warn(name,'packet parse failed',e)}
}
window.JofamsNative = window.JofamsNative || {};
window.JofamsNative.onLaneUpdate = packet => emit('lane','jofams:lane',packet);
window.JofamsNative.onSafetyUpdate = packet => emit('safety','jofams:safety',packet);
window.JofamsNative.onImageDirection = packet => emit('imageDirection','jofams:imageDirection',packet);
window.JofamsNative.onRoadEvents = packet => emit('roadEvents','jofams:roadEvents',packet);
window.JofamsNative.onAlternativeRoute = packet => emit('alternativeRoute','jofams:alternativeRoute',packet);
window.JofamsNative.onLocationUpdate = packet => emit('location','jofams:location',packet);
window.JofamsNative.onTunnelState = packet => emit('tunnel','jofams:tunnel',packet);
window.JofamsNative.onARStatus = packet => emit('arstatus','jofams:arstatus',packet);
