/**
 * Centralized EBES (Employee Best Effort Score) Calculation
 * This ensures consistent scoring across all user types
 */

export interface RecruiterEBESData {
  submissions_6h: number;
  submissions_24h: number;
  submissions_after_24h: number;
  interviews_level_1: number;
  interviews_level_2: number;
  deals: number;
  accepted_dropouts: number;
  discarded_candidates: number;
  lost_role_candidates: number;
  assigned_roles: number;
  actively_worked_roles: number;
  avg_cv_quality?: number;
}

export interface AccountManagerEBESData {
  total_roles: number;
  interview_1_count: number;
  interview_2_count: number;
  deal_roles: number;
  lost_roles: number;
  no_answer_roles: number;
  on_hold_roles: number;
  cancelled_roles: number;
  dropout_roles: number;
  active_roles: number;
}

export interface RecruitmentManagerEBESData {
  submissions_6h: number;
  submissions_24h: number;
  submissions_after_24h: number;
  total_interviews: number;
  interviews_level_1: number;
  interviews_level_2: number;
  interviews_level_3: number;
  total_deals: number;
  total_dropouts: number;
  total_roles: number;
  total_active_roles: number;
}

/**
 * Calculate Recruiter EBES Score
 * Formula: (Table 1 / Table 2) × 100, capped at 100
 */
export function calculateRecruiterEBES(data: RecruiterEBESData): {
  score: number;
  performance_label: string;
  table1_points: number;
  table2_points: number;
} {
  // ============ TABLE 1: Performance Points ============
  let table1Points = 0;

  // Submission timing points
  table1Points += data.submissions_6h * 2;        // 2 points per 6h submission
  table1Points += data.submissions_24h * 1.5;     // 1.5 points per 24h submission
  table1Points += data.submissions_after_24h * 1; // 1 point per after 24h submission

  // Interview level points
  table1Points += data.interviews_level_1 * 3;    // 3 points per 1st interview
  table1Points += data.interviews_level_2 * 2;    // 2 points per 2nd interview
  // Level 3 interviews do not contribute to points

  // Deal points
  table1Points += data.deals * 10;  // 10 points per deal

  // Dropout penalty (only accepted dropouts), capped to avoid over-penalization
  table1Points -= Math.min(data.accepted_dropouts * 5, 20);  // cap at -20
  
  // Discarded candidates penalty (general discards, not from lost roles), capped
  table1Points -= Math.min(data.discarded_candidates * 1, 10);  // cap at -10
  
  // Lost role candidates penalty (candidates from roles marked as lost), capped
  table1Points -= Math.min(data.lost_role_candidates * 1, 10);  // cap at -10

  // ============ TABLE 2: Role Engagement Points ============
  let table2Points = 0;
  table2Points += data.assigned_roles * 3;        // 3 points per assigned role
  table2Points += data.actively_worked_roles * 2; // 2 points per actively worked role

  // ============ Calculate EBES Score ============
  const effectiveT2 = Math.max(table2Points, 1);
  let ebesScore = (table1Points / effectiveT2) * 100;

  // Cap at 100, minimum 0, with stricter cap when any dropout or losses exist
  const hasNegativeEvents = (data.accepted_dropouts > 0) || (data.discarded_candidates > 0) || (data.lost_role_candidates > 0);
  const baseCap = hasNegativeEvents ? 95 : 100;
  const quality = typeof data.avg_cv_quality === "number" ? data.avg_cv_quality : 0;
  let qualityBonus = 0;
  if (quality >= 98) qualityBonus = 5;
  else if (quality >= 95) qualityBonus = 4;
  else if (quality >= 90) qualityBonus = 2;
  const finalCap = Math.min(baseCap + qualityBonus, 100);
  ebesScore = Math.min(finalCap, Math.max(0, ebesScore));

  // Determine performance label
  let performanceLabel = "At Risk";
  if (ebesScore >= 90) performanceLabel = "Excellent";
  else if (ebesScore >= 75) performanceLabel = "Strong";
  else if (ebesScore >= 60) performanceLabel = "Average";

  return {
    score: Math.round(ebesScore * 10) / 10, // Round to 1 decimal
    performance_label: performanceLabel,
    table1_points: Math.round(table1Points * 10) / 10,
    table2_points: table2Points
  };
}

