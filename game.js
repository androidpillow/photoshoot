// --- Pixel-Portrait Quest (Startscreen + Large Portraits + Option A Perfect Rules) ---

// DOM refs
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('modal');
const toast = document.getElementById('toast');
const statusEl = document.getElementById('status');
const invEl = document.getElementById('inv');
const sceneNameEl = document.getElementById('sceneName');

// Inject minimal styles (blink + big portrait + start overlay)
(function injectStyles(){
  const css = `
    .portrait{ display:block; margin:14px auto; width:100%; max-width:520px; image-rendering: pixelated; }
    .panel .card img.shopBG{ width:100%; max-width:900px; display:block; margin:0 auto 8px; image-rendering: pixelated; }
    @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:.25} }
    .start-overlay{ position:fixed; inset:0; background:#0b0d14; display:flex; align-items:center; justify-content:center; z-index:9999; }
    .start-card{ position:relative; max-width:960px; width:96%; }
    .start-card img{ width:100%; display:block; image-rendering: pixelated; border-radius:8px; }
    .start-press{
      position:absolute; left:50%; bottom:7%; transform:translateX(-50%);
      font-family: monospace; font-weight:700; font-size:22px; color:#fff; letter-spacing:1px;
      text-shadow:0 2px 0 #000, 0 0 6px rgba(0,0,0,.6); animation: blink 1.1s linear infinite;
      background: rgba(0,0,0,.25); padding:6px 10px; border-radius:6px;
    }
  `;
  const el=document.createElement('style'); el.textContent=css; document.head.appendChild(el);
})();

// utils
function loadImg(src){ const i=new Image(); i.src=src; return i; }
function showToast(msg){ toast.textContent=msg; toast.style.display='block'; clearTimeout(showToast.t); showToast.t=setTimeout(()=> toast.style.display='none',1600); }

// keyboard / debug
const keys = new Set();
const DEBUG = { show:false, edit:false };
let lastE = 0;                 // debounce for E
let started = false;           // gates the game behind start screen

addEventListener('keydown',(e)=>{
  const k=e.key.toLowerCase();
  if(!started){
    startGameFromOverlay();
    e.preventDefault();
    return;
  }
  keys.add(k);
  if(['arrowleft','arrowright',' '].includes(e.key)) e.preventDefault();
  if(k==='h') DEBUG.show=!DEBUG.show;
  if(k==='d'){ DEBUG.edit=!DEBUG.edit; showToast(DEBUG.edit?'Door edit: ON':'Door edit: OFF'); }
});
addEventListener('keyup',(e)=> keys.delete(e.key.toLowerCase()));

// click edit for doors
canvas.addEventListener('click',(e)=>{
  if(!DEBUG.edit) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(canvas.width/rect.width);
  const px=x/canvas.width;
  const sc=SCENES[game.scene];
  if(!sc) return;
  let nearest=null,best=1e9;
  sc.doors.forEach(d=>{ const dist=Math.abs(px-d.px); if(dist<best){best=dist; nearest=d;} });
  if(nearest){ nearest.px=Math.max(0.02,Math.min(0.98,px)); showToast(`${nearest.name}: ${(nearest.px*100).toFixed(1)}%`); }
});

// assets
const BG = {
  street1: loadImg('assets/bg/street1.png'),
  street2: loadImg('assets/bg/street2.png'),
  street3: loadImg('assets/bg/street3.png'),
  bookshop: loadImg('assets/bg/bookshop.png'),
  copyshop: loadImg('assets/bg/copyshop.png'),
  clothingshop: loadImg('assets/bg/clothingshop.png'),
  flowershop: loadImg('assets/bg/flowershop.png'),
  studio: loadImg('assets/bg/studio.png'),
  drugstore: loadImg('assets/bg/drugstore.png'),
  coffeeshop: loadImg('assets/bg/coffeeshop.png'),
  startscreen: loadImg('assets/ui/startscreen.png')   // <— dein Startscreen
};
const PORTRAIT = {
  perfect: loadImg('assets/portraits/perfect.png'),
  good:    loadImg('assets/portraits/good.png'),
  okay:    loadImg('assets/portraits/okay.png'),
  fail:    loadImg('assets/portraits/fail.png')
};
const SPRITE_WALK = loadImg('assets/sprites/walk.png');  // rechts blickend
const SPRITE_IDLE = loadImg('assets/sprites/idle.png');  // rechts blickend

