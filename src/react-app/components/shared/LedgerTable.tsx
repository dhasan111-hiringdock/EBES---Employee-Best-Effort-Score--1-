 

type Entry = {
  event_date: string;
  event_type: string;
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
};

export default function LedgerTable({
  entries,
  onCandidateClick,
}: {
  entries: Entry[];
  onCandidateClick?: (e: Entry) => void;
}) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left">
          <th className="px-3 py-2 border-b w-32 sticky left-0 top-0 z-20 bg-white">Date</th>
          <th className="px-3 py-2 border-b w-40 sticky left-32 top-0 z-20 bg-white">Event</th>
          <th className="px-3 py-2 border-b">Candidate</th>
          <th className="px-3 py-2 border-b">Role</th>
          <th className="px-3 py-2 border-b">RoleStatus</th>
          <th className="px-3 py-2 border-b">Client</th>
          <th className="px-3 py-2 border-b">Team</th>
          <th className="px-3 py-2 border-b">SubmissionType</th>
          <th className="px-3 py-2 border-b">InterviewLevel</th>
          <th className="px-3 py-2 border-b">CVMatchPercent</th>
          <th className="px-3 py-2 border-b">Notes</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i} className="border-b">
            <td className="px-3 py-2 w-32 sticky left-0 bg-white">{e.event_date}</td>
            <td className="px-3 py-2 w-40 sticky left-32 bg-white">{e.event_type}</td>
            <td className="px-3 py-2">
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
            <td className="px-3 py-2">{e.role_status || ""}</td>
            <td className="px-3 py-2">{e.client_name}</td>
            <td className="px-3 py-2">{e.team_name}</td>
            <td className="px-3 py-2">{e.submission_type || ""}</td>
            <td className="px-3 py-2">{e.interview_level != null ? String(e.interview_level) : ""}</td>
            <td className="px-3 py-2">{e.cv_match_percent != null ? String(e.cv_match_percent) : ""}</td>
            <td className="px-3 py-2">{e.notes || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
