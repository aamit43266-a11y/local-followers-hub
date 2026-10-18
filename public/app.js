/* Public anon/publishable key only. Never put Supabase service_role/secret keys here. */
const CONFIG = {
  supabaseUrl: "https://ymfcuirmarxwqvtttnil.supabase.co/rest/v1/"
  supabaseAnonKey: "sb_publishable_CfojSzpWhElrDZK1rAt5rg_bq7IXmRf"
};
const DISTRICTS = ["Deoria","Gorakhpur","Kushinagar","Mau","Ballia","Other"];
const DISTRICT_HI = {Deoria:"देवरिया",Gorakhpur:"गोरखपुर",Kushinagar:"कुशीनगर",Mau:"मऊ",Ballia:"बलिया",Other:"अन्य"};
const $ = (id) => document.getElementById(id);
let db = null;
let currentUser = null;

function status(id, message, kind="") {
  const el = $(id); el.textContent = message; el.className = `status ${kind}`;
}
function setOptions(select, includeAll=false) {
  if (includeAll) select.innerHTML = '<option value="">सभी जिले / All districts</option>';
  else select.innerHTML = '<option value="">जिला चुनें / Select district</option>';
  for (const district of DISTRICTS) {
    const option = document.createElement("option");
    option.value = district; option.textContent = `${DISTRICT_HI[district]} / ${district}`;
    select.appendChild(option);
  }
}
function normalizeUsername(value) { return value.trim().replace(/^@/, ""); }
function safeInstagramUrl(username) { return `https://www.instagram.com/${encodeURIComponent(username)}/`; }
function validUsername(username) { return /^[A-Za-z0-9._]{1,30}$/.test(username); }
function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function profileCard(p) {
  const card = make("article","profile-card");
  const head = make("div","card-head");
  head.append(make("div","avatar", (p.display_name || "?").trim().slice(0,1).toUpperCase()));
  const identity = make("div","");
  identity.append(make("div","card-title",p.display_name),make("div","handle","@"+p.username));
  head.append(identity); card.append(head);
  const meta = make("div","card-meta");
  meta.append(make("span","tag",`${p.area}, ${DISTRICT_HI[p.district] || p.district}`),make("span","tag",p.category));
  card.append(meta);
  const link = make("a","button","Instagram पर देखें / Visit profile");
  link.href = safeInstagramUrl(p.username); link.target = "_blank"; link.rel = "noopener noreferrer";
  card.append(link); return card;
}
async function loadProfiles() {
  const wrap = $("profiles"); wrap.replaceChildren(make("div","empty","Profiles लोड हो रही हैं…"));
  if (!db) { wrap.replaceChildren(make("div","empty","Website configure नहीं हुई है। Admin को Supabase URL और publishable key सेट करनी होगी।")); $("profile-count").textContent="0 profiles"; return; }
  let query = db.from("profiles").select("id,display_name,username,district,area,category,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(200);
  const district = $("district").value, category = $("category").value, search = $("search").value.trim().toLowerCase();
  if (district) query = query.eq("district",district);
  if (category) query = query.eq("category",category);
  const {data,error} = await query;
  if (error) { wrap.replaceChildren(make("div","empty","Profiles लोड नहीं हुईं। Supabase schema और RLS जाँचें।")); $("profile-count").textContent="—"; return; }
  const filtered = (data||[]).filter(p => !search || `${p.display_name} ${p.username} ${p.area} ${p.district}`.toLowerCase().includes(search));
  $("profile-count").textContent = `${filtered.length} profiles`;
  wrap.replaceChildren();
  if (!filtered.length) { wrap.append(make("div","empty","अभी कोई approved profile नहीं है। Be the first to submit a profile!")); return; }
  for (const p of filtered) wrap.append(profileCard(p));
}
async function submitProfile(event) {
  event.preventDefault();
  if (!db) return status("submit-message","Website अभी configure नहीं है।","error");
  const form = new FormData(event.currentTarget);
  const username = normalizeUsername(String(form.get("username")||""));
  if (!validUsername(username)) return status("submit-message","Instagram username सही भरें।","error");
  const payload = {
    display_name: String(form.get("display_name")||"").trim(),
    username, district: String(form.get("district")||""),
    area: String(form.get("area")||"").trim(), category: String(form.get("category")||""),
    status: "pending"
  };
  const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled=true;
  const {error} = await db.from("profiles").insert(payload);
  button.disabled=false;
  if (error) {
    const message = error.code==="23505" ? "यह Instagram username पहले से submit किया गया है।" : "सबमिशन नहीं हो सका। कुछ देर बाद फिर प्रयास करें।";
    return status("submit-message",message,"error");
  }
  event.currentTarget.reset(); $("form-district").value="Deoria"; event.currentTarget.elements.area.value="Barhaj";
  status("submit-message","धन्यवाद! आपका profile review के लिए भेज दिया गया है। मंजूरी के बाद public होगा।","success");
}
async function sendMagicLink(event) {
  event.preventDefault();
  if (!db) return status("auth-message","पहले Supabase configuration भरें।","error");
  const email = $("admin-email").value.trim().toLowerCase();
  const {error} = await db.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/#admin" }
  });
  if (error) return status("auth-message","Login link नहीं भेजा जा सका। Admin account, email settings और redirect URL जाँचें।","error");
  status("auth-message","यदि यह मौजूदा admin account है, तो उसके email पर login link भेज दिया गया है।","success");
}
function adminCard(p, isPending) {
  const card = make("article","pending-card");
  card.append(make("strong", "", `${p.display_name} (@${p.username})`));
  card.append(make("p","",`${p.area}, ${DISTRICT_HI[p.district] || p.district} · ${p.category} · ${p.status}`));
  const link = make("a","","Instagram profile खोलें ↗"); link.href=safeInstagramUrl(p.username); link.target="_blank"; link.rel="noopener noreferrer"; card.append(link);
  const actions = make("div","actions");
  if (isPending) {
    const approve = make("button","button","Approve"); approve.type="button"; approve.addEventListener("click",()=>moderate(p.id,"approved"));
    const reject = make("button","button danger","Reject"); reject.type="button"; reject.addEventListener("click",()=>moderate(p.id,"rejected"));
    actions.append(approve,reject);
  } else {
    const remove = make("button","button danger","Remove listing"); remove.type="button"; remove.addEventListener("click",()=>moderate(p.id,"rejected"));
    actions.append(remove);
  }
  card.append(actions); return card;
}
async function moderate(id,newStatus) {
  const {error} = await db.from("profiles").update({status:newStatus}).eq("id",id);
  if (error) { status("auth-message","यह action नहीं हो सका। Admin permissions/RLS जाँचें।","error"); return; }
  status("auth-message",newStatus==="approved"?"Profile approved और public कर दी गई।":"Profile rejected/removed.","success");
  await loadAdminLists(); await loadProfiles();
}
async function loadAdminLists() {
  if (!db || !currentUser) return;
  const {data:pending,error:e1} = await db.from("profiles").select("id,display_name,username,district,area,category,status").eq("status","pending").order("created_at",{ascending:true}).limit(100);
  const {data:published,error:e2} = await db.from("profiles").select("id,display_name,username,district,area,category,status").eq("status","approved").order("created_at",{ascending:false}).limit(100);
  if (e1 || e2) { status("auth-message","Admin data नहीं पढ़ा जा सका। आपका account admin allowlist में है या नहीं, जाँचें।","error"); return; }
  $("pending-list").replaceChildren(); $("published-list").replaceChildren();
  if (!pending.length) $("pending-list").append(make("div","empty","कोई pending submission नहीं है।"));
  else pending.forEach(p=>$("pending-list").append(adminCard(p,true)));
  if (!published.length) $("published-list").append(make("div","empty","अभी कोई published profile नहीं है।"));
  else published.forEach(p=>$("published-list").append(adminCard(p,false)));
}
async function refreshAuth(session) {
  currentUser = session?.user || null;
  const tools = $("admin-tools");
  if (!currentUser) {
    tools.hidden = true; status("auth-message","Admin panel देखने के लिए admin email से login करें।");
    return;
  }
  const {data:allowed,error} = await db.from("app_admins").select("user_id").eq("user_id",currentUser.id).maybeSingle();
  if (error || !allowed) {
    await db.auth.signOut(); currentUser=null; tools.hidden=true;
    status("auth-message","यह account admin नहीं है। Access denied.","error"); return;
  }
  tools.hidden=false; $("admin-who").textContent=`Signed in: ${currentUser.email}`;
  status("auth-message","Admin login सफल।","success");
  await loadAdminLists();
}
async function boot() {
  setOptions($("district"),true); setOptions($("form-district"),false); $("form-district").value="Deoria";
  $("search").addEventListener("input",loadProfiles);
  $("district").addEventListener("change",loadProfiles);
  $("category").addEventListener("change",loadProfiles);
  $("profile-form").addEventListener("submit",submitProfile);
  $("login-form").addEventListener("submit",sendMagicLink);
  $("refresh-pending").addEventListener("click",loadAdminLists);
  $("logout").addEventListener("click",async()=>{await db.auth.signOut();});
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) { await loadProfiles(); status("submit-message","Setup pending: public/app.js में Supabase project URL और publishable key भरें।","error"); return; }
  db = window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}} = await db.auth.getSession();
  await refreshAuth(session);
  db.auth.onAuthStateChange((_event,newSession)=>{ setTimeout(()=>refreshAuth(newSession),0); });
  await loadProfiles();
}
document.addEventListener("DOMContentLoaded",boot);