// state
const world = { money:30 };
let game={ goal:null, inventory:[], player:{x:60,y:0,spd:0.095,facing:1, moving:false}, scene:'street1', visitedCafé:false };

// helpers
function door(px,name,interior){ return {px,name,tol:0.06,interior}; }
function edge(side,to,spawnPx){ return {side,to,spawnPx}; }
function pxToX(px){ return Math.floor(px*canvas.width); }

// calibrated scenes/doors
const SCENES={
  street1:{
    name:'Main Street 1', bg:'street1',
    doors:[ door(0.188,'Bookstore','bookshop'), door(0.409,'Copyshop','copyshop'), door(0.624,'Clothing','clothingshop') ],
    exits:[ edge('left','street3',0.92), edge('right','street2',0.06) ]
  },
  street2:{
    name:'Main Street 2', bg:'street2',
    doors:[ door(0.199,'Studio','studio'), door(0.366,'Café','coffeeshop'), door(0.858,'Drugstore','drugstore') ],
    exits:[ edge('left','street1',0.94) ]
  },
  street3:{
    name:'Side Street', bg:'street3',
    doors:[ door(0.199,'Flowershop','flowershop') ],
    exits:[ edge('right','street1',0.08) ]
  }
};

const SHOP_ITEMS={
  'Bookstore':[ {id:'album',name:'Photo Album',price:10}, {id:'script',name:'Script',price:8} ],
  'Copyshop':[ {id:'portfolio',name:'Portfolio Prints',price:12} ],
  'Clothing':[ {id:'outfit',name:'Outfit',price:14} ],
  'Drugstore':[ {id:'makeup',name:'Make-Up',price:9}, {id:'flower',name:'Flower',price:5} ],
  'Flowershop':[ {id:'bouquet',name:'Bouquet',price:12} ],
  'Café':[]
};
const DIALOGS={
  'Bookstore':{ model:"So you wanna be an actor? Without a script you’re just the coffee runner.", self:"For yourself? A diary, an album—something to flip through. Mysterious.", family:"Grandma lives for albums. Skip it and she’ll remember—forever." },
  'Copyshop':{ model:"No model without a portfolio. Otherwise they’ll assume you deliver pizza.", self:"Print it big if you must. Poster size is on discount.", family:"Laminated prints survive coffee spills. Your aunt will thank you." },
  'Clothing':{ model:"Outfit’s mandatory. Sweatpants scream hangover, not Hollywood.", self:"Wear what makes you grin later. That’s confidence.", family:"Grandma’s sweater? Bold choice. Risky for inheritance." },
  'Drugstore':{ model:"The camera never lies. Make-up helps it tell kinder truths.", self:"Treat yourself. A flower on the nightstand is Beyoncé-level self-care.", family:"Bring a flower or enjoy a Sunday roast—of your character." },
  'Flowershop':{ model:"A bouquet screams Eurovision winner. Casting might miss the memo.", self:"Buy yourself flowers. Who else will?", family:"Grandma’s kryptonite. One bouquet = family peace." },
  'Café':{ model:"Espresso makes you look edgy. Just don’t spill it on the outfit.", self:"One latte. Cheaper than therapy, tastes better too.", family:"Grab a cappuccino. You’ll need patience for Aunt’s stories." }
};
const GOAL_RULES={
  model:{ label:'Portfolio / Actor-Model', wants:['outfit','portfolio'], nice:['script','makeup','bouquet'] },
  self:{ label:'Self-Love',                wants:['makeup','flower'],    nice:['album','outfit','portfolio'] },
  family:{ label:'Family/Friends',         wants:['album','bouquet'],    nice:['outfit','makeup'] }
};

