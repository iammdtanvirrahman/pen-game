(() => {
  'use strict';
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const playButton = document.getElementById('play-button');
  const gameSection = document.getElementById('game-section');
  const howButton = document.getElementById('how-button');
  const howSection = document.getElementById('how-section');
  const homeButton = document.getElementById('home-button');
  const restartButton = document.getElementById('restart-button');
  const rematchButton = document.getElementById('rematch-button');
  const overlay = document.getElementById('game-message');
  const messageTitle = document.getElementById('message-title');
  const messageText = document.getElementById('message-text');
  const COLORS = ['#ef4538', '#3472f5', '#31a47b', '#f4bd4f'];
  const NAMES = ['তুমি', 'নীল', 'সবুজ', 'হলুদ'];
  let W = 900, H = 470, pens = [], running = false, ended = false, animation = 0;
  let drag = null, pointer = null, lastAi = 0, round = 1, particles = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = W / (window.innerWidth <= 620 ? 1.1 : 1.9);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pens.length) {
      pens.forEach(p => { p.x = Math.max(p.r + 8, Math.min(W - p.r - 8, p.x / p.oldW * W)); p.y = Math.max(p.r + 8, Math.min(H - p.r - 8, p.y / p.oldH * H)); p.oldW = W; p.oldH = H; });
    }
    draw();
  }
  function newMatch() {
    cancelAnimationFrame(animation); running = true; ended = false; drag = null; particles = []; lastAi = 0;
    overlay.classList.add('hidden'); round = 1;
    const y = H / 2;
    pens = [
      makePen(W * .26, y + H * .13, 0, 'red'),
      makePen(W * .49, y - H * .12, 1, 'blue'),
      makePen(W * .70, y + H * .12, 2, 'green'),
      makePen(W * .76, y - H * .22, 3, 'gold')
    ];
    document.getElementById('round-label').textContent = round;
    updateHud(); draw(); tick();
  }
  function makePen(x, y, id, color) { return {x,y,vx:0,vy:0,angle:(Math.random()-.5)*.6,id,color:COLORS[id],name:NAMES[id],r:Math.max(13,Math.min(18,W*.021)),alive:true,oldW:W,oldH:H,aiAt:0}; }
  function startGame() { gameSection.classList.remove('hidden'); newMatch(); setTimeout(() => gameSection.scrollIntoView({behavior:'smooth',block:'start'}), 20); }
  function returnHome() { running = false; cancelAnimationFrame(animation); gameSection.classList.add('hidden'); document.getElementById('home').scrollIntoView({behavior:'smooth'}); }
  function playButtonHandler() { startGame(); }
  playButton.addEventListener('click', playButtonHandler);
  rematchButton.addEventListener('click', newMatch);
  restartButton.addEventListener('click', newMatch);
  homeButton.addEventListener('click', returnHome);
  howButton.addEventListener('click', () => howSection.scrollIntoView({behavior:'smooth', block:'start'}));
  window.addEventListener('resize', resize);

  function point(evt) { const r = canvas.getBoundingClientRect(); return {x:evt.clientX-r.left,y:evt.clientY-r.top}; }
  canvas.addEventListener('pointerdown', evt => {
    if (!running || ended) return;
    const pt = point(evt); const candidates = pens.filter(p => p.alive && p.id === 0).sort((a,b) => Math.hypot(a.x-pt.x,a.y-pt.y)-Math.hypot(b.x-pt.x,b.y-pt.y));
    const p = candidates[0]; if (!p || Math.hypot(p.x-pt.x,p.y-pt.y) > p.r*2.6) return;
    drag = {pen:p,start:pt,current:pt}; pointer = evt.pointerId; canvas.setPointerCapture(pointer); evt.preventDefault(); draw();
  });
  canvas.addEventListener('pointermove', evt => { if (!drag || evt.pointerId !== pointer) return; drag.current = point(evt); draw(); });
  function release(evt) {
    if (!drag || (evt && evt.pointerId !== pointer)) return;
    const p = drag.pen, dx = drag.start.x - drag.current.x, dy = drag.start.y - drag.current.y;
    const max = Math.max(40, W*.23), length = Math.hypot(dx,dy), scale = Math.min(length,max) ? Math.min(length,max)/Math.max(length,1) : 0;
    if (length > 5) { p.vx = dx*scale*.105; p.vy = dy*scale*.105; p.angle = Math.atan2(p.vy,p.vx); }
    drag = null; pointer = null; draw();
  }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  function tick(time = 0) {
    if (!running) return;
    physics();
    if (time - lastAi > 800) { lastAi = time; aiMove(); }
    draw();
    const alive = pens.filter(p => p.alive);
    if (alive.length <= 1) { finish(alive[0]); return; }
    animation = requestAnimationFrame(tick);
  }
  function physics() {
    const friction = .986;
    for (const p of pens) {
      if (!p.alive) continue;
      p.x += p.vx; p.y += p.vy; p.angle += (p.vx-p.vy)*.014;
      p.vx *= friction; p.vy *= friction;
      if (Math.abs(p.vx)<.025) p.vx=0; if(Math.abs(p.vy)<.025) p.vy=0;
      const margin = p.r*.55;
      if (p.x < -margin || p.x > W+margin || p.y < -margin || p.y > H+margin) { knockOut(p); continue; }
    }
    for (let i=0;i<pens.length;i++) for(let j=i+1;j<pens.length;j++) {
      const a=pens[i],b=pens[j]; if(!a.alive||!b.alive)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;
      if(d>0&&d<min){
        const nx=dx/d,ny=dy/d,overlap=min-d;
        a.x-=nx*overlap*.51;a.y-=ny*overlap*.51;b.x+=nx*overlap*.51;b.y+=ny*overlap*.51;
        const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(rel>0){a.vx-=rel*.78*nx;a.vy-=rel*.78*ny;b.vx+=rel*.78*nx;b.vy+=rel*.78*ny;}
        if(Math.abs(rel)>1.2){for(let k=0;k<5;k++)particles.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,life:18,color:'#ffe3aa'});}
      }
    }
    particles.forEach(q=>{q.x+=q.vx;q.y+=q.vy;q.life--});particles=particles.filter(q=>q.life>0);
  }
  function knockOut(p) { p.alive=false; p.vx=p.vy=0; updateHud(); }
  function aiMove() {
    const aliveAi=pens.filter(p=>p.alive&&p.id!==0), targets=pens.filter(p=>p.alive&&p.id!==0);
    aliveAi.forEach((p,idx)=>{
      if(Math.hypot(p.vx,p.vy)>.55||Math.random()>.82)return;
      let target=pens.filter(t=>t.alive&&t.id!==p.id).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
      if(!target)return;
      let dx=target.x-p.x,dy=target.y-p.y;const d=Math.hypot(dx,dy)||1;
      // Aiming slightly toward the nearest rival keeps AI turns readable and playful.
      const edgeBias = d < W*.25 ? 1.0 : .72;
      const power=(2.1+Math.random()*2.4)*edgeBias;
      p.vx+=dx/d*power+(Math.random()-.5)*.8;p.vy+=dy/d*power+(Math.random()-.5)*.8;p.angle=Math.atan2(p.vy,p.vx);
    });
  }
  function finish(winner) {
    running=false;ended=true;cancelAnimationFrame(animation);updateHud();
    if(winner&&winner.id===0){messageTitle.textContent='তুমি জিতেছ!';messageText.textContent='বেঞ্চের শেষ কলম—চ্যাম্পিয়ন তুমি!';}
    else if(winner){messageTitle.textContent=winner.name+' জিতেছে!';messageText.textContent='এই রাউন্ডে তোমার কলম বেঞ্চ থেকে পড়ে গেছে। আরেকবার চেষ্টা করো!';}
    else{messageTitle.textContent='ম্যাচ শেষ!';messageText.textContent='চলো আবার একটা রাউন্ড খেলি।';}
    overlay.classList.remove('hidden');
  }
  function updateHud(){
    pens.forEach(p=>{if(p.id===0)document.getElementById('you-state').textContent=p.alive?(drag?'লক্ষ্য ঠিক করো':'তোমার চাল'):'আউট';else document.getElementById(`p${p.id+1}-state`).textContent=p.alive?'খেলছে':'আউট';});
  }
  function draw() {
    if(!W||!H)return;
    ctx.clearRect(0,0,W,H);
    // Wood-grain tabletop with a softly lit classroom-bench aesthetic.
    const grad=ctx.createLinearGradient(0,0,W,H);grad.addColorStop(0,'#d59a5b');grad.addColorStop(.5,'#b97a43');grad.addColorStop(1,'#89532f');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    for(let i=0;i<27;i++){ctx.beginPath();const y=(i/27)*H;ctx.moveTo(0,y+Math.sin(i*1.7)*4);ctx.bezierCurveTo(W*.28,y-6,W*.64,y+7,W,y+Math.cos(i)*5);ctx.strokeStyle=i%3===0?'#6a391b25':'#f9c07c1c';ctx.lineWidth=i%4===0?2:1;ctx.stroke();}
    ctx.fillStyle='#4e2b1e77';ctx.font=`bold ${Math.max(10,W*.015)}px sans-serif`;ctx.save();ctx.translate(W*.1,H*.78);ctx.rotate(-.12);ctx.fillText('কলম খেলবি?',0,0);ctx.restore();
    // A narrow painted border marks the bench edge.
    ctx.strokeStyle='#4b281caa';ctx.lineWidth=5;ctx.strokeRect(3,3,W-6,H-6);ctx.strokeStyle='#efc58b88';ctx.lineWidth=1;ctx.strokeRect(8,8,W-16,H-16);
    pens.forEach(p=>{if(p.alive)drawPen(p);else{ctx.save();ctx.globalAlpha=.45;ctx.fillStyle='#321b16';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('OUT',Math.max(22,Math.min(W-22,p.x)),Math.max(16,Math.min(H-8,p.y)));ctx.restore();}});
    particles.forEach(q=>{ctx.globalAlpha=Math.min(1,q.life/12);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,q.life*.18),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;});
    if(drag){const p=drag.pen;ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle='#fff6db';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(drag.start.x-drag.current.x)*.8,p.y+(drag.start.y-drag.current.y)*.8);ctx.stroke();ctx.setLineDash([]);ctx.restore();drawArrow(p.x,p.y,p.x+(drag.start.x-drag.current.x)*.8,p.y+(drag.start.y-drag.current.y)*.8);ctx.beginPath();ctx.arc(drag.current.x,drag.current.y,7,0,Math.PI*2);ctx.fillStyle='#fff4d1aa';ctx.fill();}
    const alive=pens.filter(p=>p.alive).length;ctx.fillStyle='#211811c9';roundRect(ctx,W-104,14,88,29,8);ctx.fill();ctx.fillStyle='#fff4e2';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(`বাকি ${alive}/৪`,W-60,33);
  }
  function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function drawArrow(x1,y1,x2,y2){const a=Math.atan2(y2-y1,x2-x1),len=10;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-len*Math.cos(a-.55),y2-len*Math.sin(a-.55));ctx.lineTo(x2-len*Math.cos(a+.55),y2-len*Math.sin(a+.55));ctx.closePath();ctx.fillStyle='#fff4d1';ctx.fill();}
  function drawPen(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);const len=p.r*3.5,thick=p.r*.68;
    ctx.shadowColor='#44241388';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
    const g=ctx.createLinearGradient(0,-thick,0,thick);g.addColorStop(0,'#ffffff');g.addColorStop(.18,p.color);g.addColorStop(.58,p.color);g.addColorStop(1,'#29242a');
    roundRect(ctx,-len/2,-thick/2,len,thick,thick/2);ctx.fillStyle=g;ctx.fill();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    // Back cap and nib.
    ctx.fillStyle='#e6dfd0';roundRect(ctx,-len/2-2,-thick*.36,5,thick*.72,2);ctx.fill();
    ctx.beginPath();ctx.moveTo(len/2-thick*.25,-thick*.43);ctx.lineTo(len/2+thick*.7,0);ctx.lineTo(len/2-thick*.25,thick*.43);ctx.closePath();ctx.fillStyle='#d9d0bd';ctx.fill();
    ctx.fillStyle='#ffffff8a';roundRect(ctx,-len*.29,-thick*.27,len*.57,Math.max(1,thick*.12),2);ctx.fill();
    ctx.strokeStyle='#e8e1d0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(len*.15,-thick*.46);ctx.quadraticCurveTo(len*.32,-thick*1.05,len*.43,-thick*.35);ctx.stroke();
    ctx.restore();
    ctx.save();ctx.fillStyle='#24180fdd';ctx.font=`bold ${Math.max(9,p.r*.65)}px sans-serif`;ctx.textAlign='center';ctx.fillText(p.name,p.x,p.y-p.r*1.25);ctx.restore();
    if(p.id===0){ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.25,0,Math.PI*2);ctx.strokeStyle='#fff5d899';ctx.lineWidth=1.5;ctx.stroke();}
  }
  // Set correct canvas dimensions before the user enters the match.
  resize();
})();
