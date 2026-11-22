import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const projectUrl=Deno.env.get("SUPABASE_URL")||"https://xgoggkcwmagghkdzvjqz.supabase.co";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const allowed=new Set(["https://abu-ali-chat-preview.vercel.app","https://abu-ali-chat-web.vercel.app"]);
const cors=(origin:string|null)=>({"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",...(origin&&allowed.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,OPTIONS"});
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");const headers=cors(origin);
 if(origin&&!allowed.has(origin))return new Response(JSON.stringify({error:"Origin not allowed"}),{status:403,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="GET")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
 const jwt=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!jwt||!anonKey)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers});
 const client=createClient(projectUrl,anonKey,{global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(jwt);
 if(error||!user)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers});
 // Prefer a private coturn instance when configured. Otherwise use Metered's
 // publicly documented Open Relay static-auth endpoint for free-tier testing.
 // Its shared secret is public by design, not an application secret.
 const privateUrl=Deno.env.get("CHAT_TURN_URL");const privateSecret=Deno.env.get("CHAT_TURN_SHARED_SECRET");
 const usePrivate=!!(privateUrl&&privateSecret&&/^turns?:/.test(privateUrl));
 const turnUrl=usePrivate?privateUrl!:"turn:staticauth.openrelay.metered.ca:80";
 const secret=usePrivate?privateSecret!:"openrelayprojectsecret";
 const expires=Math.floor(Date.now()/1000)+3600;const username=expires+":"+user.id;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(username)));
 const credential=btoa(String.fromCharCode(...bytes));
 const urls=usePrivate?[turnUrl]:["turn:staticauth.openrelay.metered.ca:80?transport=udp","turn:staticauth.openrelay.metered.ca:80?transport=tcp","turn:staticauth.openrelay.metered.ca:443?transport=tcp"];
 return new Response(JSON.stringify({iceServers:[{urls,username,credential}],ttl:3600,provider:usePrivate?"private-coturn":"metered-open-relay"}),{status:200,headers});
});