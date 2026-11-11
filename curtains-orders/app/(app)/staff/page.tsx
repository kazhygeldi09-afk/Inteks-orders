import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { ROLES, type Profile } from "@/lib/types";
import { PageTitle } from "@/components/ui";
import { AddStaffForm, StaffRow } from "./StaffForms";
import { createStaff, setStaffPassword, updateStaff } from "./actions";

export default async function StaffPage() {
  const me = await requireProfile(["manager", "owner"]);
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active")
    .order("full_name");

  const people = ((data ?? []) as Profile[]).sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      ROLES.indexOf(b.role ?? "designer") - ROLES.indexOf(a.role ?? "designer") ||
      a.full_name.localeCompare(b.full_name),
  );
  const isOwner = me.role === "owner";

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle>{t.staff.title}</PageTitle>
      <AddStaffForm action={createStaff} canMakeOwner={isOwner} />
      <ul className="space-y-3">
        {people.map((p) => (
          <StaffRow
            key={p.id}
            person={p}
            isMe={p.id === me.id}
            canEdit={isOwner || p.role !== "owner"}
            canMakeOwner={isOwner}
            update={updateStaff.bind(null, p.id)}
            setPassword={setStaffPassword.bind(null, p.id)}
          />
        ))}
      </ul>
    </div>
  );
}
