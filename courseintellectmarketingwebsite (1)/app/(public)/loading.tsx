import Image from "next/image"

export default function PublicLoading() {
  return <div className="sa-public-loading" role="status"><Image src="/images/logo.png" alt="" width={58} height={58} priority /><span>SchoolAsist hazırlanıyor…</span><i aria-hidden /></div>
}