// Startscreen overlay
let startOverlay = null;
function buildStartOverlay(){
  startOverlay = document.createElement('div');
  startOverlay.className = 'start-overlay';
  startOverlay.innerHTML = `
    <div class="start-card">
      <img src="${BG.startscreen.src}" alt="Start">
      <div class="start-press">PRESS START</div>
    </div>`;
  startOverlay.addEventListener('click', startGameFromOverlay);
  document.body.appendChild(startOverlay);
}
function startGameFromOverlay(){
  if(started) return;
  started = true;
  if(startOverlay){ startOverlay.remove(); startOverlay=null; }
  // Konsolen-Check: Perfect-Machbarkeit je Pfad
  logPerfectFeasibility();
  openGoalPicker();
}

// UI
function openGoalPicker(){ modal.style.display='flex'; statusEl.textContent='Goal: –'; invEl.innerHTML=''; }
modal.addEventListener('click',(e)=>{
  const btn=e.target.closest('button[data-goal]'); if(!btn) return;
  game.goal=btn.dataset.goal;
  statusEl.textContent='Goal: '+GOAL_RULES[game.goal].label;
  modal.style.display='none';
  showToast('Budget: €30. Choose wisely.');
});

function renderInv(){
  invEl.innerHTML='';
  game.inventory.forEach(it=>{ const s=document.createElement('div'); s.className='slot'; s.title=it.name; s.textContent='·'; invEl.appendChild(s); });
  const money=document.createElement('span'); money.style.marginLeft='8px'; money.textContent=`Money: €${world.money}`; invEl.appendChild(money);
}
function addItem(item){ if(game.inventory.find(i=>i.id===item.id)) return showToast('Already in inventory.'); game.inventory.push(item); renderInv(); }

// Enter (debounced + guards, inkl. Rand-Exits)
function attemptEnter(){
  try{
    const sc=SCENES[game.scene];
    const px=game.player.x/canvas.width;
    const near=sc.doors.find(d=>Math.abs(px-d.px)<d.tol);
    if(!near){
      const EDGE_MARGIN=24;
      if(game.player.x<=EDGE_MARGIN){ const ex=sc.exits.find(e=>e.side==='left'); if(ex){ spawn(ex.to, ex.spawnPx); return; } }
      if(game.player.x>=canvas.width-EDGE_MARGIN){ const ex=sc.exits.find(e=>e.side==='right'); if(ex){ spawn(ex.to, ex.spawnPx); return; } }
      showToast('No door nearby.');
      return;
    }
    game.player.x=Math.round(pxToX(near.px));
    if(near.name==='Studio') return goStudio();
    if(near.name==='Café'){ game.visitedCafé=true; }
    return openPlace(near.name, near.interior);
  }catch(err){
    console.error('attemptEnter error', err);
    showToast('Oops – interaction error. Check console.');
  }
}

function openPlace(name,interiorKey){
  const panel=document.createElement('div'); panel.className='panel'; panel.style.display='flex';
  const src=(interiorKey&&BG[interiorKey])?BG[interiorKey].src:null;
  const items=SHOP_ITEMS[name]||[];
  const say=(DIALOGS[name]||{})[game.goal]||'';
  panel.innerHTML=`<div class="card">
    <h1>${name}</h1>
    ${src?`<img class='shopBG' src='${src}' alt='${name} interior'>`:''}
    ${say?`<p>${say}</p>`:''}
    ${items.length?`<p>What do you need?</p>`:''}
    <div class="btns" id="shopBtns"></div>
    <div class="btns"><button class="secondary" id="leave">Leave</button></div>
    <p style="opacity:.7">Money: €${world.money}</p>
  </div>`;
  document.body.appendChild(panel);
  const btnBox=panel.querySelector('#shopBtns');
  items.forEach(it=>{
    const b=document.createElement('button');
    b.textContent=`${it.name} – €${it.price}`;
    b.addEventListener('click',()=>{
      if(world.money<it.price) return showToast('Too expensive.');
      world.money-=it.price; addItem(it); renderInv(); showToast(`${it.name} bought.`);
    });
    btnBox.appendChild(b);
  });
  if(items.length===0){ const muted=document.createElement('div'); muted.style.opacity='.7'; muted.textContent='Nothing to buy here.'; btnBox.appendChild(muted); }
  panel.querySelector('#leave').addEventListener('click',()=>document.body.removeChild(panel));
}

