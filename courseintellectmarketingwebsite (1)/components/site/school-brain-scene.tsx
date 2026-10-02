"use client"

import { Suspense, useEffect, useMemo, useRef, createContext, useContext, type ReactNode } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, RoundedBox, useGLTF } from "@react-three/drei"
import { type MotionValue } from "framer-motion"
import { BarChart3, Bell, BookOpen, GraduationCap, PieChart, Users, Building2, ClipboardList, HeartHandshake, Utensils, Bus, ShieldCheck } from "lucide-react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import type { GLTFLoader, GLTFParser, GLTFLoaderPlugin } from "three-stdlib"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { brainProcesses, brainPosition, brainTimeline, smoothRange, type BrainProcess } from "@/lib/school-brain"
import { BrainPerformance, type BrainMetrics } from "./brain-performance"
import { createBrainPanelTexture } from "@/lib/brain-panel-textures"
import { createFlowGeometry, updateFlowGeometry, flowVertexShader, flowFragmentShader } from "@/lib/brain-flow"

const TextureResolution = createContext(1600)

const ORANGE = "#ff7800", BLUE = "#1246c4", WHITE = "#fffdf8"
type SceneProps = { progress: MotionValue<number>; compact: boolean; running: boolean; onReady: () => void; onFailure: () => void; role: RoleId; previousRole: RoleId; onMetrics?: (metrics: BrainMetrics) => void }
type Point = [number, number, number]
const CORE_RETREAT_DESKTOP: Point = [-2.5, 0, -11.8]
const CORE_RETREAT_MOBILE: Point = [-1.25, 0, -7.8]

function embeddedLogoTextures(parser: GLTFParser): GLTFLoaderPlugin & { name: string } {
  // ImageBitmapLoader fetches blob URLs through connect-src. Our existing CSP
  // permits embedded image blobs only through img-src. TextureLoader uses an
  // image element, so the original security policy can remain intact.
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager)
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin)
  return {
    name: "SchoolAsistEmbeddedLogoTextures",
    afterRoot(result) {
      result.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        if (materials.some(material => !(material instanceof THREE.MeshStandardMaterial) || !material.map || !material.normalMap || !material.metalnessMap)) {
          throw new Error("SchoolAsist logo textures could not be decoded")
        }
      })
      return null
    },
  }
}
function configureLogoLoader(loader: GLTFLoader) { loader.register(embeddedLogoTextures) }

export function resetSchoolBrainModel(compact: boolean) {
  useGLTF.clear(compact ? "/models/schoolasist-logo-mobile.glb" : "/models/schoolasist-logo.glb")
}

function Surface({ children, size, position = [0, 0, 0], color = WHITE, radius = .12, metalness = .12 }: { children?: ReactNode; size: Point; position?: Point; color?: string; radius?: number; metalness?: number }) {
  return <RoundedBox args={size} radius={radius} smoothness={2} position={position} receiveShadow><meshStandardMaterial color={color} metalness={metalness} roughness={.3}/>{children}</RoundedBox>
}

function Ring({ radius, color = ORANGE, thickness = .015, y = .02 }: { radius: number; color?: string; thickness?: number; y?: number }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}><torusGeometry args={[radius, thickness, 6, 96]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.65} toneMapped={false} metalness={.6} roughness={.23}/></mesh>
}

function Disc({ radius = 1.34 }: { radius?: number }) {
  const shadow = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128
    const ctx = canvas.getContext("2d")!, gradient = ctx.createRadialGradient(64,64,14,64,64,64)
    gradient.addColorStop(0,"#12305c2b"); gradient.addColorStop(.45,"#12305c19"); gradient.addColorStop(1,"#12305c00")
    ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128)
    return new THREE.CanvasTexture(canvas)
  }, [])
  useEffect(() => () => shadow.dispose(), [shadow])
  return <group>
    <mesh rotation={[-Math.PI / 2,0,0]} position={[0,-.29,0]}><planeGeometry args={[radius*3.1,radius*3.1]}/><meshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false}/></mesh>
    <mesh position={[0,-.08,0]}><cylinderGeometry args={[radius,radius*.97,.13,48]}/><meshStandardMaterial color="#1c3556" metalness={.68} roughness={.28}/></mesh>
    <mesh position={[0,-.007,0]} receiveShadow><cylinderGeometry args={[radius*.98,radius*.98,.025,48]}/><meshStandardMaterial color="#f5f8fd" metalness={.23} roughness={.4}/></mesh>
    <Ring radius={radius*.985} y={.01} color="#8badd8" thickness={.009}/>
    <Ring radius={radius*.89} y={.012} color="#c1d1e7" thickness={.005}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.135,0]}><ringGeometry args={[radius*.96,radius,48]}/><meshBasicMaterial color="#ffa554" transparent opacity={.5} toneMapped={false}/></mesh>
  </group>
}

