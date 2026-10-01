import Image from "next/image"

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-white" role="status" aria-live="polite">
      <Image src="/images/logo.png" alt="SchoolAsist" width={60} height={60} priority className="object-contain" />
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-4 w-4 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Yönetim paneli yükleniyor…
      </div>
    </div>
  )
}
