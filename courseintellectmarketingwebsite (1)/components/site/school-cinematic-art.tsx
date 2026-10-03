"use client"

import { useId, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion"
import { Bell, BookOpen, BriefcaseBusiness, Bus, CalendarCheck, GraduationCap, HeartHandshake, MapPin, PieChart, TrendingUp, Users, Utensils } from "lucide-react"
import { brainProcesses, smoothRange, type BrainProcess } from "@/lib/school-brain"
import { type RoleId } from "@/lib/site-experience-data"

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
  const grad=`url(#${prefix}-${blue ? "blue" : "orange"})`
  const nx=compact?x:index<3?355:1085, ny=compact?y:index%3===0?365:index%3===1?540:715
  return <motion.g style={{opacity}}>
    {/* 1) Dış ışık halesi — fiber kablonun yaydığı parıltı */}
    <motion.path d={d} stroke={blue?"#3b86ff":"#ff9f32"} strokeWidth={compact?9:14} opacity=".42" fill="none" strokeLinecap="round" filter={`url(#${prefix}-bloom2)`} style={{pathLength:length}}/>
    {/* 2) Kablo gövdesi — renkli, hafif parlak */}
    <motion.path d={d} stroke={grad} strokeWidth={compact?3.4:5.4} opacity=".95" fill="none" strokeLinecap="round" filter={`url(#${prefix}-bloom)`} style={{pathLength:length}}/>
    {/* 3) İçteki ışık çekirdeği — kablonun içinden geçen ışık */}
    <motion.path d={d} stroke="#fffef9" strokeWidth={compact?1.3:2.1} opacity="1" fill="none" strokeLinecap="round" style={{pathLength:length}}/>
    {/* 4) Akan ışık darbeleri — iki hızda, glow CSS'te */}
    <path className="standalone-flow-packet" d={d} pathLength="100" stroke="#ffffff" strokeWidth={compact?3.4:4.6} strokeDasharray="2 100" fill="none" strokeLinecap="round" style={{animationDelay:`${index*-.7}s`}}/>
    <path className="standalone-flow-packet standalone-flow-packet-b" d={d} pathLength="100" stroke={blue?"#cde6ff":"#ffe4b4"} strokeWidth={compact?2:2.8} strokeDasharray="1.4 100" fill="none" strokeLinecap="round" style={{animationDelay:`${index*-.7-1.9}s`}}/>
    {/* uç düğümü — parlayan uç */}
    <circle cx={nx} cy={ny} r={compact?5:8} fill={blue?"#6fa8ff":"#ffc158"} opacity=".55" filter={`url(#${prefix}-bloom)`}/>
    <circle cx={nx} cy={ny} r={compact?2.6:4} fill={blue?"#cfe4ff":"#ffe6bd"}/>
    <circle cx={nx} cy={ny} r={compact?1.1:1.8} fill="#fff"/>
  </motion.g>
}

const roleIllustrations = {
  ogretmen: { label:"Öğretmenler", file:`${root}teachers.webp`, icon:GraduationCap },
  yonetici: { label:"Yönetim", file:"/images/brain-role-art/yonetici.webp", icon:PieChart },
  veli: { label:"Veliler", file:"/images/brain-role-art/veli.webp", icon:HeartHandshake },
  ogrenci: { label:"Öğrenciler", file:"/images/brain-role-art/ogrenci.webp", icon:GraduationCap },
  muhasebe: { label:"Muhasebe", file:"/images/brain-role-art/muhasebe.webp", icon:TrendingUp },
  personel: { label:"İdari Personel", file:"/images/brain-role-art/personel.webp", icon:BriefcaseBusiness },
  rehberlik: { label:"Rehberlik", file:"/images/brain-role-art/rehberlik.webp", icon:HeartHandshake },
  "sube-muduru": { label:"Şube Yönetimi", file:"/images/brain-role-art/sube-muduru.webp", icon:MapPin },
  yemekhane: { label:"Yemekhane", file:"/images/brain-role-art/yemekhane.webp", icon:Utensils },
  "servis-soforu": { label:"Servis", file:"/images/brain-role-art/servis-soforu.webp", icon:Bus },
} satisfies Record<RoleId, {label:string;file:string;icon:typeof CalendarCheck}>

function RoleIllustration({illustration,onFailure}: {illustration:typeof roleIllustrations[RoleId];onFailure:()=>void}) {
  const [loaded,setLoaded] = useState(false)
  const reduced = useReducedMotion()
  const Icon = illustration.icon
  return <div className="standalone-role-sculpture">
    <span className="standalone-role-art-label"><i><Icon size={20}/></i>{illustration.label}</span>
    <motion.div className="standalone-role-art-object" initial={false} animate={{opacity:loaded?1:0,y:loaded?0:10}} transition={{duration:reduced?0:.45}}>
      <Image src={illustration.file} alt="" fill sizes="(max-width:760px) 96vw, 59vw" onLoad={()=>setLoaded(true)} onError={onFailure}/>
    </motion.div>
  </div>
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
  const illustration = roleIllustrations[role]
  const ordered=[brainProcesses[0],brainProcesses[1],brainProcesses[4],brainProcesses[2],brainProcesses[3],brainProcesses[5]]
  return <div className={`brain-cinematic standalone-cinematic${running ? "" : " is-paused"}`}>
    <Image className="standalone-hall" src={`${root}hall.webp`} alt="" fill sizes="100vw" priority onLoad={()=>loaded("hall")} onError={onFailure}/>
    <div className="standalone-floor-light" aria-hidden="true"/>
    {story && preloadIslands && <><svg className="standalone-flows" viewBox={compact?"0 0 390 780":"0 0 1440 830"} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`${id}-orange`}><stop stopColor="#ff8f12"/><stop offset=".3" stopColor="#ffd27a"/><stop offset=".5" stopColor="#fff6e0"/><stop offset=".7" stopColor="#ffbe46"/><stop offset="1" stopColor="#ff7d00"/></linearGradient><linearGradient id={`${id}-blue`}><stop stopColor="#0a4bf2"/><stop offset=".3" stopColor="#5aa6ff"/><stop offset=".5" stopColor="#eaf6ff"/><stop offset=".7" stopColor="#3f8cff"/><stop offset="1" stopColor="#0060ff"/></linearGradient><filter id={`${id}-bloom`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={compact?3:5} result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/></feMerge></filter><filter id={`${id}-bloom2`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation={compact?6:10}/></filter></defs>{ordered.map((process,index)=><Flow key={process.id} process={process} index={index} progress={progress} compact={compact} prefix={id}/>)}</svg><nav className="standalone-islands" aria-label="Okul süreçleri">{ordered.map((process,index)=><Tile key={process.id} process={process} index={index} progress={progress} interactive={interactive} onFailure={onFailure}/>)}</nav></>}
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
      <AnimatePresence initial={false}>
        <motion.div key={role} className="standalone-role-composition" initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:reduced?0:.6,ease:[.22,1,.36,1]}}>
          <RoleIllustration illustration={illustration} onFailure={onFailure}/>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  </div>
}
