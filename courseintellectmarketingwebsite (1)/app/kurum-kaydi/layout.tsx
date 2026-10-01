import type { Metadata } from "next"
import { PublicLayout } from "@/components/layout/public-layout"
export const metadata: Metadata = {title:"Ücretsiz kurum kaydı",robots:{index:false,follow:false},referrer:"no-referrer"}
export default function Layout({children}:{children:React.ReactNode}){return <PublicLayout className="ref-account-site">{children}</PublicLayout>}
