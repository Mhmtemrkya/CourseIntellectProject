import { notFound } from "next/navigation"
import { RoleStory, type RoleId } from "@/components/site/product-story"
import { roles } from "@/lib/site-experience-data"
const ids: string[] = roles.map(role => role.id)
export function generateStaticParams(){return ids.map(role=>({role}))}
export async function generateMetadata({params}:{params:Promise<{role:string}>}){const {role}=await params;return {title:`${roles.find(r=>r.id===role)?.name ?? "Rol"} deneyimi`}}
export default async function Page({params}:{params:Promise<{role:string}>}){const {role}=await params;if(!ids.includes(role))notFound();return <RoleStory id={role as RoleId}/>}
