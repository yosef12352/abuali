import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const dir=resolve(import.meta.dirname);const web=join(dir,'www');
mkdirSync(web,{recursive:true});for(const f of ['index.html','account.html','friends.html','profile.html','group-call.html','manifest.webmanifest','sw.js','icon.svg'])copyFileSync(join(root,'development',f),join(web,f));
const run=(...args)=>execFileSync('npx',args,{cwd:dir,stdio:'inherit'});
if(!existsSync(join(dir,'android')))run('cap','add','android');else run('cap','sync','android');
const packageDir=join(dir,'android/app/src/main/java/com/abualichat/app');mkdirSync(packageDir,{recursive:true});
writeFileSync(join(packageDir,'MainActivity.java'),`package com.abualichat.app;\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\nimport com.abualichat.audio.CallAudioPlugin;\npublic class MainActivity extends BridgeActivity {\n @Override public void onCreate(Bundle savedInstanceState){registerPlugin(CallAudioPlugin.class);super.onCreate(savedInstanceState);}\n}\n`);
// Keep the native plugin under the package declared in its source.
const nativeDir=join(dir,'android/app/src/main/java/com/abualichat/audio');mkdirSync(nativeDir,{recursive:true});copyFileSync(join(dir,'CallAudioPlugin.java'),join(nativeDir,'CallAudioPlugin.java'));
// Use the existing original project logo as the installed Android launcher icon.
const iconSvg=readFileSync(join(root,'development','icon.svg'),'utf8');
const logoMatch=iconSvg.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/);
if(!logoMatch)throw new Error('Original logo JPEG not found in development/icon.svg');
const drawableDir=join(dir,'android/app/src/main/res/drawable-nodpi');
mkdirSync(drawableDir,{recursive:true});
writeFileSync(join(drawableDir,'abuali_original_logo.jpg'),Buffer.from(logoMatch[1],'base64'));
// Adaptive launcher icons for Android 8+, with the original artwork preserved.
const adaptiveDir=join(dir,'android/app/src/main/res/mipmap-anydpi-v26');mkdirSync(adaptiveDir,{recursive:true});
const iconXml=`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
<background android:drawable="@android:color/black"/>
<foreground android:drawable="@drawable/abuali_original_logo"/>
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir,'ic_launcher.xml'),iconXml);
writeFileSync(join(adaptiveDir,'ic_launcher_round.xml'),iconXml);
const manifestPath=join(dir,'android/app/src/main/AndroidManifest.xml');let xml=readFileSync(manifestPath,'utf8');
for(const p of ['android.permission.INTERNET','android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.WAKE_LOCK','android.permission.POST_NOTIFICATIONS'])if(!xml.includes(p))xml=xml.replace('<application',`<uses-permission android:name="${p}" />
    <application`);
xml=xml.replace(/(<application\b)([^>]*?)(>)/,(_match,open,attrs,close)=>{
  const cleaned=attrs.replace(/\sandroid:icon=\"[^\"]*\"/g,'').replace(/\sandroid:roundIcon=\"[^\"]*\"/g,'');
  return open+cleaned+' android:icon=\"@mipmap/ic_launcher\" android:roundIcon=\"@mipmap/ic_launcher_round\"'+close;
});
writeFileSync(manifestPath,xml);
// Firebase is optional for local debug builds, but required for native FCM delivery.
// Provide google-services.json via CI secret or ANDROID_GOOGLE_SERVICES_JSON_BASE64.
const firebaseBase64=process.env.ANDROID_GOOGLE_SERVICES_JSON_BASE64;
const firebasePath=join(dir,'android/app/google-services.json');
if(firebaseBase64){
 const raw=Buffer.from(firebaseBase64,'base64').toString('utf8');
 const config=JSON.parse(raw);
 const matches=(config.client||[]).some(c=>c.client_info?.android_client_info?.package_name==='com.abualichat.app');
 if(!matches)throw new Error('Firebase Android config does not match com.abualichat.app');
 writeFileSync(firebasePath,raw);
}
if(existsSync(firebasePath)){
 const projectGradle=join(dir,'android/build.gradle');
 let projectSource=readFileSync(projectGradle,'utf8');
 if(!projectSource.includes('com.google.gms:google-services:')){
  projectSource=projectSource.replace(/(classpath\s+['"]com\.android\.tools\.build:gradle:[^'"]+['"])/,"$1\\n        classpath 'com.google.gms:google-services:4.4.2'");
  if(!projectSource.includes('com.google.gms:google-services:'))throw new Error('Unable to configure Firebase Gradle plugin');
  writeFileSync(projectGradle,projectSource);
 }
 const gradle=join(dir,'android/app/build.gradle');
 let source=readFileSync(gradle,'utf8');
 if(!source.includes("com.google.gms.google-services")){
  source+='\\napply plugin: \'com.google.gms.google-services\'\\n';
  writeFileSync(gradle,source);
 }
 console.log('Firebase Google Services configured for Android build');
}else console.log('Firebase config not provided: building APK without native FCM delivery');
// The app is generated locally; debug APKs are for internal testing, not release signing.