function DisplayPanel({ kind, size = [2.64, 1.65], position = [0, 1.07, -.12], rotation = [-.12,-.05,.012] }: { kind: string; size?: [number,number]; position?: Point; rotation?: Point }) {
  return <group position={position} rotation={rotation}>
    <Surface size={[size[0]+.15,size[1]+.15,.11]} color="#183754" radius={.08} metalness={.65}/>
    <Surface size={[size[0]+.06,size[1]+.06,.023]} position={[0,0,.066]} color="#aac0d6" radius={.06} metalness={.7}/>
    <Paper kind={kind} size={size} position={[0,0,.081]}/>
    <mesh position={[0,-size[1]/2-.05,.083]}><boxGeometry args={[.24,.012,.008]}/><meshBasicMaterial color="#8ca4c2" toneMapped={false}/></mesh>
  </group>
}

function Paper({ kind, size, position, rotation = [0, 0, 0] }: { kind: string; size: [number, number]; position: Point; rotation?: Point }) {
  const resolution = useContext(TextureResolution)
  const texture = useMemo(() => createBrainPanelTexture(kind, resolution), [kind, resolution])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position} rotation={rotation}><planeGeometry args={size}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide}/></mesh>
}

function BookPage({ kind, side, layer = 0 }: { kind?: string; side: -1 | 1; layer?: number }) {
  const geometry = useMemo(() => {
    const surface = new THREE.PlaneGeometry(1.26, 1.58, 24, 8)
    const positions = surface.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i) / 1.26 + .5
      positions.setZ(i, Math.sin(u * Math.PI) * .105 + (side === 1 ? u : 1 - u) * .07)
    }
    surface.computeVertexNormals()
    return surface
  }, [side])
  const resolution = useContext(TextureResolution)
  const texture = useMemo(() => kind ? createBrainPanelTexture(kind, resolution) : null, [kind, resolution])
  useEffect(() => () => { geometry.dispose(); texture?.dispose() }, [geometry, texture])
  return <mesh geometry={geometry} position={[side * .635, .035, .032 - layer * .016]}>
    {texture ? <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide}/> : <meshStandardMaterial color={layer % 2 ? "#eee5d6" : "#fffaf1"} roughness={.68} side={THREE.DoubleSide}/>}
  </mesh>
}

function OpenBook() {
  return <group rotation={[-.38, -.13, .025]} position={[0, .99, -.08]}>
    {([-1, 1] as const).map(side => <group key={side}>
      <group rotation={[0, -side * .08, side * -.006]} position={[side * .65, 0, -.11]}><Surface size={[1.35, 1.73, .07]} color={ORANGE} radius={.045}/></group>
      {[4, 3, 2, 1].map(layer => <BookPage key={layer} side={side} layer={layer}/>)}
      <BookPage side={side} kind={side === -1 ? "page-left" : "page-right"}/>
    </group>)}
    <mesh position={[0, 0, -.115]}><cylinderGeometry args={[.055, .055, 1.72, 16]}/><meshPhysicalMaterial color={ORANGE} roughness={.22} clearcoat={1}/></mesh>
    <Surface size={[.19, .53, .035]} position={[.72, .67, .22]} color={ORANGE} radius={.009}/>
    <group position={[0, 1.12, -.02]}><Surface size={[2.23, .39, .075]} radius={.08}/><Paper kind="book-header" size={[2.12, .33]} position={[0, 0, .043]}/></group>
    <group position={[1.0, -.49, .26]} rotation={[0, -.06, .04]}><Surface size={[1.12, .32, .085]} radius={.09} color="#fffaf1"/><Paper kind="assignment" size={[1.05, .29]} position={[0, 0, .06]}/></group>
    <group position={[-.3, -.94, .32]} rotation={[0, 0, -.07]}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.038, .038, 1.7, 12]}/><meshStandardMaterial color={BLUE} metalness={.5} roughness={.25}/></mesh><mesh position={[.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[.039, .15, 12]}/><meshStandardMaterial color="#ceb089"/></mesh></group>
  </group>
}

function Person({ position, color, scale = 1 }: { position: Point; color: string; scale?: number }) {
  return <group position={position} scale={scale}><Surface size={[.46,.59,.045]} position={[0,.28,0]} color={color} radius={.07}/><Paper kind="profile" size={[.42,.55]} position={[0,.28,.03]}/></group>
}

