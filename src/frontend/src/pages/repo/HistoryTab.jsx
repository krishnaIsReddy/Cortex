// History tab: how the share of high-risk files has changed month by month.
// The chart, range switch and table all come from RiskTrend.
import RiskTrend from "../../components/dashboard/RiskTrend.jsx";
import { useRepoReport } from "./useRepoReport.js";

export default function HistoryTab() {
  const { repoId } = useRepoReport();
  return <RiskTrend repoId={repoId} />;
}
