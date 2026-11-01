import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";
import type { ResultDetail } from "@/lib/types";
import { PageSkeleton, ErrorState, Button } from "@/components/ui";
import { ResultReport } from "@/components/ResultReport";

export default function TeacherResultView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-result", id], queryFn: () => api<ResultDetail>(`/teacher/results/${id}`) });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <ResultReport detail={data} audience="teacher" />
    </div>
  );
}