function FloatingStat({ kind, position, size=[1.06,.38] }: {kind:string;position:Point;size?:[number,number]}) {
  return <group position={position} rotation={[-.12,-.07,.018]}><Surface size={[size[0]+.05,size[1]+.05,.055]} color="#16385e" radius={.06} metalness={.5}/><Paper kind={kind} size={size} position={[0,0,.034]}/></group>
}
function Students() { return <group><DisplayPanel kind="students" rotation={[-.12,.08,-.01]}/><group position={[.91,.31,.51]} rotation={[-.05,-.12,-.04]}><Surface size={[.72,.27,.055]} color="#bed0e5" radius={.045}/><Paper kind="demo" size={[.69,.25]} position={[0,0,.035]}/></group></group> }
function Finance() { return <group><DisplayPanel kind="finance" rotation={[-.13,.09,-.012]}/><FloatingStat kind="stat:finance" position={[.62,.32,.42]}/></group> }
function Management() {
  return <group><DisplayPanel kind="management-detail" size={[1.75,1.20]} position={[.35,1.16,-.18]} rotation={[-.12,-.08,.008]}/>
    <group position={[-.67,.77,.27]} rotation={[-.1,-.1,.015]}>
      <mesh><circleGeometry args={[.57,48]}/><meshStandardMaterial color="#fcfdff" metalness={.25} roughness={.3}/></mesh>
      <mesh position={[0,0,.016]}><torusGeometry args={[.54,.035,6,64]}/><meshStandardMaterial color="#cfdbed" metalness={.4} roughness={.32}/></mesh>
      <mesh position={[0,0,.024]} rotation={[0,0,Math.PI/2]}><torusGeometry args={[.54,.038,6,64,Math.PI*1.84]}/><meshStandardMaterial color={BLUE} metalness={.45} roughness={.26}/></mesh>
      <Paper kind="kpi-ring" size={[.96,.96]} position={[0,0,.039]}/>
    </group>
  </group>
}
function Parents() {
  return <group>{[0,1,2].map(i=><group key={i} position={[i===1?.13:0,1.58-i*.55,i===0?.02:.08+i*.045]} rotation={[-.1,-.08,i===1?-.018:.012]}><Surface size={[2.48,.55,.065]} color={i===0?"#e8b981":"#b7cadf"} radius={.065} metalness={.4}/><Paper kind={`notification:${i}`} size={[2.40,.51]} position={[0,0,.043]}/></group>)}</group>
}

const roleIcons = { yonetici: Building2, ogretmen: BookOpen, veli: Bell, ogrenci: GraduationCap, muhasebe: BarChart3, personel: ClipboardList, rehberlik: HeartHandshake, "sube-muduru": Building2, yemekhane: Utensils, "servis-soforu": Bus }

function RoleDevice({ role, size = [2.55, 1.6] }: { role: RoleId; size?: [number, number] }) {
  return <DisplayPanel kind={`role:${role}${size[0] / size[1] < .85 ? ":portrait" : ""}`} size={size} position={[0,1.06,-.18]} rotation={[-.12,-.1,.015]}/>
}

function Shield() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, .68); shape.lineTo(.55, .46); shape.lineTo(.48, -.12); shape.quadraticCurveTo(.35, -.48, 0, -.67); shape.quadraticCurveTo(-.35, -.48, -.48, -.12); shape.lineTo(-.55, .46); shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .045, bevelThickness: .04 })
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow><meshPhysicalMaterial color={BLUE} metalness={.25} roughness={.22} clearcoat={1}/></mesh>
}

function SchoolBus() {
  return <group position={[0, .48, .2]} rotation={[0, -.22, 0]}>
    <Surface size={[2.45, .83, .79]} color="#fffaf0" radius={.16}/>
    <Surface size={[2.48, .31, .8]} position={[0, -.21, 0]} color={BLUE} radius={.06}/>
    {[-.83, 0, .83].map(x => <Surface key={x} size={[.63, .36, .035]} position={[x, .14, .417]} color="#8cbdeb" radius={.045}/>)}
    {[-.81, .81].flatMap(x => [-.43, .43].map(z => <group key={`${x}-${z}`} position={[x, -.37, z]}><mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.19, .19, .095, 28]}/><meshStandardMaterial color="#16305a" roughness={.7}/></mesh><mesh position={[0, 0, z > 0 ? .055 : -.055]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.085, .085, .012, 20]}/><meshPhysicalMaterial color="#d8e2ed" metalness={.7} roughness={.2}/></mesh></group>))}
    <Surface size={[.045, .27, .36]} position={[1.25, .07, .0]} color="#b7d9f8" radius={.02}/>
    <Surface size={[.03, .08, .11]} position={[1.265, -.21, .25]} color={ORANGE} radius={.015}/>
  </group>
}