// ===== Finale (Option A Regeln) + Easter Egg =====
function goStudio(){
  if(!game.goal){ showToast('Pick your goal first.'); return; }
  const rules=GOAL_RULES[game.goal]; const have=(id)=> game.inventory.some(i=>i.id===id);
  const scoreReq=rules.wants.reduce((ok,id)=>ok+(have(id)?1:0),0);
  const scoreNice=rules.nice.reduce((ok,id)=>ok+(have(id)?1:0),0);
  const total=scoreReq*2+scoreNice;

  const allReq = (scoreReq === rules.wants.length);
  let verdict,note,imgKey;

  // Easter Egg: Café + keine Items + Goal Self/Family → Perfect Shot
  if((game.goal==='self'||game.goal==='family') && game.inventory.length===0 && game.visitedCafé){
    verdict='Perfect Shot';
    note='Come as you are. No props, no extras. Just you. That’s always enough.';
    imgKey='perfect';

  // ----- Option A: Actor/Model Perfect = alle Wants reichen -----
  } else if(game.goal==='model' && allReq){
    verdict='Perfect Shot';
    note='You brought the essentials. Clean, professional, ready to book.';
    imgKey='perfect';

  // Default-Regel für andere Pfade (Self/Family)
  } else if(allReq){
    if(total >= rules.wants.length*2 + 1){ verdict='Perfect Shot'; note='Everything clicks. You nailed it.'; imgKey='perfect'; }
    else { verdict='Good Take'; note='Basics work. We’ll polish the rest.'; imgKey='good'; }
  } else if(scoreReq>0){ verdict='Okayish'; note='Something is missing. Let’s call it “artistic”.'; imgKey='okay'; }
  else { verdict='Fail'; note='Hey, at least you showed up.'; imgKey='fail'; }

  const panel=document.createElement('div'); panel.className='panel'; panel.style.display='flex';
  panel.innerHTML = `<div class="card">
    <h1>${verdict}</h1>
    <img class='portrait' src='${PORTRAIT[imgKey].src}' alt='${imgKey} portrait'>
    <p>${note}</p>
    <p style="opacity:.8">Goal: <b>${rules.label}</b> • You brought: ${game.inventory.map(i=>i.name).join(', ')||'nothing'}</p>
    <div class="btns">
      <button id="again">Restart (try another path)</button>
      <button class="secondary" id="close">Back to streets</button>
    </div>
  </div>`;
  document.body.appendChild(panel);
  document.getElementById('again').addEventListener('click',()=>{ document.body.removeChild(panel); resetGame(true); openGoalPicker(); });
  document.getElementById('close').addEventListener('click',()=>document.body.removeChild(panel));
}

// Movement
function update(dt){
  if(!started) return; // freeze until start pressed
  const p=game.player; let vx=0; const spd=p.spd*dt;
  if(keys.has('arrowleft')||keys.has('a')){ vx-=spd; p.facing=-1; p.moving=true; }
  if(keys.has('arrowright')||keys.has('d')){ vx+=spd; p.facing=1; p.moving=true; }
  if(!(keys.has('arrowleft')||keys.has('a')||keys.has('arrowright')||keys.has('d'))){ p.moving=false; }
  p.x+=vx; 
  const EDGE_MARGIN = 24;
  p.x=Math.max(EDGE_MARGIN,Math.min(canvas.width-EDGE_MARGIN,p.x));

  // Debounced E
  const now = performance.now();
  if(keys.has('e') && now - lastE > 220){ lastE = now; attemptEnter(); }
  if(keys.has('i')){ keys.delete('i'); showToast('Inventory: '+(game.inventory.map(i=>i.name).join(', ')||'empty')); }

  // Auto edge transitions
  if(p.x<=EDGE_MARGIN && (keys.has('arrowleft')||keys.has('a'))){ const ex=SCENES[game.scene].exits.find(e=>e.side==='left'); if(ex) spawn(ex.to, ex.spawnPx); }
  if(p.x>=canvas.width-EDGE_MARGIN && (keys.has('arrowright')||keys.has('d'))){ const ex=SCENES[game.scene].exits.find(e=>e.side==='right'); if(ex) spawn(ex.to, ex.spawnPx); }
}

