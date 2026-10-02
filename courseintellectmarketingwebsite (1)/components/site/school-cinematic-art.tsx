"use client"

import { useId, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion"
import { ArrowUpRight, Bell, BookOpen, Check, GraduationCap, PieChart, TrendingUp, Users } from "lucide-react"
import { brainProcesses, smoothRange, type BrainProcess } from "@/lib/school-brain"
import { roles, type RoleId } from "@/lib/site-experience-data"

const root = "/images/brain-cinematic-v3/"
const icons = {lessons:BookOpen,students:Users,teachers:GraduationCap,parents:Bell,finance:TrendingUp,management:PieChart}
const paths = [
  "M610 580 C540 580 545 365 355 365", "M595 610 C525 610 520 540 355 540",
  "M595 635 C500 635 535 715 355 715", "M830 580 C905 580 885 365 1085 365",
  "M845 610 C925 610 925 540 1085 540", "M845 635 C940 635 905 715 1085 715",
]

function Tile({ process, progress, index, interactive, onFailure }: {process:BrainProcess; progress:MotionValue<number>; index:number; interactive:boolean; onFailure:()=>void}) {
  const opacity = useTransform(progress,p=>smoothRange(p,process.start,process.start+.10)*(1-smoothRange(p,.66,.83)))
  const rise = useTransform(opacity,[0,1],[28,0])
  const scale = useTransform(opacity,[0,1],[.84,1])
  const Icon = icons[process.id]
  return <motion.div className={`standalone-island standalone-island-${index}`} style={{opacity,y:rise,scale}} inert={!interactive}>
    <Link href={process.href} aria-label={`${process.label} deneyimini keşfet`}>
      <span className={`standalone-island-title standalone-${process.id}`}><i><Icon size={18}/></i>{process.label}</span>
      <div className="standalone-island-object"><Image src={`${root}${process.id}.webp`} alt="" fill sizes="(max-width:760px) 46vw, 28vw" onError={onFailure}/></div>
    </Link>
  </motion.div>
}

function Flow({ process, progress, index, compact, prefix }: {process:BrainProcess; progress:MotionValue<number>; index:number; compact:boolean; prefix:string}) {
  const opacity=useTransform(progress,p=>smoothRange(p,process.start-.03,process.start+.10)*(1-smoothRange(p,.65,.81)))
  const length=useTransform(progress,p=>smoothRange(p,process.start-.03,process.start+.10))
  const x=index<3?100:290,y=442+index%3*133
  const d=compact?`M195 330 C195 ${y-40} ${x+Math.sign(195-x)*40} ${y-70} ${x} ${y}`:paths[index]
  const blue=process.id==="students"||process.id==="parents"||process.id==="management"
  return <motion.g style={{opacity}}>
    <motion.path d={d} stroke={blue?"#1256d0":"#d57112"} strokeWidth={compact?5:8} opacity=".17" fill="none" strokeLinecap="round" style={{pathLength:length}}/>
    <motion.path d={d} stroke={`url(#${prefix}-${blue ? "blue" : "orange"})`} strokeWidth={compact?2:3.5} fill="none" strokeLinecap="round" style={{pathLength:length}}/>
    <path className="standalone-flow-packet" d={d} pathLength="100" stroke="#fff9d9" strokeWidth={compact?3:4} strokeDasharray="3 100" fill="none" strokeLinecap="round" style={{animationDelay:`${index*-.7}s`}}/>
    <circle cx={compact?x:index<3?355:1085} cy={compact?y:index%3===0?365:index%3===1?540:715} r={compact?3:5} fill={blue?"#418bff":"#ffad35"}/>
  </motion.g>
}

export default function SchoolCinematicArt({ progress, compact, running, onReady, onFailure, role, story }: {progress:MotionValue<number>; compact:boolean; running:boolean; onReady:()=>void; onFailure:()=>void; role:RoleId; story:boolean}) {
  const reduced = useReducedMotion()
  const id = useId().replace(/:/g,"")
  const readyAssets=useRef(new Set<string>())
  const [interactive,setInteractive]=useState(progress.get()>.54 && progress.get()<.69)
  const interactiveRef=useRef(interactive)
  const [preloadIslands,setPreloadIslands]=useState(story && progress.get()>.04)
  const islandsLoaded=useRef(preloadIslands)
  useMotionValueEvent(progress,"change",p=>{
    const next=p>.54 && p<.69
    if(next!==interactiveRef.current) { interactiveRef.current=next; setInteractive(next) }
    if(story && !islandsLoaded.current && p>.04) {islandsLoaded.current=true;setPreloadIslands(true)}
  })
  function loaded(name:string) { readyAssets.current.add(name); if(readyAssets.current.size===2) onReady() }
  const coreX=useTransform(progress,[.64,.93],["0vw",compact?"-32vw":"-30vw"])
  const coreY=useTransform(progress,[0,.40,.64,.93],compact?["0vh","-26vh","-26vh","-25vh"]:["0vh","-3vh","-3vh","-29vh"])
  const coreScale=useTransform(progress,[0,.40,.64,.93],compact?[1,.56,.56,.25]:[1,.86,.86,.37])
  const coreOpacity=useTransform(progress,[.72,.93],compact?[1,0]:[1,1])
  const roleOpacity=useTransform(progress,[.69,.92],[0,1])
  const roleScale=useTransform(progress,[.69,.94],[.86,1])
  const selected=roles.find(item=>item.id===role)!
  const ordered=[brainProcesses[0],brainProcesses[1],brainProcesses[4],brainProcesses[2],brainProcesses[3],brainProcesses[5]]
  return <div className={`brain-cinematic standalone-cinematic${running ? "" : " is-paused"}`}>
    <Image className="standalone-hall" src={`${root}hall.webp`} alt="" fill sizes="100vw" priority onLoad={()=>loaded("hall")} onError={onFailure}/>
    <div className="standalone-floor-light" aria-hidden="true"/>
    {story && preloadIslands && <><svg className="standalone-flows" viewBox={compact?"0 0 390 780":"0 0 1440 830"} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`${id}-orange`}><stop stopColor="#ffa41b"/><stop offset=".48" stopColor="#fff0af"/><stop offset="1" stopColor="#ff7d00"/></linearGradient><linearGradient id={`${id}-blue`}><stop stopColor="#004ef8"/><stop offset=".5" stopColor="#a3e0ff"/><stop offset="1" stopColor="#006bff"/></linearGradient></defs>{ordered.map((process,index)=><Flow key={process.id} process={process} index={index} progress={progress} compact={compact} prefix={id}/>)}</svg><nav className="standalone-islands" aria-label="Okul süreçleri">{ordered.map((process,index)=><Tile key={process.id} process={process} index={index} progress={progress} interactive={interactive} onFailure={onFailure}/>)}</nav></>}
    <div className="standalone-core-anchor" aria-hidden="true">
      <motion.div className="standalone-core" style={{x:coreX,y:coreY,scale:coreScale,opacity:coreOpacity}}>
        <Image className="standalone-platform" src={`${root}core-platform.webp`} alt="" fill sizes="(max-width:760px) 82vw, 35vw" priority onLoad={()=>loaded("platform")} onError={onFailure}/>
        <div className="standalone-orbit"><i/><i/><i/></div>
        {!reduced && <div className="standalone-teleport-beam" aria-hidden="true"/>}
        {!reduced && <div className="standalone-teleport-flash" aria-hidden="true"/>}
        <motion.div
          className="standalone-logo-rise"
          initial={reduced ? false : {scale:.03,opacity:0,y:16,filter:"blur(16px)"}}
          animate={reduced ? {} : {scale:[.03,.5,1.08,.98,1],opacity:[0,.85,1,1,1],y:[16,2,-8,2,0],filter:["blur(16px)","blur(6px)","blur(1px)","blur(0px)","blur(0px)"]}}
          transition={{duration:2.3,delay:.55,ease:[.2,.75,.2,1],times:[0,.4,.7,.86,1]}}>
          <Image className="standalone-logo" src="/images/logo.png" alt="" width={945} height={955} priority/>
        </motion.div>
      </motion.div>
    </div>
    <motion.div className="standalone-role-layer" style={{opacity:roleOpacity,scale:roleScale}} aria-hidden="true">
      <AnimatePresence initial={false}><motion.div key={role==="ogretmen"?"teacher":"workspace"} className="standalone-role-composition" initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.55}}>
        {role==="ogretmen" ? <div className="standalone-teacher-book"><span className="standalone-book-label"><i><GraduationCap size={20}/></i>Öğretmenler</span><Image src={`${root}teachers.webp`} alt="" fill sizes="(max-width:760px) 94vw, 56vw" onError={onFailure}/></div> : <div className="standalone-workspace-shell"><Image src={`${root}workspace${compact ? "-mobile" : ""}.webp`} alt="" fill sizes="(max-width:760px) 94vw, 56vw" onError={onFailure}/><motion.div key={role} className="standalone-workspace-content" initial={reduced?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.35}} aria-label={`${selected.name} için temsili çalışma alanı`}>
          <div className="standalone-workspace-heading"><span>{selected.name}</span><small>Demo 1</small></div><h3>{selected.screen}</h3><div className="standalone-workspace-status"><i/> Günün akışı hazır</div><div className="standalone-workspace-tasks">{selected.features.slice(0,3).map((item,index)=><div key={item}><i><Check size={14}/></i><span>{item}</span><ArrowUpRight size={15}/><b style={{width:`${85-index*18}%`}}/></div>)}</div><div className="standalone-workspace-footer"><span>SchoolAsist</span><span>Temsili demo</span></div>
        </motion.div></div>}
      </motion.div></AnimatePresence>
    </motion.div>
  </div>
}