function RoleSculpture({ role }: { role: RoleId }) {
  if (role === "ogretmen") return <OpenBook/>
  if (role === "veli") return <group><group scale={.6} position={[-.61, .11, .35]}><Parents/></group><RoleDevice role={role} size={[1.16, 1.86]}/><Person position={[.96, .1, .32]} color={BLUE} scale={1.3}/></group>
  if (role === "ogrenci") return <group><RoleDevice role={role}/><group position={[.92, .31, .25]}><Surface size={[.7, .055, .7]} position={[0, .45, 0]} color={BLUE} radius={.025}/><mesh position={[0, .33, 0]}><cylinderGeometry args={[.23, .23, .23, 32]}/><meshPhysicalMaterial color={BLUE} roughness={.2} clearcoat={1}/></mesh><mesh position={[.36, .25, .35]}><cylinderGeometry args={[.018, .018, .4, 10]}/><meshStandardMaterial color={ORANGE}/></mesh></group><Person position={[-1.0, .1, .3]} color="#1aaa83" scale={1.4}/></group>
  if (role === "muhasebe") return <group><group scale={.82} position={[0, .08, .22]}><Finance/></group><group scale={.64} position={[0, .88, -.45]}><RoleDevice role={role}/></group>{Array.from({length: 4}, (_,i) => <mesh key={i} position={[1.0, .13 + i * .075, .65]}><cylinderGeometry args={[.24, .24, .06, 32]}/><meshPhysicalMaterial color="#ffab36" metalness={.65} roughness={.24}/></mesh>)}</group>
  if (role === "yonetici" || role === "sube-muduru") return <group><RoleDevice role={role}/><group scale={.67} position={[-.62, .06, .38]}><Management/></group>{[-.3,.38,.99].map((x,i) => <Person key={x} position={[x, .1, .52]} color={i === 1 ? ORANGE : BLUE} scale={.72}/>)}</group>
  if (role === "yemekhane") return <group><group scale={.67} position={[0, .84, -.4]}><RoleDevice role={role}/></group><mesh position={[0, .14, .45]}><cylinderGeometry args={[.82, .66, .13, 48]}/><meshPhysicalMaterial color="#fffaf1" metalness={.2} roughness={.23} clearcoat={1}/></mesh><group position={[0, .21, .45]}><Ring radius={.72} color="#b9d0e7" thickness={.015}/>{[-.28, .04, .35].map((x,i) => <mesh key={x} position={[x, .06, Math.sin(i) * .19]} scale={[.2, .10, .15]} castShadow><sphereGeometry args={[1, 24, 16]}/><meshPhysicalMaterial color={i === 1 ? "#80a66d" : i === 2 ? "#ff9b27" : "#e5bd83"} roughness={.4} clearcoat={.45}/></mesh>)}</group>{[-1,1].map(x => <Surface key={x} size={[.065,.04,.8]} position={[x,.16,.43]} color="#d2e0ee" metalness={.85} radius={.015}/>)}</group>
  if (role === "servis-soforu") return <group><group scale={.65} position={[0, .85, -.5]}><RoleDevice role={role}/></group><SchoolBus/><group position={[0, .055, .15]}><Ring radius={1.12} color={ORANGE} thickness={.013}/><Person position={[-1.02,.1,.49]} color="#2fb394" scale={.65}/></group></group>
  if (role === "rehberlik") return <group><RoleDevice role={role} size={[1.9,1.8]}/><Person position={[-1.05,.12,.47]} color="#30ae8d" scale={1.5}/><Person position={[1.05,.12,.3]} color={BLUE} scale={1.4}/><group position={[.7,.55,.56]} scale={.36}><Shield/></group></group>
  return <group><RoleDevice role={role}/><group position={[.85,.29,.48]} rotation={[0,-.08,.08]}><Surface size={[.73,.57,.11]} color={ORANGE} radius={.09}/><mesh position={[0,0,.073]} rotation={[0,0,-Math.PI/4]}><boxGeometry args={[.09,.28,.035]}/><meshBasicMaterial color="#fff"/></mesh><mesh position={[.10,.07,.073]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[.09,.44,.035]}/><meshBasicMaterial color="#fff"/></mesh></group></group>
}

function fadeSculpture(group: THREE.Group | null, opacity: number) {
  if (!group) return
  group.visible = opacity > .005
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(material => {
      material.userData.brainDepthWrite ??= material.depthWrite
      material.userData.brainOpacity ??= material.opacity
      material.transparent = true; material.opacity = opacity * material.userData.brainOpacity; material.depthWrite = opacity > .99 && material.userData.brainDepthWrite
    })
  })
}

