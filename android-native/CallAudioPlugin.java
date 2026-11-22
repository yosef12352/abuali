package com.abualichat.audio;

import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name="CallAudio")
public class CallAudioPlugin extends Plugin {
  private AudioManager audio;
  private PowerManager.WakeLock proximityLock;
  private boolean active = false;

  @Override public void load() {
    audio=(AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
  }

  @PluginMethod public void startCall(PluginCall call) {
    if(active){call.reject("المكالمة مفعّلة مسبقاً");return;}
    try {
      if(audio==null)throw new IllegalStateException("AudioManager unavailable");
      audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
      route(false);
      active=true;
      updateProximity(true);
      JSObject result=new JSObject();result.put("earpiece",true);call.resolve(result);
    } catch(Exception e){
      resetAudio();
      call.reject("تعذّر تفعيل سماعة المكالمات",e);
    }
  }

  @PluginMethod public void setSpeaker(PluginCall call) {
    if(!active){call.reject("ما في مكالمة نشطة");return;}
    boolean speaker=call.getBoolean("enabled",false);
    try {
      route(speaker);
      updateProximity(!speaker);
      JSObject result=new JSObject();result.put("speaker",speaker);call.resolve(result);
    } catch(Exception e){call.reject("تعذّر تغيير مخرج الصوت",e);}
  }

  @PluginMethod public void endCall(PluginCall call) {
    resetAudio();
    call.resolve();
  }

  private void resetAudio() {
    updateProximity(false);
    if(audio!=null){
      try {
        if(Build.VERSION.SDK_INT>=31)audio.clearCommunicationDevice();
        else audio.setSpeakerphoneOn(false);
      }catch(Exception ignored){}
      try{audio.setMode(AudioManager.MODE_NORMAL);}catch(Exception ignored){}
    }
    active=false;
  }

  private void route(boolean speaker) {
    if(Build.VERSION.SDK_INT>=31){
      int type=speaker?AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
      for(AudioDeviceInfo d:audio.getAvailableCommunicationDevices()){
        if(d.getType()==type){
          if(!audio.setCommunicationDevice(d))throw new IllegalStateException("audio route unavailable");
          return;
        }
      }
      throw new IllegalStateException("requested audio route unavailable");
    }
    audio.setSpeakerphoneOn(speaker);
  }

  private void updateProximity(boolean enable){
    if(!enable){
      if(proximityLock!=null&&proximityLock.isHeld()){
        try{proximityLock.release();}catch(Exception ignored){}
      }
      return;
    }
    PowerManager pm=(PowerManager)getContext().getSystemService(android.content.Context.POWER_SERVICE);
    int flag=32; // PROXIMITY_SCREEN_OFF_WAKE_LOCK; availability varies by device.
    if(pm==null||!pm.isWakeLockLevelSupported(flag))return;
    if(proximityLock==null)proximityLock=pm.newWakeLock(flag,"AbuAliChat:ProximityCall");
    if(!proximityLock.isHeld())proximityLock.acquire();
  }

  @Override protected void handleOnDestroy(){
    resetAudio();
    super.handleOnDestroy();
  }
}
