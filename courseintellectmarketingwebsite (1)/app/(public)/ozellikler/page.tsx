"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Check,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Network,
  ShieldCheck,
  Utensils,
  UsersRound,
  WalletCards,
} from "lucide-react"
import {
  MODULE_CATALOG,
  MODULE_GROUPS,
  ROLE_CATALOG,
  type RoleKey,
} from "@/data/role-feature-catalog"

const roleIcons = {
  admin: Building2,
  "branch-manager": Network,
  administrative: ClipboardList,
  finance: WalletCards,
  counselor: HeartHandshake,
  teacher: GraduationCap,
  student: BookOpenCheck,
  parent: UsersRound,
  cafeteria: Utensils,
} satisfies Record<RoleKey, typeof Building2>

export default function FeaturesPage() {
  const [activeRole, setActiveRole] = useState<RoleKey>("admin")
  const role = ROLE_CATALOG.find((item) => item.key === activeRole) ?? ROLE_CATALOG[0]
  const RoleIcon = roleIcons[role.key]

  const groupedModules = useMemo(
    () => MODULE_GROUPS.map((group) => ({
      ...group,
      items: group.modules
        .filter((key) => role.modules.includes(key))
        .map((key) => ({ key, ...MODULE_CATALOG[key] })),
    })).filter((group) => group.items.length > 0),
    [role],
  )

  const actionCount = role.modules.reduce(
    (total, moduleKey) => total + (MODULE_CATALOG[moduleKey]?.actions.length ?? 0),
    0,
  )

  return (
    <div className="pt-20">
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-5xl text-center"
          >
            <h1 className="font-semibold">Her rol için doğru yetki, doğru çalışma alanı.</h1>
            <p className="mt-6 text-lg">
              SchoolAsist, kurumun tüm rollerini aynı veri modeli üzerinde buluşturur. Her kullanıcı yalnızca görevine ve veri kapsamına uygun modülleri görür.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-4 text-left">
              <div>
                <div className="font-mono text-2xl font-semibold text-white">09</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">Ayrı rol deneyimi</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold text-white">60+</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">Yönetilebilir modül</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold text-white">RBAC</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">Rol bazlı erişim</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[#dfe5e9] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 lg:px-10">
          <div className="flex min-w-max items-center py-3">
            {ROLE_CATALOG.map((item) => {
              const Icon = roleIcons[item.key]
              const active = item.key === activeRole
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveRole(item.key)}
                  className={`relative flex h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
                    active ? "bg-[#061a27] text-white" : "text-[#5c6b74] hover:bg-[#f2f5f7] hover:text-[#061a27]"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-[#FFB25A]" : "text-[#8b989f]"}`} />
                  {item.shortLabel}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait">
        <motion.div
          key={role.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <section className="border-b border-[#dfe5e9] bg-[#f6f8fa] py-16 md:py-20">
            <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:px-10">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-4">
                  <span className="grid h-14 w-14 place-items-center rounded-lg bg-[#061a27] text-[#FFB25A]">
                    <RoleIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d26d00]">Rol çalışma alanı</div>
                    <h2 className="mt-1 text-3xl font-semibold text-[#061a27] md:text-5xl">{role.label}</h2>
                  </div>
                </div>
                <p className="mt-7 max-w-3xl text-lg leading-8 text-[#52636d]">{role.description}</p>
                <div className="mt-7 inline-flex items-center gap-2 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {role.scope}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#dfe5e9] lg:col-span-4 lg:self-stretch">
                <div className="bg-white p-6">
                  <div className="font-mono text-4xl font-semibold text-[#061a27]">{String(role.modules.length).padStart(2, "0")}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[#7b8991]">Modül</div>
                </div>
                <div className="bg-white p-6">
                  <div className="font-mono text-4xl font-semibold text-[#061a27]">{actionCount}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[#7b8991]">İşlem ve yetenek</div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white py-20 md:py-28">
            <div className="mx-auto max-w-7xl space-y-20 px-6 lg:px-10">
              {groupedModules.map((group, groupIndex) => (
                <section key={group.key}>
                  <div className="mb-8 flex items-end justify-between gap-6 border-b border-[#dfe5e9] pb-5">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d26d00]">
                        {String(groupIndex + 1).padStart(2, "0")} / {String(groupedModules.length).padStart(2, "0")}
                      </div>
                      <h3 className="mt-2 text-2xl font-semibold text-[#061a27] md:text-3xl">{group.label}</h3>
                    </div>
                    <span className="font-mono text-xs text-[#8b989f]">{group.items.length} modül</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((module, index) => (
                      <motion.article
                        key={module.key}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: Math.min(index * 0.035, 0.22), duration: 0.5 }}
                        className="group rounded-lg border border-[#dfe5e9] bg-white p-6 transition hover:border-[#F7941D]/55 hover:shadow-[0_24px_55px_-40px_rgba(6,26,39,.55)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="text-lg font-semibold text-[#061a27]">{module.label}</h4>
                          <span className="font-mono text-[10px] text-[#a2adb3]">{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <ul className="mt-5 space-y-3">
                          {module.actions.map((action) => (
                            <li key={action} className="flex items-start gap-3 text-sm leading-6 text-[#607079]">
                              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </motion.article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="bg-[#0c2a3c] py-16 text-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between lg:px-10">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFB25A]">Yetki mimarisi</div>
                <h3 className="mt-3 max-w-2xl text-2xl font-semibold md:text-4xl">Paket, rol, modül ve işlem düzeyinde kontrol.</h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">Kurum yöneticisi özel roller oluşturabilir; kullanıcı menüsü ve işlemleri atanan yetkiye göre otomatik sadeleşir.</p>
              </div>
              <Link href="/iletisim" className="group inline-flex h-12 shrink-0 items-center justify-center gap-3 rounded-md bg-[#F7941D] px-6 text-sm font-bold text-[#15294B] hover:bg-[#FFB25A]">
                Kurumunuz için görüşelim
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
