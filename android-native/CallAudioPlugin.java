package com.abualichat.audio;

import android.content.Context;
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
    audio=(AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE);
  }

  @PluginMethod public void startCall(PluginCall call) {
    try {
      audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
      active=true;
      route(false);
      updateProximity(true);
      JSObject result=new JSObject();result.put("earpiece",true);call.resolve(result);
    } catch(Exception e){call.reject("تعذّر تفعيل سماعة المكالمات",e);}
  }

  @PluginMethod public void setSpeaker(PluginCall call) {
    if(!active){call.reject("ما في مكالمة نشطة");return;}
    boolean speaker=call.getBoolean("enabled",false);
    try {route(speaker);updateProximity(!speaker);JSObject result=new JSObject();result.put("speaker",speaker);call.resolve(result);}
    catch(Exception e){call.reject("تعذّر تغيير مخرج الصوت",e);}
  }

  @PluginMethod public void endCall(PluginCall call) {
    updateProximity(false);
    if(Build.VERSION.SDK_INT>=31)audio.clearCommunicationDevice();
    else audio.setSpeakerphoneOn(false);
    audio.setMode(AudioManager.MODE_NORMAL);
    active=false;
    call.resolve();
  }

  private void route(boolean speaker) {
    if(Build.VERSION.SDK_INT>=31){
      int type=speaker?AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
      for(AudioDeviceInfo d:audio.getAvailableCommunicationDevices()){
        if(d.getType()==type){if(!audio.setCommunicationDevice(d))throw new IllegalStateException("audio route unavailable");return;}
      }
      throw new IllegalStateException("requested audio route unavailable");
    }
    audio.setSpeakerphoneOn(speaker);
  }

  private void updateProximity(boolean enable){
    if(!enable){if(proximityLock!=null&&proximityLock.isHeld())proximityLock.release();return;}
    PowerManager pm=(PowerManager)getContext().getSystemService(Context.POWER_SERVICE);
    int flag=32; // PROXIMITY_SCREEN_OFF_WAKE_LOCK, device-dependent
    if(!pm.isWakeLockLevelSupported(flag))return;
    if(proximityLock==null)proximityLock=pm.newWakeLock(flag,"AbuAliChat:ProximityCall");
    if(!proximityLock.isHeld())proximityLock.acquire();
  }
  @Override protected void handleOnDestroy(){updateProximity(false);if(audio!=null){if(Build.VERSION.SDK_INT>=31)audio.clearCommunicationDevice();audio.setMode(AudioManager.MODE_NORMAL);}super.handleOnDestroy();}
}
