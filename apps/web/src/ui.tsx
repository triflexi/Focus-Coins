import type {ReactNode,ButtonHTMLAttributes} from 'react';
export type IconName='coin'|'timer'|'stats'|'games'|'rating'|'profile';
const icons={coin:'imgFrame',timer:'imgFrame4',stats:'imgFrame3',games:'imgFrame2',rating:'imgFrame1',profile:'imgFrame5'};
const lightIcons={coin:'imgFrame',timer:'imgFrame1',stats:'imgFrame2',games:'imgFrame3',rating:'imgFrame4',profile:'imgFrame5'};
export function Icon({name,size=28,light=false,active=false}:{name:IconName;size?:number;light?:boolean;active?:boolean}){
  const prefix=light?'13-1537':'2-146';
  const src=active&&name==='games'?'/assets/2-150-imgFrame4.svg':active&&name==='stats'?'/assets/2-149-imgFrame4.svg':active&&name==='rating'?'/assets/2-154-imgFrame5.svg':active&&name==='profile'?'/assets/2-155-imgFrame6.svg':active&&name==='timer'?'/assets/2-146-imgFrame4.svg':!light&&name==='timer'?'/assets/2-150-imgFrame3.svg':`/assets/${prefix}-${(light?lightIcons:icons)[name]}.svg`;
  return <span className="icon" style={{width:size,height:size}} aria-hidden="true"><img src={src} alt=""/></span>;
}
export function Panel({title,children,className=''}:{title:string;children:ReactNode;className?:string}){return <section className={`panel ${className}`}><h2 className="panel-title">{title}</h2><div className="panel-body">{children}</div></section>;}
export function Button({children,primary=false,selected=false,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{primary?:boolean;selected?:boolean}){return <button className={`button ${primary?'primary':''} ${selected?'pressed':''} ${className}`} {...props}>{children}</button>;}
export function Segments({value,total=25}:{value:number;total?:number}){return <div className="segments" role="progressbar" aria-label="Прогресс" aria-valuenow={Math.min(value,total)} aria-valuemin={0} aria-valuemax={total}>{Array.from({length:20},(_,i)=><i key={i} className={i<value/total*20?'filled':''}/>)}</div>;}
export const fmt=(value:string|number)=>Number(value).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
export const date=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Yekaterinburg',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export function Metric({label,value,note}:{label:string;value:ReactNode;note:string}){return <div className="metric bevel"><small>{label}</small><strong>{value}</strong><small>{note}</small></div>;}
export function Table({heads,rows,empty='Пока здесь пусто'}:{heads:string[];rows:ReactNode[][];empty?:string}){return <div className="table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={heads.length} className="empty">{empty}</td></tr>}</tbody></table></div>;}