/**
 * Calculate Account Manager EBES Score
 * Formula: Point-based system, capped at 100
 * Per-incident penalties as requested by customer
 */
export function calculateAccountManagerEBES(data: AccountManagerEBESData): {
  score: number;
  performance_label: string;
} {
  const MAX_EXPECTED_AM_POINTS = 60;

  let points =
    (data.total_roles * 2) +
    (data.interview_1_count * 2) +
    (data.interview_2_count * 2) +
    (data.deal_roles * 12) -
    (data.lost_roles * 12) -
    (data.no_answer_roles * 10) -
    (data.cancelled_roles * 10) -
    (data.on_hold_roles * 0.5) -
    (data.dropout_roles * 5);

  if (data.active_roles > 15 && data.deal_roles === 0) {
    points -= 20;
  }

  const base = (points / Math.max(MAX_EXPECTED_AM_POINTS, 1)) * 100;
  const hasNeg = (data.dropout_roles > 0) || (data.lost_roles > 0) || (data.no_answer_roles > 0) || (data.cancelled_roles > 0);
  const amCap = hasNeg ? 95 : 100;
  const cappedScore = Math.min(amCap, Math.max(0, base));

  // Determine performance label
  let performanceLabel = "Average";
  if (cappedScore >= 100) performanceLabel = "Excellent";
  else if (cappedScore >= 50) performanceLabel = "Strong";
  else if (cappedScore < 20) performanceLabel = "At Risk";

  return {
    score: Math.round(cappedScore * 10) / 10, // Round to 1 decimal
    performance_label: performanceLabel
  };
}

/**
 * Calculate Recruitment Manager EBES Score
 * Formula: (Table 1 / Table 2) × 100, capped at 100
 * RMs are scored based on their team's overall performance
 */
export function calculateRecruitmentManagerEBES(data: RecruitmentManagerEBESData): {
  score: number;
  performance_label: string;
  table1_points: number;
  table2_points: number;
} {
  // ============ TABLE 1: Team Performance Points ============
  let table1Points = 0;
  
  // Submission timing points from team
  table1Points += data.submissions_6h * 2;        // 2 points per 6h submission
  table1Points += data.submissions_24h * 1.5;     // 1.5 points per 24h submission
  table1Points += data.submissions_after_24h * 1; // 1 point per after 24h submission
  
  // Team activity points
  table1Points += data.interviews_level_1 * 3;    // 3 points per 1st interview
  table1Points += data.interviews_level_2 * 1.5;  // 1.5 points per 2nd interview
  // Level 3 interviews don't get points directly in this model, matching recruiter model
  
  table1Points += data.total_deals * 7;       // 7 points per deal
  table1Points -= data.total_dropouts * 5;    // -5 points per dropout

  // ============ TABLE 2: Role Management Points ============
  let table2Points = 0;
  table2Points += data.total_roles * 3;          // 3 points per assigned role
  table2Points += data.total_active_roles * 1;   // 1 point per active role

  // ============ Calculate EBES Score ============
  let ebesScore = 0;
  if (table2Points > 0) {
    ebesScore = (table1Points / table2Points) * 100;
  }

  // Cap at 100, minimum 0, stricter cap when team has dropouts
  const rmCap = data.total_dropouts > 0 ? 95 : 100;
  ebesScore = Math.min(rmCap, Math.max(0, ebesScore));

  // Determine performance label
  let performanceLabel = "At Risk";
  if (ebesScore >= 90) performanceLabel = "Excellent";
  else if (ebesScore >= 75) performanceLabel = "Strong";
  else if (ebesScore >= 60) performanceLabel = "Average";

  return {
    score: Math.round(ebesScore * 10) / 10, // Round to 1 decimal
    performance_label: performanceLabel,
    table1_points: Math.round(table1Points * 10) / 10,
    table2_points: table2Points
  };
}
