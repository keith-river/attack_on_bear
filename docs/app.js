(function(){
  "use strict";

  // ---------------- DATA ----------------
  const ACTIONS = [
    {id:'freeze', label:'死んだふりをする', icon:'🧍', base:0,  good:['protect','guard'],      bad:['hungry','irritated'],
      tip:'死んだふりは防御的に威嚇する熊にはある程度の効果が期待できますが、空腹の熊には逆効果になり得ます。'},
    {id:'yell', label:'大声で威嚇する', icon:'📢', base:-1, good:['bored','indifferent','curious'], bad:['irritated','protect','guard'],
      tip:'こちらに気づいていない熊への存在アピールには有効な場面もありますが、興奮させると逆効果です。'},
    {id:'backaway', label:'目を離さず後ずさりする', icon:'🚶', base:2, good:['guard','unguarded','protect','indifferent'], bad:[],
      tip:'クマから目を離さずゆっくり後ずさるのは、多くの専門機関が推奨する基本行動です。'},
    {id:'punch', label:'鼻にパンチを入れる', icon:'👊', base:-3, good:[], bad:['hungry','irritated','protect','guard'],
      tip:'反撃は最終手段。むやみな攻撃はクマを興奮させ、重大な被害につながる危険があります。'},
    {id:'run', label:'背を向けて猛ダッシュで逃げる', icon:'🏃', base:-3, good:[], bad:['hungry','curious','protect'],
      tip:'背を向けて走ると追跡本能を刺激するため、走って逃げるのは避けるべきとされています。'},
    {id:'spray', label:'熊よけスプレイを探す', icon:'🧴', base:1, good:['hungry','irritated','protect'], bad:['bored'],
      tip:'熊よけスプレーは有効な防御手段ですが、とっさに取り出せるかどうかが鍵になります。'},
    {id:'feed', label:'餌をあげる', icon:'🍖', base:-2, good:[], bad:['hungry','protect','guard'],
      tip:'餌付けはクマを人里に慣れさせ、将来的な被害を増やす危険な行為です。絶対に避けましょう。'},
    {id:'noise', label:'音の鳴る道具を使う', icon:'🔔', base:1, good:['bored','indifferent','curious'], bad:['protect'],
      tip:'音による存在アピールは、突発的な遭遇そのものを防ぐ予防策として有効とされます。'},
    {id:'aura', label:'戦闘オーラを出す', icon:'🔥', base:-2, good:[], bad:['irritated','protect','guard'],
      tip:'過剰に威嚇的な態度を示すと、クマを挑発してしまう可能性があります。'},
    {id:'cry', label:'戦意喪失で泣き出す', icon:'😭', base:-1, good:['unguarded'], bad:['hungry','protect'],
      tip:'パニックは状況を悪化させがちです。まずは深呼吸をして、冷静な行動を心がけましょう。'},
  ];

  const EMOTIONS = [
    {id:'hungry',      label:'空腹'},
    {id:'guard',        label:'警戒'},
    {id:'irritated',    label:'いらだち'},
    {id:'unguarded',    label:'無防備'},
    {id:'bored',        label:'退屈'},
    {id:'protect',      label:'子供を守る気満々'},
    {id:'curious',      label:'好奇心'},
    {id:'indifferent',  label:'無関心'},
  ];

  const ENVS = [
    {id:'nature',  label:'自然豊か',        bias:1},
    {id:'quiet',   label:'静か',            bias:1},
    {id:'noisy',   label:'喧噪（人里が近い）', bias:-1},
    {id:'human',   label:'人間のテリトリ',    bias:-1},
    {id:'stress',  label:'ストレスフル',      bias:-1},
    {id:'hot',     label:'暑い',            bias:0},
    {id:'bright',  label:'明るい',          bias:0},
    {id:'dark',    label:'暗い',            bias:-1},
    {id:'dawn',    label:'明け方',          bias:0},
    {id:'dusk',    label:'夕方',            bias:0},
    {id:'night',   label:'夜',              bias:-1},
    {id:'day',     label:'昼',              bias:1},
  ];

  const BEAR_MOVES = {
    great:['逃げる','木に登る','首をかしげる'],
    good:['後ずさる','川を泳ぐ','首をかしげる'],
    meh:['対峙する','唸る','近寄る'],
    bad:['襲い掛かる','近寄る','唸る'],
  };

  const DIFFICULTY = {
    easy:   {label:'かんたん', timeMs:5200, diceRange:1, dmgMult:0.7},
    normal: {label:'ふつう',   timeMs:3400, diceRange:1, dmgMult:1.0},
    hard:   {label:'むずかしい', timeMs:2200, diceRange:2, dmgMult:1.4},
  };

  const CLEAR_SCORE = 100;
  const MAX_HP = 100;

  // ---------------- STATE ----------------
  let state = {};

  function resetState(diff){
    state = {
      diff,
      hp: MAX_HP,
      score: 0,
      round: 1,
      history: [],
      timer: null,
      startTs: 0,
      totalMs: 0,
      raf: null,
      locked: false,
    };
  }

  // ---------------- HELPERS ----------------
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function judgeAction(action, emotion, env, diffCfg){
    let score = action.base;
    if(action.good.includes(emotion.id)) score += 2;
    if(action.bad.includes(emotion.id)) score -= 2;
    score += env.bias;
    const r = diffCfg.diceRange;
    const dice = Math.floor(Math.random()*(2*r+1)) - r;
    score += dice;
    let tier;
    if(score >= 3) tier='great';
    else if(score >= 1) tier='good';
    else if(score >= -1) tier='meh';
    else tier='bad';
    return {score, tier};
  }

  const TIER_META = {
    great:{badge:'GREAT! 的確', pt:15, dmg:[0,0], text:(a,e)=>`${a}は状況にぴったり合っていた。クマは警戒を解き、${e}。`},
    good: {badge:'GOOD まずまず', pt:8,  dmg:[0,6], text:(a,e)=>`${a}は概ね有効だった。クマは${e}。`},
    meh:  {badge:'様子見', pt:-2, dmg:[6,14], text:(a,e)=>`${a}は決め手に欠けた。クマは${e}。`},
    bad:  {badge:'不適切', pt:-12, dmg:[16,32], text:(a,e)=>`${a}は逆効果だった。クマは${e}。`},
  };

  // ---------------- DOM refs ----------------
  const el = (id)=>document.getElementById(id);
  const screens = {
    title: el('screen-title'),
    game: el('screen-game'),
    end: el('screen-end'),
  };
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  let selectedDiff = 'easy';
  el('diffSelect').addEventListener('click', (e)=>{
    const btn = e.target.closest('.diff-btn');
    if(!btn) return;
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedDiff = btn.dataset.diff;
  });

  el('startBtn').addEventListener('click', ()=>{
    resetState(selectedDiff);
    showScreen('game');
    nextRound();
  });

  el('retryBtn').addEventListener('click', ()=>{
    showScreen('title');
  });

  el('continueBtn').addEventListener('click', ()=>{
    el('resultOverlay').classList.remove('active');
    if(state.hp <= 0 || state.score >= CLEAR_SCORE){
      finishGame();
    } else {
      state.round += 1;
      nextRound();
    }
  });

  // ---------------- ROUND FLOW ----------------
  function updateHud(){
    el('hpFill').style.width = clamp(state.hp,0,MAX_HP) + '%';
    el('scoreVal').textContent = clamp(state.score,0,9999);
    el('roundVal').textContent = state.round;
    el('targetScore').textContent = CLEAR_SCORE;
  }

  function renderActionGrid(){
    const grid = el('actionGrid');
    grid.innerHTML = '';
    shuffle(ACTIONS).forEach(a=>{
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = `<span class="icon">${a.icon}</span><span>${a.label}</span>`;
      btn.addEventListener('click', ()=>onActionChosen(a));
      grid.appendChild(btn);
    });
  }

  function disableGrid(){
    document.querySelectorAll('.action-btn').forEach(b=>b.disabled = true);
  }

  function nextRound(){
    state.locked = false;
    updateHud();

    const emotion = pick(EMOTIONS);
    const env = pick(ENVS);
    state.currentEmotion = emotion;
    state.currentEnv = env;

    el('emotionTag').textContent = emotion.label;
    el('envTag').textContent = env.label;
    el('sceneText').textContent = `${env.label}な森の中で、${emotion.label}な様子のクマと遭遇した！ とっさにどう動く？`;

    renderActionGrid();
    startTimer();
  }

  function startTimer(){
    const diffCfg = DIFFICULTY[state.diff];
    // add a little randomness to the limit each round to keep it unpredictable
    const jitter = (Math.random()*600) - 300;
    const totalMs = Math.max(1200, diffCfg.timeMs + jitter);
    state.totalMs = totalMs;
    state.startTs = performance.now();

    const ring = el('timerRing');
    const val = el('timerVal');

    function tick(now){
      if(state.locked) return;
      const elapsed = now - state.startTs;
      const remain = Math.max(0, totalMs - elapsed);
      const pct = (remain/totalMs)*100;
      ring.style.setProperty('--pct', pct.toFixed(1));
      ring.classList.toggle('danger', pct < 30);
      val.textContent = (remain/1000).toFixed(1);
      if(remain <= 0){
        onTimeout();
        return;
      }
      state.raf = requestAnimationFrame(tick);
    }
    state.raf = requestAnimationFrame(tick);
  }

  function stopTimer(){
    if(state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  function onTimeout(){
    if(state.locked) return;
    state.locked = true;
    stopTimer();
    disableGrid();
    resolveRound(null, true);
  }

  function onActionChosen(action){
    if(state.locked) return;
    state.locked = true;
    stopTimer();
    disableGrid();
    resolveRound(action, false);
  }

  function resolveRound(action, timedOut){
    const diffCfg = DIFFICULTY[state.diff];
    const emotion = state.currentEmotion;
    const env = state.currentEnv;

    let tier, judged;
    if(timedOut){
      tier = 'bad';
      judged = {score:-99, tier};
    } else {
      judged = judgeAction(action, emotion, env, diffCfg);
      tier = judged.tier;
    }

    const meta = TIER_META[tier];
    const bearMove = pick(BEAR_MOVES[tier]);
    const dmgRange = meta.dmg;
    const rawDmg = dmgRange[1] > 0 ? Math.round((dmgRange[0] + Math.random()*(dmgRange[1]-dmgRange[0])) * diffCfg.dmgMult) : 0;

    state.score = Math.max(0, state.score + meta.pt);
    state.hp = clamp(state.hp - rawDmg, 0, MAX_HP);

    const actionLabel = timedOut ? '反応できず立ちすくんだ' : action.label;
    const resultSentence = meta.text(actionLabel, bearMove + '。');

    state.history.push({
      round: state.round,
      emotion: emotion.label,
      env: env.label,
      action: timedOut ? null : action,
      actionLabel,
      tier,
      dmg: rawDmg,
      pt: meta.pt,
      timedOut,
    });

    // show overlay
    const badge = el('resultBadge');
    badge.textContent = meta.badge;
    badge.className = 'result-badge ' + tier;
    el('resultText').textContent = resultSentence;
    const ptEl = el('ptDelta');
    ptEl.textContent = (meta.pt>=0?'+':'') + meta.pt + ' pt';
    ptEl.className = meta.pt>=0 ? 'delta-pos' : 'delta-neg';
    el('dmgDelta').textContent = '-' + rawDmg + ' dmg';

    updateHud();
    el('resultOverlay').classList.add('active');
  }

  function finishGame(){
    const cleared = state.hp > 0 && state.score >= CLEAR_SCORE;
    const banner = el('endBanner');
    banner.textContent = cleared ? 'GAME CLEAR クマをやり過ごした！' : 'GAME OVER 力尽きた…';
    banner.className = 'end-banner ' + (cleared ? 'clear' : 'over');

    el('endScore').textContent = clamp(state.score,0,9999);
    el('endRounds').textContent = state.round;

    const list = el('reviewList');
    list.innerHTML = '';
    state.history.forEach(h=>{
      const item = document.createElement('div');
      item.className = 'review-item';
      const tipText = h.timedOut
        ? '反射的に動けないのも実際によくあることです。日頃から「後ずさりする」という基本行動をイメージトレーニングしておきましょう。'
        : h.action.tip;
      item.innerHTML = `
        <div class="review-head">
          <b>R${h.round} ｜ ${h.emotion}のクマ ｜ ${h.env}</b>
          <span class="rjudge ${h.tier}">${TIER_META[h.tier].badge}</span>
        </div>
        <div>選んだ行動：${h.actionLabel}</div>
        <div class="review-tip">${tipText}</div>
      `;
      list.appendChild(item);
    });

    showScreen('end');
  }

})();
