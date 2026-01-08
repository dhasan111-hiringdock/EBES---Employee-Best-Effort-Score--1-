import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/react-app/utils/api";
import { CheckCircle2, XCircle, MapPin, FileText, DollarSign, ClipboardList } from "lucide-react";

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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [discardReason, setDiscardReason] = useState("");
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

  const openForm = (i: PendingSubmission) => {
    setExpandedKey(keyOf(i));
    setForm({
      rm_validation_status: "valid",
      rm_work_type: "Payroll",
      rm_location: "",
      rm_notes: "",
      rm_payment: "",
      rm_rate_pay: "",
      rm_score_0_5: "",
    });
    setDiscardReason("");
  };

  const accept = async (i: PendingSubmission) => {
    setSubmitting(true);
    try {
      const payload: any = {
        rm_validation_status: form.rm_validation_status || "valid",
        rm_work_type: form.rm_work_type,
        rm_location: form.rm_location,
        rm_notes: form.rm_notes,
        rm_payment: form.rm_payment ? Number(form.rm_payment) : null,
        rm_rate_pay: form.rm_rate_pay ? Number(form.rm_rate_pay) : null,
        rm_score_0_5: form.rm_score_0_5 ? Number(form.rm_score_0_5) : null,
        rm_review_date: new Date().toISOString(),
      };
      const review = await fetchWithAuth(
        `/api/rm/roles/${i.role_id}/candidates/${i.candidate_id}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!review.ok) {
        const j = await review
          .json()
          .catch(async () => {
            const t = await review.text().catch(() => "");
            return t ? { error: t } : {};
          });
        throw new Error(j?.error || `Validation update failed (${review.status})`);
      }
      const send = await fetchWithAuth(
        `/api/rm/roles/${i.role_id}/candidates/${i.candidate_id}/send-to-am`,
        { method: "POST" }
      );
      if (!send.ok) {
        const j = await send.json().catch(() => ({}));
        throw new Error(j?.error || "Send to AM failed");
      }
      setItems((prev) => prev.filter((x) => keyOf(x) !== keyOf(i)));
      setExpandedKey(null);
      setSuccess("Reviewed and sent to AM");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      alert(e?.message || "Failed to accept");
    } finally {
      setSubmitting(false);
    }
  };

  const discard = async (i: PendingSubmission) => {
    if (!discardReason.trim()) {
      alert("Provide discard reason");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(
        `/api/rm/roles/${i.role_id}/candidates/${i.candidate_id}/discard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: discardReason }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Discard failed");
      }
      setItems((prev) => prev.filter((x) => keyOf(x) !== keyOf(i)));
      setExpandedKey(null);
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
            <CheckCircle2 className="w-4 h-4" />
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
        <div className="grid grid-cols-1 gap-4">
          {items.map((i) => {
            const k = keyOf(i);
            const expanded = expandedKey === k;
            return (
              <div
                key={k}
                className="bg-white border border-slate-200 rounded-xl shadow-sm"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-slate-500">
                        {i.role_code}
                      </span>
                      <span className="text-sm text-slate-500">•</span>
                      <span className="text-sm text-slate-700">
                        {i.client_name}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-slate-800">
                      {i.role_title}
                    </p>
                    <p className="text-sm text-slate-600">
                      {i.candidate_name}{" "}
                      {i.candidate_email ? `• ${i.candidate_email}` : ""}{" "}
                      {i.candidate_phone ? `• ${i.candidate_phone}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted {new Date(i.submission_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      onClick={() => openForm(i)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Accept
                    </button>
                    <button
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                      onClick={() => {
                        setExpandedKey(k);
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Discard
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Payment (Bill Rate)
                        </span>
                      </div>
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        type="number"
                        placeholder="e.g. 75"
                        value={form.rm_payment || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            rm_payment: e.target.value,
                          }))
                        }
                      />
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Validation Score (0–5)
                        </span>
                      </div>
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        type="number"
                        min={0}
                        max={5}
                        step={0.5}
                        placeholder="e.g. 4.0"
                        value={form.rm_score_0_5 || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            rm_score_0_5: e.target.value,
                          }))
                        }
                      />
                      <label className="text-sm text-slate-700">
                        Validation Status
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={form.rm_validation_status || "valid"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            rm_validation_status: e.target.value,
                          }))
                        }
                      >
                        <option value="valid">Valid</option>
                        <option value="invalid">Invalid</option>
                      </select>
                      <label className="text-sm text-slate-700">
                        Work Type
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={form.rm_work_type || "Payroll"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            rm_work_type: e.target.value,
                          }))
                        }
                      >
                        <option value="Payroll">Payroll</option>
                        <option value="SOW">SOW</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Location
                        </span>
                      </div>
                      <input
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        type="text"
                        placeholder="e.g. Remote"
                        value={form.rm_location || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            rm_location: e.target.value,
                          }))
                        }
                      />
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Notes
                        </span>
                      </div>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        rows={4}
                        placeholder="Add RM notes"
                        value={form.rm_notes || ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, rm_notes: e.target.value }))
                        }
                      />
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          disabled={submitting}
                          onClick={() => accept(i)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Send to AM
                        </button>
                        <input
                          className="flex-1 px-3 py-2 border border-red-300 rounded-lg"
                          type="text"
                          placeholder="Discard reason"
                          value={discardReason}
                          onChange={(e) => setDiscardReason(e.target.value)}
                        />
                        <button
                          disabled={submitting}
                          onClick={() => discard(i)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Discard
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