function RoleStage({ role, previousRole, progress, compact }: Pick<SceneProps, "role" | "previousRole" | "progress" | "compact">) {
  const group = useRef<THREE.Group>(null), incoming = useRef<THREE.Group>(null), outgoing = useRef<THREE.Group>(null), label = useRef<HTMLSpanElement>(null)
  const started = useRef<number | null>(null), finished = useRef(false)
  const selected = roles.find(item => item.id === role)!, Icon = roleIcons[role]
  useEffect(() => { started.current = null; finished.current = false }, [role])
  useFrame(state => {
    if (!group.current || !incoming.current) return
    const timeline = brainTimeline(progress.get()), focus = timeline.focus
    const reveal = smoothRange(timeline.progress, .29, .38)
    group.current.visible = reveal > .004
    group.current.scale.setScalar(Math.max(.001, reveal * (1 + focus * .44) * (compact ? .68 : 1)))
    if (started.current === null) started.current = state.clock.elapsedTime
    const arrive = previousRole === role ? 1 : smoothRange(state.clock.elapsedTime - started.current, 0, .65)
    if (!finished.current || focus < 1) {
      fadeSculpture(incoming.current, arrive)
      fadeSculpture(outgoing.current, 1 - arrive)
      incoming.current.position.y = (1 - arrive) * .1
      if (arrive === 1 && focus === 1) finished.current = true
    }
    if (label.current) label.current.style.opacity = String(reveal)
  })
  return <group ref={group} position={brainPosition(brainProcesses[2], compact)}>
    {previousRole !== role && <group ref={outgoing} key={`out-${previousRole}`}><Disc/><RoleSculpture role={previousRole}/></group>}
    <group ref={incoming} key={role}><Disc/><RoleSculpture role={role}/></group>
    <Html center position={[0,2.4,-.1]} zIndexRange={[6,0]}><span ref={label} className="brain-process-label brain-role-stage-label" style={{opacity:0}}><i><Icon size={18}/></i>{selected.name}</span></Html>
  </group>
}

const icons = { lessons: BookOpen, students: Users, teachers: GraduationCap, parents: Bell, finance: BarChart3, management: PieChart }
function ProcessIsland({ process, progress, compact }: { process: BrainProcess; progress: MotionValue<number>; compact: boolean }) {
  const group = useRef<THREE.Group>(null)
  const label = useRef<HTMLAnchorElement>(null)
  const Icon = icons[process.id]
  const position = brainPosition(process, compact)
  useFrame(state => {
    if (!group.current) return
    const timeline = brainTimeline(progress.get())
    const reveal = smoothRange(timeline.progress, process.start, process.start + .09)
    const visible = reveal * (1 - smoothRange(timeline.focus, process.id === "teachers" ? 0 : .12, process.id === "teachers" ? .22 : .86))
    group.current.visible = visible > .004
    const scale = visible
    group.current.scale.setScalar(Math.max(.001, scale * (compact ? .68 : 1)))
    group.current.position.y = position[1] - (1 - reveal) * .45 + Math.sin(state.clock.elapsedTime * .6 + process.start * 10) * .018 * (1 - timeline.focus)
    if (label.current) { label.current.style.opacity = String(visible); label.current.style.pointerEvents = visible > .8 ? "auto" : "none"; label.current.tabIndex = visible > .8 ? 0 : -1; label.current.setAttribute("aria-hidden", String(visible < .8)) }
  })
  return <group ref={group} position={position} scale={.001} visible={false}>
    <Disc/>
    {process.id === "lessons" ? <DisplayPanel kind="lessons" rotation={[-.12,.09,.012]}/> : process.id === "students" ? <Students/> : process.id === "teachers" ? <OpenBook/> : process.id === "parents" ? <Parents/> : process.id === "finance" ? <Finance/> : <Management/>}
    <Html position={[0, process.id === "teachers" ? 2.4 : 2.25, -.1]} center zIndexRange={[6, 0]}><a ref={label} className={`brain-process-label brain-process-${process.id}`} style={{ opacity: 0 }} href={process.href} tabIndex={-1} aria-hidden="true"><i><Icon size={18}/></i>{process.label}</a></Html>
  </group>
}

