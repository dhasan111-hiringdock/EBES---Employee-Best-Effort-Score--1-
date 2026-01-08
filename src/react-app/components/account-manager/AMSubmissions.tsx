import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/react-app/utils/api";
import { CheckCircle2, XCircle } from "lucide-react";

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

export default function AMSubmissions() {
  const [items, setItems] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discardReason, setDiscardReason] = useState("");
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const keyOf = (i: PendingSubmission) => `${i.role_id}:${i.candidate_id}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/am/pending-submissions?limit=100");
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
    setWorkingKey(keyOf(i));
    try {
      const res = await fetchWithAuth(
        `/api/am/roles/${i.role_id}/candidates/${i.candidate_id}/submit-to-client`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Submit to client failed");
      }
      setItems((prev) => prev.filter((x) => keyOf(x) !== keyOf(i)));
    } catch (e: any) {
      alert(e?.message || "Failed to accept");
    } finally {
      setWorkingKey(null);
    }
  };

  const discard = async (i: PendingSubmission) => {
    if (!discardReason.trim()) {
      alert("Provide discard reason");
      return;
    }
    setWorkingKey(keyOf(i));
    try {
      const res = await fetchWithAuth(
        `/api/am/roles/${i.role_id}/candidates/${i.candidate_id}/discard`,
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
      setDiscardReason("");
    } catch (e: any) {
      alert(e?.message || "Failed to discard");
    } finally {
      setWorkingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
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
            const working = workingKey === k;
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
                      disabled={working}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      onClick={() => accept(i)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Submit to Client
                    </button>
                    <input
                      className="px-3 py-2 text-sm border border-red-300 rounded-lg"
                      type="text"
                      placeholder="Discard reason"
                      value={discardReason}
                      onChange={(e) => setDiscardReason(e.target.value)}
                    />
                    <button
                      disabled={working}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      onClick={() => discard(i)}
                    >
                      <XCircle className="w-4 h-4" />
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

