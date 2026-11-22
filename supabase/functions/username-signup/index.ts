import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{autoRefreshToken:false,persistSession:false}});
const allowedOrigins=new Set(['https://abu-ali-chat-web.vercel.app','https://abu-ali-chat-preview.vercel.app','https://abu-ali-chat-preview-yosefalsaad1998-8542.vercel.app']);
const headersFor=(origin:string|null)=>({'Access-Control-Allow-Origin':origin&&allowedOrigins.has(origin)?origin:'https://abu-ali-chat-web.vercel.app','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'});
const respond=(status:number,message:string,origin:string|null)=>new Response(JSON.stringify({message}),{status,headers:headersFor(origin)});
const emailFor=async (name:string)=>{const bytes=new TextEncoder().encode(name.toLocaleLowerCase('en-US'));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+'@accounts.abu-ali.invalid'};
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!allowedOrigins.has(origin))return respond(403,'المصدر غير مسموح',origin);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headersFor(origin)});
 if(req.method!=='POST')return respond(405,'الطلب غير مدعوم',origin);
 let body;try{body=await req.json()}catch{return respond(400,'طلب غير صالح',origin)}
 const username=String(body.username||'').trim(),password=String(body.password||'');
 if(!username||username.length>64||/[\u0000-\u001f\u007f]/u.test(username))return respond(400,'اسم المستخدم لازم يكون من 1 إلى 64 حرفاً بدون رموز تحكم',origin);
 if(password.length<6||password.length>128)return respond(400,'كلمة السر لازم تكون من 6 إلى 128 حرفاً',origin);
 const email=await emailFor(username);
 const {error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{username},user_metadata:{display_name:username}});
 if(error){if(/already|registered|exists|duplicate/i.test(error.message))return respond(409,'اسم المستخدم مستخدم، جرّب اسم ثاني',origin);return respond(400,'تعذّر إنشاء الحساب. حاول مرة ثانية لاحقاً',origin)}
 return respond(201,'تم إنشاء الحساب',origin);
});