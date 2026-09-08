import { getCurrentAuthContext } from "@/lib/authz";
import { listPeriods } from "@/lib/services/periods";
import { AccessPolicyForm } from "../admin/periode/[id]/access-policy-form";
export default async function AccessPage(){
 const ctx=await getCurrentAuthContext();
 if(!ctx || (!ctx.isAdmin&&!ctx.isDekan)) return <h1>Tidak berwenang</h1>;
 const periods=await listPeriods();
 return <div className="space-y-6"><h1 className="page-title">Waktu akses hasil</h1><p>Atur kapan pimpinan, termasuk Dekan, dapat membaca hasil. Perubahan tercatat dalam audit.</p>{periods.map(p=><section key={p.id} className="rounded-2xl border bg-white p-6"><h2 className="mb-4 text-xl">{p.name}</h2>{p.accessPolicy&&<AccessPolicyForm periodId={p.id} accessPolicy={{...p.accessPolicy,changedBy:{name:p.createdBy.name}}}/>}</section>)}</div>;
}
