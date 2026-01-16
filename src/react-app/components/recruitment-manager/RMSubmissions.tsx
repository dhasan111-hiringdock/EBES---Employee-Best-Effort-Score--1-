import { useEffect, useState } from "react";
import { fetchWithAuth, rmReviewByRoleCandidate, rmSendCandidateToAM, rmDiscardCandidate } from "@/react-app/utils/api";
import { CheckCircle } from "lucide-react";

interface PendingSubmission {
  role_id: number;
  role_title: string;
  role_code: string;
  client_name: string;
  candidate_id: number;
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  submission_date: string;
}

export default function RMSubmissions() {
  const [items, setItems] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, any>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const keyOf = (i: PendingSubmission) => `${i.role_id}:${i.candidate_id}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/rm/pending-submissions?limit=100");
      if (!res.ok) throw new Error("Failed to load submissions");
      const data = await res.json();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  

  const accept = async (i: PendingSubmission) => {
    setSubmitting(true);
    try {
      const k = keyOf(i);
      const f = forms[k] || {};
      const payload: any = {
        rm_validation_status: f.rm_validation_status || "valid",
        rm_work_type: f.rm_work_type,
        rm_location: f.rm_location,
        rm_notes: f.rm_notes,
        rm_payment: f.rm_payment ? Number(f.rm_payment) : null,
        rm_rate_pay: f.rm_rate_pay ? Number(f.rm_rate_pay) : null,
        rm_score_0_5: f.rm_score_0_5 ? Number(f.rm_score_0_5) : null,
        rm_review_date: new Date().toISOString(),
      };
      const review = await rmReviewByRoleCandidate(i.role_id, i.candidate_id, payload);
      if (!review.ok) {
        const j = await review
          .json()
          .catch(async () => {
            const t = await review.text().catch(() => "");
            return t ? { error: t } : {};
          });
        throw new Error(j?.error || `Validation update failed (${review.status})`);
      }
      const send = await rmSendCandidateToAM(i.role_id, i.candidate_id);
      if (!send.ok) {
        const j = await send.json().catch(() => ({}));
        throw new Error(j?.error || "Send to AM failed");
      }
      setItems((prev) => prev.filter((x) => keyOf(x) !== k));
      setSuccess("Reviewed and sent to AM");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      alert(e?.message || "Failed to accept");
    } finally {
      setSubmitting(false);
    }
  };

  const discard = async (i: PendingSubmission) => {
    const k = keyOf(i);
    const reason = reasons[k] || "";
    if (!reason.trim()) {
      alert("Provide discard reason");
      return;
    }
    setSubmitting(true);
    try {
      const res = await rmDiscardCandidate(i.role_id, i.candidate_id, reason);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Discard failed");
      }
      setItems((prev) => prev.filter((x) => keyOf(x) !== k));
    } catch (e: any) {
      alert(e?.message || "Failed to discard");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg shadow">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {items.length} pending submissions
        </p>
        <button
          className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
          onClick={load}
        >
          Refresh
        </button>
      </div>
      {items.length === 0 ? (
        <div className="p-6 bg-white border border-slate-200 rounded-xl text-slate-600">
          No pending submissions.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((i) => {
            const k = keyOf(i);
            const f = forms[k] || {};
            return (
              <div key={k} className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="font-semibold text-slate-900">{i.candidate_name}</div>
                  <div className="text-xs text-slate-500">{i.role_code} · {i.client_name}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Submitted {new Date(i.submission_date).toLocaleDateString()}</div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Validation</label>
                      <select
                        value={f.rm_validation_status ?? "valid"}
                        onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_validation_status: e.target.value } }))}
                        className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full bg-white"
                      >
                        <option value="valid">Valid</option>
                        <option value="invalid">Invalid</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Contract Type</label>
                      <select
                        value={f.rm_work_type ?? "Payroll"}
                        onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_work_type: e.target.value } }))}
                        className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full bg-white"
                      >
                        <option value="SOW">SOW</option>
                        <option value="Payroll">Payroll</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Payment</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                        <input
                          type="number"
                          placeholder="Payment"
                          value={f.rm_payment ?? ""}
                          onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_payment: e.target.value } }))}
                          className="pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                        />
                        {(() => {
                          const wt = String(f.rm_work_type || "").toLowerCase();
                          const unit = wt === "payroll" ? "annually" : wt === "sow" ? "per day" : "";
                          return unit ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{unit}</span> : null;
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Location</label>
                      <input
                        type="text"
                        placeholder="Location"
                        value={f.rm_location ?? ""}
                        onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_location: e.target.value } }))}
                        className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Score (0–5)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={5}
                        placeholder="Score"
                        value={f.rm_score_0_5 ?? ""}
                        onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_score_0_5: e.target.value } }))}
                        className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Notes</label>
                      <textarea
                        placeholder="Notes"
                        value={f.rm_notes ?? ""}
                        onChange={(e) => setForms((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), rm_notes: e.target.value } }))}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <input
                    className="flex-1 px-3 py-2 text-xs border border-red-200 rounded-lg"
                    type="text"
                    placeholder="Discard reason"
                    value={reasons[k] ?? ""}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [k]: e.target.value }))}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      disabled={submitting}
                      onClick={() => accept(i)}
                      className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Send to AM
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => discard(i)}
                      className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
