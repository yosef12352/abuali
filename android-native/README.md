# Native Android call audio — integration pending

This Capacitor plugin is source code for a future Android build, **not active in the hosted PWA**.

Requirements: Capacitor Android project, register `CallAudioPlugin.class` in `MainActivity` with `registerPlugin(CallAudioPlugin.class)` before `super.onCreate`, and declare `<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />` and `<uses-permission android:name="android.permission.WAKE_LOCK" />` in AndroidManifest.xml. Android's `setCommunicationDevice` is used on API 31+; legacy speakerphone routing below 31. Proximity screen-off wakelock is hardware-dependent.

Use `Capacitor.Plugins.CallAudio.startCall()` after WebRTC media starts; `setSpeaker({enabled:true|false})` on the speaker button; `endCall()` on hangup, cancellation and navigation. Verify Android audio focus, Bluetooth/headsets, device proximity and lifecycle on real hardware before release. Never claim that browser PWA supports native proximity control.
