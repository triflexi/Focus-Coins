import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {WHEEL,RED_NUMBERS,towerPayout,cents,type Dashboard,type Round,type RouletteBet} from '@focus/core';
import {Button,Panel,Table,fmt,date} from './ui';

const names:Record<string,string>={roulette:'Рулетка',wheel:'Колесо фортуны',tower:'Башня'};
const art:Record<string,string>={roulette:'/assets/2-150-img37.svg',wheel:'/assets/2-150-img.svg',tower:'/assets/2-150-img1.svg'};
// Clockwise from green. The export starts at the top boundary of sector zero.
const EUROPEAN_ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const normalize=(angle:number)=>(angle%360+360)%360;
type Phase='idle'|'request'|'spin'|'reveal';
interface Props {data:Dashboard;game:string;setGame:(g:string)=>void;busy:boolean;result:Round|null;play:(g:string,stake:string,bet?:RouletteBet)=>Promise<Round|undefined>;pick:(c:number)=>Promise<void>;collect:()=>Promise<void>}

function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  return reduced;
}

function SpinWheel({kind,rotation,duration,spinning,shown}:{kind:string;rotation:number;duration:number;spinning:boolean;shown:Round|null}){
  const roulette=kind==='roulette';
  const style={'--spin-rotation':`${rotation}deg`,'--spin-duration':`${duration}ms`} as CSSProperties;
  const value=spinning?'···':shown?roulette?String((shown.result as {number:number}).number):`×${(shown.result as {multiplier:number}).multiplier}`:roulette?'0–36':'× ?';
  return <div className={`wheel-art spin-wheel ${roulette?'roulette-wheel':'fortune-wheel'} ${spinning?'is-spinning':''}`} style={style}>
    <div className="wheel-disc-viewport" aria-hidden="true"><div className="wheel-disc">
      <img src={roulette?'/assets/2-151-img37.svg':'/assets/2-152-img.svg'} alt=""/>
      {roulette&&<><i className="embedded-pointer-cover"/>{EUROPEAN_ORDER.map((number,index)=>{
        const angle=(index+.5)*360/37,radians=angle*Math.PI/180;
        return <span className="wheel-pocket" key={number} style={{left:`${50+34*Math.sin(radians)}%`,top:`${50-34*Math.cos(radians)}%`,transform:`translate(-50%, -50%) rotate(${angle}deg)`}}>{number}</span>;
      })}</>}
    </div></div>
    <i className="wheel-rim" aria-hidden="true"/><i className="pointer" aria-hidden="true"/>
    <span className="wheel-center" aria-hidden="true">{value}</span>
    <span className="sr-only">{roulette?'Европейское колесо: числа от 0 до 36.':'Колесо: ×0 — 50%, ×1 — 30%, ×2 — 15%, ×5 — 4%, ×15 — 1%.'}</span>
  </div>;
}