function CircuitPath({ process, progress, index, compact }: { process: BrainProcess; progress: MotionValue<number>; index: number; compact: boolean }) {
  const path = useRef<THREE.Group>(null), tube = useRef<THREE.Mesh>(null), port = useRef<THREE.Group>(null), shader = useRef<THREE.ShaderMaterial>(null)
  const color = index % 2 ? BLUE : ORANGE
  const curve = useMemo(() => {
    const [x,y,z] = brainPosition(process,compact), sign = Math.sign(x)
    return new THREE.CatmullRomCurve3([new THREE.Vector3(sign*1.6,.018, z*.10),new THREE.Vector3(sign*(compact?1.75:2.6),.018,z*.25),new THREE.Vector3(x-sign*(compact?.94:1.85),y+.016,z-.15),new THREE.Vector3(x-sign*(compact?.86:1.29),y+.016,z)])
  },[process,compact])
  const geometry = useMemo(() => { const result = createFlowGeometry(); updateFlowGeometry(result,curve,compact?.14:.18); return result },[curve,compact])
  const uniforms = useMemo(() => ({uTime:{value:0},uOpacity:{value:0},uReveal:{value:0},uOffset:{value:index*.143},uColor:{value:new THREE.Color(color)}}),[color,index])
  const lastFocus = useRef(-1)
  const animatedCurve = useRef<THREE.CatmullRomCurve3>(null)
  useEffect(() => { animatedCurve.current = curve.clone(); lastFocus.current = -1 },[curve])
  useEffect(() => () => geometry.dispose(),[geometry])
  useFrame(state => {
    if(!path.current || !tube.current || !shader.current) return
    const timeline=brainTimeline(progress.get()), reveal=smoothRange(timeline.progress,process.start-.045,process.start+.075)
    const opacity=process.id==="teachers"?1:1-smoothRange(timeline.focus,.1,.88)
    path.current.visible=reveal>.002 && opacity>.02
    shader.current.uniforms.uTime.value=state.clock.elapsedTime; shader.current.uniforms.uOpacity.value=opacity; shader.current.uniforms.uReveal.value=reveal
    const movingCurve = animatedCurve.current
    if(process.id==="teachers" && movingCurve && Math.abs(lastFocus.current-timeline.focus)>.0003) {
      const focus=timeline.focus, retreat=compact?CORE_RETREAT_MOBILE:CORE_RETREAT_DESKTOP, shrink=compact?.95:.25
      movingCurve.points[0].set(1.6*(1-focus*shrink)+focus*retreat[0],.018,.10*brainPosition(process,compact)[2]+focus*retreat[2])
      movingCurve.points[1].set((compact?1.75:2.6)+focus*retreat[0],.018,brainPosition(process,compact)[2]*.25+focus*retreat[2]*.58)
      movingCurve.points[3].x=brainPosition(process,compact)[0]-(compact?.86:1.29)*(1+focus*.44)
      updateFlowGeometry(tube.current.geometry,movingCurve,compact?.14:.18); lastFocus.current=focus
    }
    if(port.current) { port.current.scale.setScalar(reveal*opacity); port.current.position.copy((movingCurve ?? curve).points[3]) }
  })
  return <group ref={path} visible={false}>
    <mesh ref={tube} geometry={geometry} frustumCulled={false}><shaderMaterial ref={shader} uniforms={uniforms} vertexShader={flowVertexShader} fragmentShader={flowFragmentShader} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <group ref={port} position={curve.points[3]}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.048,.073,16]}/><meshStandardMaterial color="#567392" metalness={.6} roughness={.28}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.003,0]}><circleGeometry args={[.038,16]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh></group>
  </group>
}

function ChipContacts() {
  const pins = useRef<THREE.InstancedMesh>(null), lights = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(.08,.05,.45,2,.017),[])
  useEffect(() => {
    if(!pins.current || !lights.current) return
    const matrix=new THREE.Matrix4()
    for(let i=0;i<12;i++) {
      const angle=i/12*Math.PI*2
      matrix.makeRotationY(angle); matrix.setPosition(Math.sin(angle)*1.18,-.017,Math.cos(angle)*1.18); pins.current.setMatrixAt(i,matrix)
      matrix.makeTranslation(Math.sin(angle)*1.48,.022,Math.cos(angle)*1.48); lights.current.setMatrixAt(i,matrix)
    }
    pins.current.instanceMatrix.needsUpdate=true; lights.current.instanceMatrix.needsUpdate=true
  },[])
  useEffect(() => () => geometry.dispose(),[geometry])
  return <group><instancedMesh ref={pins} args={[geometry,undefined,12]}><meshStandardMaterial color="#d49d57" metalness={.8} roughness={.3}/></instancedMesh><instancedMesh ref={lights} args={[undefined,undefined,12]}><sphereGeometry args={[.024,8,6]}/><meshBasicMaterial color="#ffc886" toneMapped={false}/></instancedMesh></group>
}

function Microchip() {
  const halo = useRef<THREE.Group>(null)
  useFrame(state => { if (halo.current) { halo.current.rotation.y = state.clock.elapsedTime * .035; halo.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * .8) * .008) } })
  return <group>
    <mesh position={[0, -.23, 0]} receiveShadow castShadow><cylinderGeometry args={[1.73, 1.73, .3, 96]}/><meshPhysicalMaterial color="#103073" metalness={.72} roughness={.24} clearcoat={1}/></mesh>
    <mesh position={[0, -.067, 0]}><cylinderGeometry args={[1.68, 1.68, .035, 96]}/><meshPhysicalMaterial color="#254879" metalness={.78} roughness={.26}/></mesh>
    <Ring radius={1.68} y={-.045} thickness={.021}/><Ring radius={1.49} y={-.035} color="#5792ed" thickness={.01}/>
    <Surface size={[2.1, .06, 1.54]} position={[0, -.02, 0]} radius={.075} color="#112b63" metalness={.35}/>
    <Paper kind="chip" size={[2.03, 1.47]} position={[0, .018, 0]} rotation={[-Math.PI / 2, 0, 0]}/>
    <Ring radius={.82} y={.036} thickness={.008} color="#ffb658"/>
    <ChipContacts/>
    <group ref={halo}><Ring radius={2.0} y={-.25} thickness={.009} color="#ffb251"/><Ring radius={2.27} y={-.28} thickness={.008} color="#c2d3ea"/></group>
    
  </group>
}

