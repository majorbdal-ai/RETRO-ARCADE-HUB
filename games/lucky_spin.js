function luckySpin(canvas, ctx, onScore, onGameOver, onCoins){
  "use strict";
  var W=800,H=450,CX=560,CY=225,R=150;
let diffMul = 1;  // v7.20 difficulty ramp
  var SEG=[
    {t:'+50',v:50,c:'#ff3b5c'},
    {t:'+100',v:100,c:'#ffb020'},
    {t:'BONUS x2',v:0,c:'#ff5cf0',bonus:2},
    {t:'+25',v:25,c:'#38e8ff'},
    {t:'+200',v:200,c:'#3bff8a'},
    {t:'BONUS x3',v:0,c:'#8a5cff',bonus:3},
    {t:'+75',v:75,c:'#ff7b3b'},
    {t:'JACKPOT',v:500,c:'#ffd93b',jackpot:true},
    {t:'FREE SPIN',v:0,c:'#7bffb0',free:1},
    {t:'+150',v:150,c:'#5cc8ff'}
  ];
  var N=SEG.length,TWO=Math.PI*2;
  var raf=null,last=0,running=false,over=false,reported=false;
  var keys={},touches={};
  var state='idle',angle=0,vel=0,charge=0,charging=false;
  var spins=3,mult=1;
  var resultT=0,msg='',msgC='#fff',awarded=false;
  var score=0,shownScore=-1,coins=0;
  var parts=[],pops=[];
  var pendingEnd=false,endT=0;

  function press(alias,ks){
    if(touches&&touches[alias])return true;
    if(keys){for(var i=0;i<ks.length;i++){if(keys[ks[i]])return true;}}
    return false;
  }
  function syncScore(){if(score!==shownScore){shownScore=score;if(onScore)onScore(score);}}
  function addCoins(n){if(n<=0)return;coins+=n;if(onCoins)onCoins(n);}
  function pop(x,y,txt,c){pops.push({x:x,y:y,txt:txt,c:c||'#fff',life:1.0});}
  function burst(x,y,c,n){
    for(var i=0;i<n;i++){
      var a=Math.random()*TWO,sp=80+Math.random()*220;
      parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:0.6+Math.random()*0.5,c:c});
    }
  }
  function reset(){
    angle=0;vel=0;charge=0;charging=false;
    spins=3;mult=1;
    state='idle';resultT=0;msg='';msgC='#fff';awarded=false;
    parts=[];pops=[];
    score=0;coins=0;shownScore=-1;syncScore();
    pendingEnd=false;endT=0;
  }
  function doSpin(){
    if(pendingEnd)return;
    if(spins<=0){
      pendingEnd=true;endT=1.4;
      msg='NO SPINS LEFT';msgC='#ff3b5c';
      return;
    }
    spins--;
    vel=2.6+charge*9.2;
    state='spin';
    charge=0;
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
  }
  function settle(){
    if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
    var norm=((angle%TWO)+TWO)%TWO;
    var idx=Math.floor(norm/(TWO/N))%N;
    var s=SEG[idx],amt;
    if(s.free){
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      spins++;
      msg='FREE SPIN! STOCK +1';
      msgC=s.c;
      pop(CX,CY-R-44,'FREE SPIN!','#7bffb0');
    }else if(s.bonus){
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      mult=Math.min(8,mult*s.bonus);
      msg='BONUS x'+mult+' ACTIVE';
      msgC=s.c;
      pop(CX,CY+R+44,'BONUS x'+mult,'#ff5cf0');
    }else{
      amt=s.v*mult;
      if(s.jackpot)amt=500*mult;
      addCoins(amt);
      score+=amt;
      syncScore();
      if (typeof window.playSfx === 'function') { try { window.playSfx(s.jackpot || amt >= 100 ? 'win2' : 'coin'); } catch (e) {} }
      if (s.jackpot || amt >= 100) {
        if (navigator.vibrate) { try { navigator.vibrate(80); } catch(e){} }
      }
      msg=(s.jackpot?'JACKPOT!':'WIN')+' +'+amt+' COINS';
      msgC=s.c;
      burst(CX,CY,s.c,16);
      mult=1;
    }
    awarded=true;
  }
  function update(dt){
    var i,q;
    for(i=pops.length-1;i>=0;i--){q=pops[i];q.life-=dt;q.y-=30*dt;if(q.life<=0)pops.splice(i,1);}
    for(i=parts.length-1;i>=0;i--){
      q=parts[i];
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=500*diffMul*dt;q.life-=dt;
      if(q.life<=0)parts.splice(i,1);
    }
    if(state==='idle'){
      if(pendingEnd){
        endT-=dt;
        if(endT<=0)endGame();
        return;
      }
      var held=press('action',['Space','KeyW','Enter','action'])||!!touches.active||false;
      if(held&&!charging){charging=true;charge=0;}
      if(charging){
        if(!held){charging=false;doSpin();}
        else{charge=Math.min(1,charge+dt*0.65);}
      }
    }else if(state==='spin'){
      angle+=vel*dt;
      vel-=3.2*dt;
      if(vel<=0){
        vel=0;
        state='result';
        resultT=1.7;
        awarded=false;
        settle();
      }
    }else if(state==='result'){
      resultT-=dt;
      if(resultT<=0){
        state='idle';
        msg='';
        if(spins<=0&&!pendingEnd){
          pendingEnd=true;endT=1.2;
        }
      }
    }
  }
  function endGame(){
    if(reported)return;
    reported=true;over=true;running=false;
    cancelAnimationFrame(raf);
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if(onGameOver)if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score,coins);
  }
  function neonText(t,x,y,c,size,align,glow){
    ctx.save();
    ctx.font='bold '+size+'px "Courier New",monospace';
    ctx.textAlign=align||'left';ctx.textBaseline='top';
    ctx.shadowColor=c;ctx.shadowBlur=glow===undefined?14:glow;
    ctx.fillStyle=c;ctx.fillText(t,x,y);
    ctx.restore();
  }
  function draw(){
    ctx.fillStyle='#0a0216';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(140,0,255,0.14)';ctx.lineWidth=1;ctx.beginPath();
    for(var gx=0;gx<=W;gx+=50){ctx.moveTo(gx,0);ctx.lineTo(gx,H);}
    for(var gy=0;gy<=H;gy+=50){ctx.moveTo(0,gy);ctx.lineTo(W,gy);}
    ctx.stroke();
    var i;
    ctx.strokeStyle='#ff5cf0';ctx.lineWidth=3;ctx.shadowColor='#ff5cf0';ctx.shadowBlur=24;
    ctx.beginPath();ctx.arc(CX,CY,R,0,TWO);ctx.stroke();
    ctx.shadowBlur=0;
    var segA=TWO/N;
    for(i=0;i<N;i++){
      var s=SEG[i];
      var a0=angle+i*segA,a1=angle+(i+1)*segA;
      var mid=a0+segA/2;
      ctx.beginPath();
      ctx.moveTo(CX,CY);
      ctx.arc(CX,CY,R-6,a0,a1);
      ctx.closePath();
      ctx.fillStyle=s.c;ctx.globalAlpha=0.24;ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle=s.c;ctx.lineWidth=2;ctx.stroke();
      ctx.save();
      ctx.translate(CX,CY);
      ctx.rotate(mid);
      ctx.font='bold 13px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor=s.c;ctx.shadowBlur=8;
      ctx.fillStyle='#fff';
      ctx.fillText(s.t,R*0.66,0);
      ctx.restore();
    }
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(CX,CY,R-10,0,TWO);ctx.stroke();
    ctx.fillStyle='#12052a';ctx.shadowColor='#38e8ff';ctx.shadowBlur=18;
    ctx.beginPath();ctx.arc(CX,CY,38,0,TWO);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#38e8ff';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(CX,CY,38,0,TWO);ctx.stroke();
    neonText(state==='idle'&&!pendingEnd?'SPIN':'COIN',CX,CY-9,'#38e8ff',18,'center',10);
    ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=14;
    ctx.beginPath();
    ctx.moveTo(CX-14,CY-R-8);ctx.lineTo(CX+14,CY-R-8);ctx.lineTo(CX,CY-R-26);
    ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#ffd93b';ctx.lineWidth=5;ctx.globalAlpha=0.35;
    ctx.beginPath();
    ctx.arc(CX,CY,R-26,-Math.PI/2,-Math.PI/2+charge*TWO);
    ctx.stroke();
    ctx.globalAlpha=1;
    for(i=0;i<parts.length;i++){
      var q=parts[i];
      ctx.globalAlpha=Math.max(0,Math.min(1,q.life*1.8));
      ctx.shadowColor=q.c;ctx.shadowBlur=10;ctx.fillStyle=q.c;
      ctx.fillRect(q.x-2.5,q.y-2.5,5,5);
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
    for(i=0;i<pops.length;i++){
      var po=pops[i];
      ctx.globalAlpha=Math.max(0,Math.min(1,po.life*1.5));
      neonText(po.txt,po.x,po.y,po.c,16,'center',10);
      ctx.globalAlpha=1;
    }
    if(mult>1){
      neonText('BONUS x'+mult+' ACTIVE',CX,CY+R+16,'#ff5cf0',14,'center',12);
    }
    ctx.save();
    for(var si=0;si<3;si++){
      var sx2=120+si*30;
      ctx.globalAlpha=si<spins?1:0.2;
      ctx.shadowColor='#38e8ff';ctx.shadowBlur=10;
      ctx.strokeStyle='#38e8ff';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(sx2,64,9,0,TWO);ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle='#38e8ff';
      ctx.font='bold 9px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('SPIN',sx2,64);
      ctx.globalAlpha=1;
    }
    ctx.restore();
    if(msg&&(state!=='idle'||pendingEnd)){
      neonText(msg,CX,CY+R+76,'#ffd93b',16,'center',12);
    }
    neonText('LUCKY SPIN',12,8,'#ff5cf0',15,'left',10);
    ctx.save();
    ctx.font='10px "Courier New",monospace';
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('HOLD: POWER UP • RELEASE: SPIN • BONUSES STACK',12,26);
    ctx.restore();
    neonText(String(score),W-14,8,'#ffd93b',26,'right',14);
    ctx.save();
    ctx.font='bold 13px "Courier New",monospace';
    ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillStyle='#ffd93b';
    ctx.fillText('COINS x'+coins,W-14,40);
    ctx.restore();
    if(pendingEnd){
      neonText('GAME OVER!',W/2,110,'#ff3b5c',34,'center',20);
      neonText('FINAL SCORE '+score+'  •  '+coins+' COINS',W/2,150,'#fff',14,'center',8);
    }
  }
  function loop(ts){
    if(!running)return;
    var dt=Math.min((ts-last)/1000,0.05);
    last=ts;
    update(dt);
    draw();
    if(!over){raf=requestAnimationFrame(loop);}else{running=false;}
  }
  function start(){
    reset();
    reported=false;over=false;
    if(!running){
      running=true;
      last=performance.now();
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(loop);
    }
  }
  function pause(){
    running=false;
    cancelAnimationFrame(raf);
  }
  function resume(){
    if(!over&&!running){
      running=true;
      last=performance.now();
      raf=requestAnimationFrame(loop);
    }
  }
  function destroy(){
    running=false;over=true;
    cancelAnimationFrame(raf);
    keys={};touches={};
  }
  return {
    start:start,pause:pause,resume:resume,destroy:destroy,
    setInput:function(t,k){touches=t;keys=k;},
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}