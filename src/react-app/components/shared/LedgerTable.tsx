type Entry = {
  event_date: string;
  event_type?: string;
  candidate_name?: string;
  candidate_code?: string;
  candidate_email?: string;
  candidate_phone?: string;
  role_title: string;
  role_code?: string;
  role_status?: string;
  role_description?: string;
  client_name: string;
  team_name: string;
  submission_type?: string;
  interview_level?: string | number;
  cv_match_percent?: string | number;
  notes?: string;
  role_level?: string;
  recruiter_name?: string;
  submitted_to_client?: boolean;
  interviewed?: boolean;
  client_rejected?: boolean;
  deal_closed?: boolean;
};

export default function LedgerTable({
  entries,
  onCandidateClick,
  mode = "classic",
}: {
  entries: Entry[];
  onCandidateClick?: (e: Entry) => void;
  mode?: "classic" | "role-centric";
}) {
  if (mode === "role-centric") {
    return (
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="px-3 py-2 border-b w-32 sticky left-0 top-0 z-20 bg-white">Date</th>
            <th className="px-3 py-2 border-b w-48 sticky left-32 top-0 z-20 bg-white">Candidate</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Role</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">RoleLevel</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Client</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Event</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Recruiter</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Submitted?</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">Interviewed?</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">ClientRejected?</th>
            <th className="px-3 py-2 border-b top-0 sticky bg-white">DealClosed?</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b odd:bg-white even:bg-slate-50 hover:bg-slate-100">
              <td className="px-3 py-2 w-32 sticky left-0 bg-white">{e.event_date}</td>
              <td className="px-3 py-2 w-48 sticky left-32 bg-white">
                {onCandidateClick && e.candidate_name ? (
                  <button
                    className="text-indigo-600 hover:underline"
                    onClick={() => onCandidateClick(e)}
                  >
                    {e.candidate_name}
                  </button>
                ) : (
                  e.candidate_name || ""
                )}
              </td>
              <td className="px-3 py-2">{`${e.role_title}${e.role_code ? ` (${e.role_code})` : ""}`}</td>
              <td className="px-3 py-2">{e.role_level || ""}</td>
              <td className="px-3 py-2">{e.client_name}</td>
              <td className="px-3 py-2">
                {(e.deal_closed && "deal") ||
                  (e.client_rejected && "client_rejected") ||
                  (e.interviewed && "interview") ||
                  (e.submitted_to_client && "client_submitted") ||
                  ""}
              </td>
              <td className="px-3 py-2">{e.recruiter_name || ""}</td>
              <td className="px-3 py-2">{e.submitted_to_client ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{e.interviewed ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{e.client_rejected ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{e.deal_closed ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left">
          <th className="px-3 py-2 border-b w-32 sticky left-0 top-0 z-20 bg-white">Date</th>
          <th className="px-3 py-2 border-b w-48 sticky left-32 top-0 z-20 bg-white">Candidate</th>
          <th className="px-3 py-2 border-b w-40 sticky left-80 top-0 z-20 bg-white">Event</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white">Role</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden lg:table-cell">RoleStatus</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white">Client</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden md:table-cell">Team</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden md:table-cell">SubmissionType</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden lg:table-cell">InterviewLevel</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden lg:table-cell">CVMatchPercent</th>
          <th className="px-3 py-2 border-b top-0 sticky bg-white hidden xl:table-cell">Notes</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i} className="border-b odd:bg-white even:bg-slate-50 hover:bg-slate-100">
            <td className="px-3 py-2 w-32 sticky left-0 bg-white">{e.event_date}</td>
            <td className="px-3 py-2 w-48 sticky left-32 bg-white">
              {onCandidateClick && e.candidate_name ? (
                <button
                  className="text-indigo-600 hover:underline"
                  onClick={() => onCandidateClick(e)}
                >
                  {e.candidate_name}
                </button>
              ) : (
                e.candidate_name || ""
              )}
            </td>
            <td className="px-3 py-2 w-40 sticky left-80 bg-white">{e.event_type || ""}</td>
            <td className="px-3 py-2">{`${e.role_title}${e.role_code ? ` (${e.role_code})` : ""}`}</td>
            <td className="px-3 py-2 hidden lg:table-cell">{e.role_status || ""}</td>
            <td className="px-3 py-2">{e.client_name}</td>
            <td className="px-3 py-2 hidden md:table-cell">{e.team_name}</td>
            <td className="px-3 py-2 hidden md:table-cell">{e.submission_type || ""}</td>
            <td className="px-3 py-2 hidden lg:table-cell">{e.interview_level != null ? String(e.interview_level) : ""}</td>
            <td className="px-3 py-2 hidden lg:table-cell">
              {e.cv_match_percent != null
                ? typeof e.cv_match_percent === "number"
                  ? `${e.cv_match_percent}%`
                  : String(e.cv_match_percent)
                : ""}
            </td>
            <td className="px-3 py-2 hidden xl:table-cell">{e.notes || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