function Logo({ progress, compact, onReady }: { progress: MotionValue<number>; compact: boolean; onReady: () => void }) {
  const gltf = useGLTF(compact ? "/models/schoolasist-logo-mobile.glb" : "/models/schoolasist-logo.glb", false, false, configureLogoLoader)
  const group = useRef<THREE.Group>(null)
  const start = useRef<number | null>(null)
  const announced = useRef(false)
  const { object, materials } = useMemo(() => {
    const object = gltf.scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(object)
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
    const factor = 2.54 / Math.max(size.x, size.y)
    object.scale.multiplyScalar(factor); object.position.copy(center).multiplyScalar(-factor)
    const materials: THREE.Material[] = []
    object.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      node.castShadow = true; node.receiveShadow = true
      node.material = (node.material as THREE.MeshStandardMaterial).clone()
      const material = node.material as THREE.MeshStandardMaterial
      material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -.02)]
      material.clipShadows = true
      material.envMapIntensity = .3
      material.metalness = .25
      // Preserve the supplied PBR maps; soften only the reflection strength.
      materials.push(material)
    })
    return { object, materials }
  }, [gltf])
  useEffect(() => () => materials.forEach(material => material.dispose()), [materials])
  useFrame(state => {
    if (!group.current) return
    if (start.current === null) start.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - start.current
    const rise = Math.max(smoothRange(elapsed, .05, 2.15), smoothRange(progress.get(), 0, .13))
    group.current.position.y = THREE.MathUtils.lerp(-1.25, 1.7, rise)
    group.current.rotation.y = -.17 + Math.sin(state.clock.elapsedTime * .3) * .035
    group.current.rotation.z = -.025
    if (!announced.current) { announced.current = true; onReady() }
  })
  return <group ref={group} position={[0, -1.25, 0]}><primitive object={object} dispose={null}/></group>
}

function BrainCore({ progress, compact, onReady }: Pick<SceneProps, "progress" | "compact" | "onReady">) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const focus = brainTimeline(progress.get()).focus, retreat = compact ? CORE_RETREAT_MOBILE : CORE_RETREAT_DESKTOP
    group.current.position.set(focus * retreat[0], 0, focus * retreat[2])
    group.current.scale.setScalar(1 - focus * (compact ? .95 : .25))
  })
  return <group ref={group}><Microchip/><LightColumn progress={progress}/><Suspense fallback={null}><Logo progress={progress} compact={compact} onReady={onReady}/></Suspense></group>
}

function LightColumn({ progress }: { progress: MotionValue<number> }) {
  const mesh = useRef<THREE.Mesh>(null), material = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(state => { if (mesh.current && material.current) { const fade = 1 - smoothRange(progress.get(), .12, .36); material.current.opacity = (.10 + Math.sin(state.clock.elapsedTime * 1.4) * .012) * fade; mesh.current.rotation.y = state.clock.elapsedTime * .06 } })
  return <group><mesh ref={mesh} position={[0, 1.4, 0]}><cylinderGeometry args={[.58, .42, 2.8, 32, 1, true]}/><meshBasicMaterial ref={material} color="#ffab31" transparent opacity={.05} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[Math.cos(i / 12 * Math.PI * 2) * .5, .23, Math.sin(i / 12 * Math.PI * 2) * .5]}><cylinderGeometry args={[.006, .01, .43, 5]}/><meshBasicMaterial color="#ffd180" transparent opacity={.42} toneMapped={false}/></mesh>)}</group>
}

function Backdrop({ compact }: { compact: boolean }) {
  const arch = useMemo(() => new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => {
    const angle = i / 39 * Math.PI
    return new THREE.Vector3(Math.cos(angle) * 3.0, Math.sin(angle) * 5, 0)
  })), [])
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.4, 0]} receiveShadow><planeGeometry args={[100, 100]}/>{<meshStandardMaterial color="#eeeae3" roughness={.48} metalness={.12}/>}</mesh>
    {!compact && <group position={[0, -.4, -22]} scale={1.6}>
      {[-11, -5.6, 5.6, 11].map((x, i) => <group key={x} position={[x, 0, i % 2 ? -4 : 1]}><mesh position={[0, 4, 0]}><boxGeometry args={[.8, 8, .8]}/><meshStandardMaterial color="#fff7e9" roughness={.65}/></mesh><group position={[x < 0 ? 2.8 : -2.8, 0, -.3]}><mesh><tubeGeometry args={[arch, 48, .25, 8, false]}/><meshStandardMaterial color="#f4dcc0" roughness={.58}/></mesh></group></group>)}
      {[-8, 8].map(x => <group key={x} position={[x, .4, 0]}><mesh><cylinderGeometry args={[.38, .27, .75, 20]}/><meshStandardMaterial color="#efecdf" roughness={.8}/></mesh>{Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[Math.sin(i) * .2, .7 + i * .22, Math.cos(i) * .18]} scale={[.35, .5, .3]}><sphereGeometry args={[1, 12, 10]}/><meshStandardMaterial color={i % 2 ? "#8ca274" : "#b1bb91"} roughness={.9}/></mesh>)}</group>)}
    </group>}
  </group>
}