export function Games(p:Props){
  const {data,game,setGame,busy,result,play,pick,collect}=p;
  const [stake,setStake]=useState('1'),[bet,setBet]=useState<RouletteBet>({type:'black'}),[phase,setPhase]=useState<Phase>('idle'),[rotation,setRotation]=useState(0),[duration,setDuration]=useState(0),[pendingCell,setPendingCell]=useState<number|null>(null),[spinningRound,setSpinningRound]=useState<string|null>(null),[shown,setShown]=useState<Round|null>(null);
  const reduced=useReducedMotion(),generation=useRef(0),locked=useRef(false),rotationRef=useRef(0),waits=useRef(new Map<ReturnType<typeof setTimeout>,(active:boolean)=>void>());
  const valid=/^\d+(\.\d{1,2})?$/.test(stake)&&Number(stake)>=1&&Number(stake)<=Number(data.balance),animating=phase!=='idle',blocked=busy||animating;
  useEffect(()=>{
    generation.current++;locked.current=false;rotationRef.current=0;
    setPhase('idle');setRotation(0);setDuration(0);setPendingCell(null);setSpinningRound(null);setShown(null);
    return()=>{generation.current++;locked.current=false;for(const [timer,resolve] of waits.current){clearTimeout(timer);resolve(false);}waits.current.clear();};
  },[game]);
  const wait=(milliseconds:number)=>new Promise<boolean>(resolve=>{const timer=setTimeout(()=>{waits.current.delete(timer);resolve(true);},milliseconds);waits.current.set(timer,resolve);});
  const begin=()=>{if(blocked||locked.current)return null;locked.current=true;setPhase('request');return generation.current;};
  const finish=(token:number)=>{if(token===generation.current){locked.current=false;setPhase('idle');setPendingCell(null);setSpinningRound(null);}};
  const spin=async()=>{
    if(!valid)return;const token=begin();if(token===null)return;
    try{
      const round=await play(game,stake,game==='roulette'?bet:undefined);
      if(!round||token!==generation.current)return;
      if(game==='tower'){setShown(round);return;}
      const outcome=round.result as {number?:number;draw?:number};
      // Only the saved server outcome sets the landing angle. A 1% bucket's
      // centre stays away from borders, including the smallest prize sector.
      const angle=game==='roulette'?(EUROPEAN_ORDER.indexOf(outcome.number??0)+.5)*360/37:((outcome.draw??0)+.5)*3.6;
      const target=normalize(-angle),milliseconds=reduced?0:game==='roulette'?3400:3200;
      const next=reduced?target:rotationRef.current+4*360+normalize(target-normalize(rotationRef.current));
      rotationRef.current=next;setDuration(milliseconds);setRotation(next);setSpinningRound(round.id);setPhase('spin');
      if(milliseconds&&!(await wait(milliseconds+60)))return;
      if(token===generation.current)setShown(round);
    }finally{finish(token);}
  };
  const revealCell=async(cell:number)=>{
    const token=begin();if(token===null)return;setPendingCell(cell);
    try{await pick(cell);if(token!==generation.current)return;setPhase('reveal');if(!reduced)await wait(400);}finally{finish(token);}
  };
  const collectTower=async()=>{
    const token=begin();if(token===null)return;
    try{await collect();if(token!==generation.current)return;setPhase('reveal');if(!reduced)await wait(260);}finally{finish(token);}
  };

  if(!game)return <><div className="games-grid">{(['roulette','wheel','tower'] as const).map((g,i)=><Panel title={names[g].toUpperCase()} key={g}><div className="game-preview inset"><img src={art[g]} alt={names[g]}/></div><p>{['Цвет, чётность или одно число.\nЕвропейское колесо с одним нулём.','Одна ставка. Пять исходов.\nОт ×0 до ×15 за одно вращение.','Выберите безопасную клетку.\nЗаберите выигрыш или идите выше.'][i]}</p><small>{['Возврат в среднем: 97,3%','Возврат в среднем: 95%','8 этажей · 3 безопасные из 4'][i]}</small><Button onClick={()=>setGame(g)}>Открыть игру</Button><small>{i===2?'Ставку можно забрать между этажами.':'От 1 монеты до доступного баланса.'}</small></Panel>)}</div><Panel title="ИСТОРИЯ ИГР"><Table heads={['Игра','Ставка','Выплата','Чистый результат','Время']} rows={data.rounds.filter(r=>r.status!=='active').slice(0,20).map(r=>[names[r.kind],fmt(r.stake),<span className="gold">{fmt(r.payout)}</span>,<span className={Number(r.net)>=0?'mint':'loss'}>{Number(r.net)>0?'+':''}{fmt(r.net)}</span>,date(r.createdAt)])}/><small>Монеты виртуальные: их нельзя покупать, выводить или передавать.</small></Panel></>;
  const tower=data.tower??(game==='tower'&&result?.kind==='tower'?data.rounds.find(r=>r.id===result.id)??result:null),stakeBig=(()=>{try{return cents(tower?.stake??stake);}catch{return 0n;}})(),cash=tower?String(Number(towerPayout(stakeBig,tower.floors))/100):'0';
  const visibleResult=game==='tower'?tower&&(tower.status!=='active'||tower.floors>0)?tower:null:shown?.kind===game?shown:null;
  const statusText=phase==='request'?'Сохраняем результат…':phase==='spin'?'Колесо вращается…':phase==='reveal'?'Открываем результат…':'';
  return <><div className="two-col game-detail" aria-busy={blocked}><Panel title={game==='roulette'?'ЕВРОПЕЙСКАЯ РУЛЕТКА':game==='wheel'?'ПЯТЬ ВОЗМОЖНЫХ ИСХОДОВ':`ПРОЙДЕНО ${tower?.floors??0} ИЗ 8 ЭТАЖЕЙ`}>
    {game==='roulette'&&<><div className="roulette-display inset"><SpinWheel kind={game} rotation={rotation} duration={duration} spinning={phase==='spin'} shown={shown}/><div><h3>37 чисел. Одна ставка.</h3><p className="mint mono">Цвет / чётность · ×2</p><p className="gold mono">Одно число · ×36</p><p>Ноль — зелёный. Ставки на цвет и чётность при нуле проигрывают.</p><small>Возврат в среднем: 97,3%</small></div></div><div className="roulette-grid"><button className={`zero ${bet.type==='number'&&bet.number===0?'chosen':''}`} disabled={blocked} onClick={()=>setBet({type:'number',number:0})}>0</button>{Array.from({length:36},(_,i)=>i+1).map(n=><button key={n} className={`${RED_NUMBERS.includes(n)?'red-number':'black-number'} ${bet.type==='number'&&bet.number===n?'chosen':''}`} disabled={blocked} onClick={()=>setBet({type:'number',number:n})}>{n}</button>)}</div><div className="row last-results"><small>ПОСЛЕДНИЕ</small>{data.rounds.filter(r=>r.kind==='roulette'&&r.id!==spinningRound).slice(0,20).map(r=>{const n=(r.result as {number:number}).number;return <span className={`result-number ${n===0?'zero':RED_NUMBERS.includes(n)?'red-number':'black-number'}`} key={r.id}>{n}</span>;})}</div><small>Прошлые результаты не меняют вероятность следующего вращения.</small></>}
    {game==='wheel'&&<><div className="fortune-display inset"><SpinWheel kind={game} rotation={rotation} duration={duration} spinning={phase==='spin'} shown={shown}/></div><div className="wheel-legend">{WHEEL.map((s,i)=><span className={`sector-${i}`} key={s.multiplier}>×{s.multiplier} · {s.chance}%</span>)}</div><small className="center">Размеры секторов соответствуют вероятностям.</small></>}
    {game==='tower'&&<><p className="mint">{tower?.status==='active'?`Выберите клетку ${tower.floors+1}-го этажа`:tower?.status==='lost'?'Опасная клетка. Раунд завершён.':'Начните раунд и поднимайтесь выше'}</p><div className="tower-grid">{Array.from({length:8},(_,i)=>8-i).map(floor=><div key={floor} className={tower?.status==='active'&&floor===tower.floors+1?'current-floor':''}><small>{String(floor).padStart(2,'0')} этаж</small>{[0,1,2,3].map(cell=>{const chosen=tower?.picks[floor-1]===cell,safe=chosen&&floor<=tower!.floors,lost=chosen&&tower?.status==='lost'&&floor===tower.floors+1,pending=phase==='request'&&pendingCell===cell&&tower?.status==='active'&&floor===tower.floors+1;return <button key={cell} aria-label={`${floor}-й этаж, клетка ${cell+1}${safe?', безопасная':lost?', опасная':''}`} className={`inset tower-cell ${safe?'safe':''} ${lost?'danger':''} ${pending?'is-pending':''}`} disabled={blocked||!tower||tower.status!=='active'||floor!==tower.floors+1} onClick={()=>revealCell(cell)}><span className="tower-symbol">{safe?'✓':lost?'×':pending?'···':tower?.status==='active'&&floor===tower.floors+1?'?':'−'}</span></button>;})}<small>×{(Number(towerPayout(1000000n,floor))/1000000).toFixed(2)}</small></div>)}</div><small>На каждом этаже: 3 безопасные клетки и 1 проигрышная.</small></>}
  </Panel><Panel title={game==='tower'&&tower?.status==='active'?'ТЕКУЩИЙ РАУНД':'СТАВКА И ВЫПЛАТЫ'}>
    {game==='tower'&&tower?.status==='active'?<><small>Можно забрать</small><strong className="big gold">{fmt(cash)}</strong><p className="mint">Чистая прибыль: {fmt(Number(cash)-Number(tower.stake))} монет</p><Button primary disabled={blocked||!tower.floors} onClick={collectTower}>Забрать {fmt(cash)}</Button><hr/><div className="stat-line"><span>Ставка</span><span>{fmt(tower.stake)}</span></div><div className="stat-line"><span>Пройдено</span><span>{tower.floors} / 8</span></div><small>{fmt(data.reserved)} монет зарезервировано и учитывается в рейтинге.</small><small>Автозабор: {date(tower.expiresAt)}</small></>:<><label>Размер ставки · доступно {fmt(data.balance)}<input aria-label="Размер ставки" inputMode="decimal" value={stake} onChange={e=>setStake(e.target.value.replace(',','.'))} disabled={blocked}/></label><div className="row bet-tools"><Button disabled={blocked} onClick={()=>setStake((Math.max(1,Math.floor(Number(stake)*50)/100)).toFixed(2))}>½</Button><Button disabled={blocked} onClick={()=>setStake(Math.min(Number(data.balance),Number(stake)*2).toFixed(2))}>×2</Button><Button disabled={blocked} onClick={()=>setStake(data.balance)}>Всё</Button><small>монет</small></div><hr/>{game==='roulette'?<><b>Тип ставки</b><div className="bet-options">{(['red','black','even','odd','number'] as const).map((t,i)=><Button key={t} selected={bet.type===t} disabled={blocked} onClick={()=>setBet({type:t,...(t==='number'?{number:0}:{})})}>{['Красное','Чёрное','Чётное','Нечётное','Число'][i]}</Button>)}</div>{bet.type==='number'&&<label>Число 0–36<input type="number" min={0} max={36} value={bet.number??0} disabled={blocked} onChange={e=>setBet({type:'number',number:Number(e.target.value)})}/></label>}<small>Шанс: {bet.type==='number'?'1/37 ≈ 2,7%':'18/37 ≈ 48,6%'}</small><div className="notice-inset">При выигрыше<strong className="gold">{fmt(Number(stake)*(bet.type==='number'?36:2))} / ×{bet.type==='number'?36:2}</strong></div></>:game==='wheel'?<><b>Все исходы при ставке {stake}</b><Table heads={['Шанс','Исход','Выплата']} rows={WHEEL.map(s=>[`${s.chance}%`,`×${s.multiplier}`,<span className="gold">{fmt(Number(stake)*s.multiplier)}</span>])}/></>:<p>8 этажей, 4 клетки. Заберите промежуточный выигрыш после безопасной клетки.</p>}<Button primary disabled={blocked||!valid||game==='roulette'&&bet.type==='number'&&(!Number.isInteger(bet.number)||bet.number!<0||bet.number!>36)} onClick={spin}>{animating?statusText:busy?'Подключение…':game==='tower'?`Начать · ${stake} монет`:`Крутить · ${stake} монет`}</Button>{!valid&&<small>Ставка: от 1 монеты до доступного баланса.</small>}</>}
    <div className="game-feedback" aria-live="polite" aria-atomic="true">
      {animating?<div className="game-motion-status"><i aria-hidden="true"/>{statusText}</div>:visibleResult&&<div key={`${visibleResult.id}:${visibleResult.floors}:${visibleResult.status}`} className={`game-result ${Number(visibleResult.payout)>0||visibleResult.status==='active'?'mint':'loss'}`}>{visibleResult.kind==='tower'&&visibleResult.status==='active'?'Безопасная клетка!':visibleResult.status==='lost'?'Опасная клетка. Выплата 0.':`Выплата ${fmt(visibleResult.payout)} · результат ${fmt(visibleResult.net)}`}{visibleResult.kind==='roulette'&&<p>Выпало {(visibleResult.result as {number:number}).number}</p>}{visibleResult.kind==='wheel'&&<p>Множитель ×{(visibleResult.result as {multiplier:number}).multiplier}</p>}</div>}
    </div>
  </Panel></div><div className="notice-inset"><b>{game==='tower'?'Продолжить или забрать?':'Одна ставка — одно вращение'}</b><p>{game==='tower'?'Следующая безопасная клетка увеличит выплату. На 8-м этаже выигрыш забирается автоматически.':game==='wheel'?'×0: ставка не возвращается. ×1: возвращается ставка. ×2, ×5 и ×15: возвращается ставка с выигрышем.':'Все множители включают возврат ставки. Ноль проигрывает для цвета и чётности.'}</p><small>Монеты виртуальные. Покупка, вывод и передача недоступны.</small></div></>;
}
