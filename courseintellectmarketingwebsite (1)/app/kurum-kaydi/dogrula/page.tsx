"use client"
import { useEffect, useRef, useState } from "react"
import { ApplicationStatus } from "@/components/site/application-status"
import { apiRequest, ApiRequestError } from "@/lib/api-client"
type State="loading"|"success"|"invalid"|"network"
export default function VerifyPage(){
 const [state,setState]=useState<State>("loading")
 const [attempt,setAttempt]=useState(0)
 const token=useRef<string|null>(null)
 const request=useRef<Promise<unknown>|null>(null)
 const initialized=useRef(false)
 useEffect(()=>{
  if(!initialized.current){initialized.current=true;token.current=new URLSearchParams(location.hash.slice(1)).get("token")??new URLSearchParams(location.search).get("token");history.replaceState(null,"",location.pathname)}
  if(!token.current||!/^[A-Za-z0-9_-]{43}$/.test(token.current)){setState("invalid");return}
  let active=true
  if(!request.current)request.current=apiRequest("/api/platformops/tenants/verify",{method:"POST",token:null,body:{token:token.current}})
  request.current.then(()=>{if(active){token.current=null;setState("success")}}).catch(e=>{if(active)setState(e instanceof ApiRequestError&&(e.code==="NETWORK_ERROR"||(e.status??0)>=500)?"network":"invalid")})
  return()=>{active=false}
 },[attempt])
 return <ApplicationStatus phase={state} retry={()=>{request.current=null;setState("loading");setAttempt(n=>n+1)}} />
}