function SceneRig({ progress, compact, onFailure }: Pick<SceneProps, "progress" | "compact" | "onFailure">) {
  const { gl, scene, camera } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(gl)
    const environment = pmrem.fromScene(room, .04)
    // Three.js owns this mutable scene; this is not React state.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = environment.texture
    room.dispose(); pmrem.dispose()
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    gl.domElement.addEventListener("webglcontextlost", lost)
    return () => { gl.domElement.removeEventListener("webglcontextlost", lost); scene.environment = null; environment.dispose() }
  }, [gl, scene, onFailure])
  useFrame(() => {
    const focus = brainTimeline(progress.get()).focus
    const orbit = smoothRange(progress.get(), .09, .42)
    // Dolly through the same environment toward the original teacher island.
    // Camera and book never cut to a replacement scene at the chapter boundary.
    const perspective = camera as THREE.PerspectiveCamera
    if (compact) {
      perspective.position.set(THREE.MathUtils.lerp(0, 2.3, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(5.5, 9.5, orbit), 4.9, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(12.5, 20.2, orbit), 5.6, focus))
      target.set(THREE.MathUtils.lerp(0, 2.3, focus), THREE.MathUtils.lerp(1.3, 2.1, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(.2, 1.7, orbit), -3.8, focus))
    } else {
      perspective.position.set(THREE.MathUtils.lerp(0, 6.35, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(5.0, 7.6, orbit), 3.4, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(10.8, 17.2, orbit), 6.55, focus))
      target.set(THREE.MathUtils.lerp(0, 3.25, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.6, 1.1, orbit), .95, focus), THREE.MathUtils.lerp(THREE.MathUtils.lerp(.4, 1.8, orbit), -3.35, focus))
    }
    perspective.lookAt(target)
    // R3F camera parameters are updated in the animation loop.
    // eslint-disable-next-line react-hooks/immutability
    perspective.fov = THREE.MathUtils.lerp(compact ? 42 : 36, compact ? 42 : 35, focus)
    perspective.updateProjectionMatrix()
  })
  return null
}

export default function SchoolBrainScene({ progress, compact, running, onReady, onFailure, role, previousRole, onMetrics }: SceneProps) {
  return <Canvas className="brain-canvas" shadows={{ type: THREE.PCFShadowMap }} frameloop={running ? "always" : "never"} dpr={compact ? [1, 1.25] : [1, 1.5]} camera={{ position: [0, 7.1, 17.5], fov: 36, near: .1, far: 80 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance", localClippingEnabled: true }} fallback={null} onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = .8; gl.shadowMap.type = THREE.PCFShadowMap; gl.setClearColor("#fff8ed", 0) }}>
    <TextureResolution.Provider value={compact ? 1024 : 1600}>
    <BrainPerformance onMetrics={onMetrics} compact={compact} adaptive/>
    <fog attach="fog" args={["#fff8ed", 24, 55]}/>
    <ambientLight intensity={.3}/><hemisphereLight args={["#ffffff", "#b8c7e8", .7]}/>
    <directionalLight position={[-3, 8, 6]} intensity={1.2} color="#fff8ee" castShadow shadow-mapSize={[compact ? 256 : 512, compact ? 256 : 512]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-.0003} shadow-normalBias={.03}/>
    <directionalLight position={[5, 4, -2]} intensity={.8} color="#c5d9ff"/>
    <pointLight position={[0, .75, 0]} intensity={1.7} color={ORANGE} distance={6} decay={2}/>
    <SceneRig progress={progress} compact={compact} onFailure={onFailure}/>
    {brainProcesses.map((process, index) => <CircuitPath key={process.id} process={process} index={index} progress={progress} compact={compact}/>)}
    <Backdrop compact={compact}/><BrainCore progress={progress} compact={compact} onReady={onReady}/>
    {brainProcesses.filter(process => process.id !== "teachers").map(process => <ProcessIsland key={process.id} process={process} progress={progress} compact={compact}/>)}
    <RoleStage role={role} previousRole={previousRole} progress={progress} compact={compact}/>
    </TextureResolution.Provider>
  </Canvas>
}
