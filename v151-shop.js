import { SUPABASE_URL, SUPABASE_ANON_KEY } from './duo-config.js';
const $=id=>document.getElementById(id);
const characters=[
 {id:'classic',name:'Klasik Savaşçı',icon:'⚔️',game:'ates'},
 {id:'ranger',name:'Orman Avcısı',icon:'🏹',game:'orman'}
];
const products=[
 {id:'black-gold',name:'Siyah Altın',price:49,details:'Klasik Savaşçı zırh görünümü'},
 {id:'founder-pack',name:'Kurucu Paketi',price:99,details:'Siyah Altın zırhı, altın kılıç izi ve Kurucu profil rozeti'}
];
let client=null,user=null,owned=new Set(),chosen='classic',equipped=null,preview=null,syncVersion=0,checkoutRequest=null,checkoutLink=null;
const el=$('v145Shop');if(!el)throw Error('V145 mağaza alanı bulunamadı');
const notice=document.createElement('div');notice.id='v145Notice';notice.setAttribute('role','status');
const auth=document.createElement('div');auth.id='v145Auth';
auth.innerHTML='<b>🔐 Oyuncu hesabı</b><p id="v145AuthState">Hesap kontrol ediliyor…</p><label>E-posta<input id="v145Email" type="email" autocomplete="email" placeholder="ornek@eposta.com"></label><label>Şifre (en az 8 karakter)<input id="v145Password" type="password" autocomplete="current-password" minlength="8"></label><button id="v145Login" type="button">Giriş yap</button> <button id="v145Signup" type="button">Kayıt ol</button> <button id="v145Logout" type="button">Çıkış</button>';
el.append(auth);
const cards=document.createElement('div');el.append(cards,notice);
function say(t){notice.textContent=t}
function hasProduct(id){
 return owned.has(id)||(id==='black-gold'&&owned.has('founder-pack'));
}
function applyAppearance(){
 window.pirpirSetCosmetic?.(equipped,Boolean(preview));
}
async function startCheckout(productId){
 if(!client||!user){say('Test ödeme için önce hesabına giriş yap.');return;}
 if(checkoutRequest)return;
 checkoutLink=null;
 const request={userId:user.id,productId};
 checkoutRequest=request;
 say('iyzico test ödeme sayfası hazırlanıyor…');
 render();
 try{
  const {data,error}=await client.functions.invoke('pirpir-sandbox-checkout',{body:{productId}});
  if(error)throw error;
  const url=new URL(data.paymentUrl);
  if(url.origin!=='https://sandbox-api.iyzipay.com')throw Error('Unexpected payment origin');
  if(checkoutRequest!==request||user?.id!==request.userId)return;
  checkoutLink={productId,url:url.href};
  say('Test ödeme bağlantısı hazır. Ödemeden sonra bu sekmeye dön.');
 }catch{
  if(checkoutRequest===request)say('Test ödeme sayfası açılamadı. Biraz sonra yeniden dene.');
 }finally{
  if(checkoutRequest===request){checkoutRequest=null;render();}
 }
}
function render(){
 $('v150FounderBadge').hidden=!hasProduct('founder-pack');
 cards.replaceChildren();
 const grid=document.createElement('div');
 grid.className='v145Grid';
 for(const character of characters){
  const button=document.createElement('button');
  const selected=character.id===chosen;
  button.type='button';
  button.className='v145Card';
  button.setAttribute('aria-pressed',String(selected));
  button.textContent=character.icon+' '+character.name+(selected?' · Seçili':'');
  button.addEventListener('click',()=>{
   const choice=document.querySelector('.v87Char[data-character="'+character.game+'"]');
   choice.click();
   chosen=character.id;
   equipped=null;
   preview=null;
   applyAppearance();
   render();
   say(character.name+' seçildi.');
   grid.querySelector('[aria-pressed="true"]').focus();
  });
  grid.append(button);
 }
 cards.append(grid);
 const heading=document.createElement('h3');
 heading.textContent='Kozmetik mağazası · Test modu';
 cards.append(heading);
 for(const product of products){
  const card=document.createElement('div');
  card.className='v145Card';
  const title=document.createElement('b');
  title.textContent=product.name+' · '+product.price+' TL';
  const details=document.createElement('p');
  details.textContent=product.details;
  const previewButton=document.createElement('button');
  previewButton.type='button';
  previewButton.textContent=preview===product.id?'Önizlemeyi kapat':'3D önizle';
  previewButton.onclick=()=>{
   preview=preview===product.id?null:product.id;
   applyAppearance();
   render();
   document.querySelector('[data-product="'+product.id+'"]').focus();
   if(preview)$('v88PreviewWrap').scrollIntoView({block:'nearest'});
  };
  previewButton.dataset.product=product.id;
  const buy=document.createElement('button');
  buy.type='button';
  const unlocked=hasProduct(product.id);
  buy.textContent=unlocked?(equipped===product.id?'Kuşanıldı':'Kuşan'):'Test satın al';
  buy.disabled=unlocked?equipped===product.id:Boolean(checkoutRequest);
  buy.onclick=()=>{
   if(!hasProduct(product.id)){void startCheckout(product.id);return;}
   if(chosen!=='classic')document.querySelector('.v87Char[data-character="ates"]').click();
   chosen='classic';
   equipped=product.id;
   preview=null;
   applyAppearance();
   render();
   say(product.name+' kuşanıldı.');
  };
  card.append(title,details,previewButton,buy);
  if(checkoutLink?.productId===product.id&&!unlocked){
   const link=document.createElement('a');
   link.className='menuBtn secondary';
   link.href=checkoutLink.url;
   link.target='_blank';
   link.rel='noopener noreferrer';
   link.textContent='iyzico test sayfasını aç ↗';
   card.append(link);
  }
  cards.append(card);
 }
}
async function sync(){
 const version=++syncVersion;
 const userId=user?.id;
 if(!client||!userId)return;
 try{
  const [live,test]=await Promise.all([
   client.from('player_characters').select('character_id').eq('user_id',userId),
   client.from('pirpir_sandbox_orders').select('product_id').not('paid_at','is',null)
  ]);
  if(live.error)throw live.error;
  if(version!==syncVersion||user?.id!==userId)return;
  owned=new Set((live.data||[]).map(row=>row.character_id));
  if(!test.error)for(const row of test.data||[])owned.add(row.product_id);
  if(equipped&&!hasProduct(equipped)){
   equipped=null;
   applyAppearance();
  }
  render();
 }catch(error){console.warn('Karakter sahipliği okunamadı.',error);}
}
function setUser(nextUser){
 if(nextUser?.id!==user?.id){
  ++syncVersion;
  owned=new Set();
  checkoutRequest=null;
  checkoutLink=null;
  equipped=null;
  preview=null;
  applyAppearance();
  render();
 }
 user=nextUser;
 status();
}
function status(){const st=$('v145AuthState');st.textContent=user?'Giriş yapıldı: '+(user.email||'Oyuncu'):'Giriş yapılmadı. Ücretsiz karakterlerle oynayabilirsin.';$('v145Logout').hidden=!user}
async function connect(){try{const mod=await import('https://esm.sh/@supabase/supabase-js@2');client=mod.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await client.auth.getUser();setUser(data?.user||null);await sync();client.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);setTimeout(()=>sync(),0)});}catch(e){status();say('Hesap bağlantısı kurulamadı. Tek oyunculu mod kullanılabilir.')}}
async function sign(mode){if(!client){say('Supabase bağlantısı yok.');return}const email=$('v145Email').value.trim(),password=$('v145Password').value;if(!email||password.length<8){say('Geçerli e-posta ve en az 8 karakter şifre gir.');return}try{const {error}=mode==='up'?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});if(error)throw error;say(mode==='up'?'Kayıt talebi alındı. Gerekirse e-postanı doğrula.':'Giriş yapıldı.')}catch(e){say('Hesap işlemi başarısız: '+e.message)}}
$('v145Login').onclick=()=>sign('in');$('v145Signup').onclick=()=>sign('up');$('v145Logout').onclick=async()=>{if(client)await client.auth.signOut();setUser(null)};
window.pirpirV145={getUser:()=>user?.id||null,getOwned:()=>[...owned],getSelected:()=>chosen};
window.addEventListener('pirpir-cosmetics-ready',applyAppearance);
window.addEventListener('focus',()=>void sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
render();status();connect();