// spawn/draw helpers
function spawn(name,spawnPx){ game.scene=name; sceneNameEl.textContent=SCENES[name].name; if(typeof spawnPx==='number') game.player.x=pxToX(spawnPx); }
function resizeCanvasToBG(img){ if(!img||!img.complete||!img.naturalWidth)return; const targetW=960; const ratio=img.naturalHeight/img.naturalWidth; const targetH=Math.max(320,Math.round(targetW*ratio)); canvas.width=targetW; canvas.height=targetH; }

function drawPlayer(){
  const p=game.player;
  const x=Math.floor(p.x), ground=canvas.height-8;
  const img = p.moving ? SPRITE_WALK : SPRITE_IDLE;
  if(img.complete&&img.naturalWidth){
    const targetHeight=Math.round(canvas.height*0.22); // skaliert Figur
    const scale=targetHeight/img.naturalHeight;
    const dw=Math.max(1,Math.round(img.naturalWidth*scale));
    const dh=Math.max(1,Math.round(img.naturalHeight*scale));
    const dx=x-Math.floor(dw/2), dy=ground-dh;
    ctx.imageSmoothingEnabled=false;
    if(p.facing===1){ ctx.drawImage(img,dx,dy,dw,dh); }
    else { ctx.save(); ctx.scale(-1,1); ctx.drawImage(img,-dx-dw,dy,dw,dh); ctx.restore(); }
  } else { ctx.fillStyle='#ff5b7f'; ctx.fillRect(x-6,ground-36,12,28); }
}

function draw(){
  const sc=SCENES[game.scene]; const img=BG[sc.bg];
  if(img.complete&&img.naturalWidth){ resizeCanvasToBG(img); ctx.drawImage(img,0,0,canvas.width,canvas.height); }
  ctx.fillStyle='#ffffffaa'; ctx.fillText('←', 8, 18); ctx.fillText('→', canvas.width-18, 18);
  const px=game.player.x/canvas.width; const near=sc.doors.find(d=>Math.abs(px-d.px)<d.tol); if(near){ ctx.fillStyle='#fff'; ctx.fillText('E: Door',Math.floor(pxToX(near.px)-12),20); }
  drawPlayer();
}

function loop(ts){ const dt=Math.min(33,ts-loop.last||16); loop.last=ts; update(dt); draw(); requestAnimationFrame(loop); }
function resetGame(keepMoney=false){ game.inventory=[]; if(!keepMoney) world.money=30; game.visitedCafé=false; renderInv(); spawn('street1',0.06); }

// ===== Console helper: Perfect feasibility summary =====
function logPerfectFeasibility(){
  const prices = {
    outfit: 14, portfolio: 12, script: 8, makeup: 9, bouquet: 12, album: 10, flower: 5
  };
  const budget = world.money;
  const canBuy = (arr)=> arr.reduce((s,id)=> s+prices[id],0) <= budget;

  const selfReq  = ['makeup','flower'];
  const selfNice = ['album','outfit','portfolio']; // min 1
  const selfOK   = canBuy(selfReq) && selfNice.some(n=> canBuy([...selfReq, n]));

  const famReq   = ['album','bouquet'];
  const famNice  = ['outfit','makeup'];            // min 1, aber beide zu teuer mit Req
  const famOK    = false; // kaufbasiert unmöglich; Easter Egg möglich

  const modelReq = ['outfit','portfolio'];
  const modelOK  = canBuy(modelReq);               // Option A: reicht für Perfect

  console.log('%cPerfect feasibility (Budget €'+budget+')',
              'background:#222;color:#0f0;padding:2px 6px;border-radius:3px');
  console.log('Self-Love:   purchase-based Perfect =', selfOK, '| (Easter Egg not needed)');
  console.log('Family/Friends: purchase-based Perfect =', famOK, '| Easter Egg = true');
  console.log('Actor/Model: purchase-based Perfect =', modelOK, '(Option A active)');
}

// boot
renderInv(); spawn('street1',0.06);
buildStartOverlay();      // Startscreen zeigen
requestAnimationFrame(loop);