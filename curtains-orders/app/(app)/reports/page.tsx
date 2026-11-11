import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { isUuid, listDesigners } from "@/lib/queries";
import { formatMoney, monthName, todayISO } from "@/lib/format";
import { PageTitle } from "@/components/ui";

type Row = {
  period: number;
  orders_count: number;
  sales: number;
  collected: number;
  outstanding: number;
};

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireProfile(["manager", "owner"]);
  const { t, lang } = await getI18n();
  const params = await searchParams;

  const thisYear = Number(todayISO().slice(0, 4));
  const yearParam = Number(params.year);
  const year = Number.isInteger(yearParam) && yearParam > 2000 && yearParam < 2100 ? yearParam : thisYear;
  const designer = isUuid(params.designer) ? params.designer : null;

  const supabase = await createClient();
  const [designers, monthly, yearly, unpaid] = await Promise.all([
    listDesigners(),
    supabase.rpc("monthly_report", { p_year: year, p_designer_id: designer }),
    supabase.rpc("yearly_report", { p_designer_id: designer }),
    supabase.rpc("unpaid_summary", { p_designer_id: designer }).single(),
  ]);
  const months = (monthly.data ?? []) as Row[];
  const years = (yearly.data ?? []) as Row[];
  const totals = sum(months);
  const yearOptions = Array.from(new Set([thisYear, ...years.map((y) => y.period)])).sort((a, b) => b - a);
  const owed = unpaid.data as { total_unpaid: number } | null;

  const money = (v: number) => formatMoney(v, lang);

  return (
    <div className="space-y-6">
      <PageTitle>{t.reports.title}</PageTitle>

      <form className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <label htmlFor="year" className="label">
            {t.reports.year}
          </label>
          <select id="year" name="year" defaultValue={String(year)} className="input">
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="w-56">
          <label htmlFor="designer" className="label">
            {t.fields.designer}
          </label>
          <select id="designer" name="designer" defaultValue={designer ?? ""} className="input">
            <option value="">{t.reports.allDesigners}</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary">{t.common.apply}</button>
        <Link href="/reports" className="btn btn-secondary">
          {t.common.reset}
        </Link>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={`${t.reports.sales}, ${year}`} value={money(totals.sales)} />
        <Tile label={`${t.reports.collected}, ${year}`} value={money(totals.collected)} />
        <Tile label={`${t.reports.orders}, ${year}`} value={String(totals.orders_count)} />
        <Tile label={t.orders.unpaidTotal} value={money(Number(owed?.total_unpaid ?? 0))} danger />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{fmt(t.reports.byMonth, { year })}</h2>
        <ReportTable
          rows={months}
          total={totals}
          firstColumn={t.reports.month}
          label={(r) => monthName(r.period, lang)}
          t={t}
          money={money}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.reports.byYear}</h2>
        <ReportTable rows={years} firstColumn={t.reports.year} label={(r) => String(r.period)} t={t} money={money} />
      </section>

      <p className="max-w-3xl text-sm text-muted">{t.reports.explain}</p>
    </div>
  );
}

function sum(rows: Row[]): Row {
  return rows.reduce(
    (acc, r) => ({
      period: 0,
      orders_count: acc.orders_count + Number(r.orders_count),
      sales: acc.sales + Number(r.sales),
      collected: acc.collected + Number(r.collected),
      outstanding: acc.outstanding + Number(r.outstanding),
    }),
    { period: 0, orders_count: 0, sales: 0, collected: 0, outstanding: 0 },
  );
}

function Tile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${danger ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

function ReportTable({
  rows,
  total,
  firstColumn,
  label,
  t,
  money,
}: {
  rows: Row[];
  total?: Row;
  firstColumn: string;
  label: (r: Row) => string;
  t: Awaited<ReturnType<typeof getI18n>>["t"];
  money: (v: number) => string;
}) {
  if (rows.length === 0) return <p className="text-muted">{t.orders.empty}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{firstColumn}</th>
            <th className="num">{t.reports.orders}</th>
            <th className="num">{t.reports.sales}</th>
            <th className="num">{t.reports.collected}</th>
            <th className="num">{t.reports.outstanding}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period} className={Number(r.orders_count) === 0 && Number(r.collected) === 0 ? "text-muted" : ""}>
              <td>{label(r)}</td>
              <td className="num">{r.orders_count}</td>
              <td className="num">{money(Number(r.sales))}</td>
              <td className="num">{money(Number(r.collected))}</td>
              <td className="num">{money(Number(r.outstanding))}</td>
            </tr>
          ))}
          {total && (
            <tr className="font-semibold">
              <td>{t.reports.total}</td>
              <td className="num">{total.orders_count}</td>
              <td className="num">{money(total.sales)}</td>
              <td className="num">{money(total.collected)}</td>
              <td className="num">{money(total.outstanding)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
