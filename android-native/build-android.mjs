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
const manifestPath=join(dir,'android/app/src/main/AndroidManifest.xml');let xml=readFileSync(manifestPath,'utf8');
for(const p of ['android.permission.INTERNET','android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.WAKE_LOCK','android.permission.POST_NOTIFICATIONS'])if(!xml.includes(p))xml=xml.replace('<application',`<uses-permission android:name="${p}" />\n    <application`);
writeFileSync(manifestPath,xml);
// The app is generated locally; debug APKs are for internal testing, not release signing.
