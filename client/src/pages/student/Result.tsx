import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Attempt, ResultDetail } from "@/lib/types";
import { PageSkeleton, ErrorState, Button, ButtonLink } from "@/components/ui";
import { ResultReport } from "@/components/ResultReport";

export default function ResultPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justSubmitted = Boolean((location.state as { justSubmitted?: boolean } | null)?.justSubmitted);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["result", id], queryFn: () => api<ResultDetail>(`/student/results/${id}`) });
  const start = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Attempt>("/student/attempts", { body }),
    onSuccess: (a) => navigate(`/student/attempt/${a.resultId}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const retry = () =>
    data.result.kind === "practice" && data.gaps[0]
      ? start.mutate({ mode: "practice", topicId: data.gaps[0].topicId })
      : data.result.kind === "assigned"
        ? navigate("/student/assessments")
        : start.mutate({ mode: "diagnostic", subjectId: data.result.subjectId });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" onClick={() => (justSubmitted ? navigate("/student") : navigate(-1))}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <ButtonLink to="/student" variant="outline" size="sm"><LayoutDashboard className="h-4 w-4" /> Dashboard</ButtonLink>
          <Button size="sm" onClick={retry} loading={start.isPending && !start.variables?.topicId}>
            <RotateCcw className="h-4 w-4" /> {data.result.kind === "assigned" ? "Back to assessments" : "Try again with new questions"}
          </Button>
        </div>
      </div>
      <ResultReport
        detail={data}
        audience="student"
        celebrate={justSubmitted}
        practising={start.isPending ? ((start.variables?.topicId as number | undefined) ?? null) : null}
        onPractice={(topicId) => start.mutate({ mode: "practice", topicId })}
      />
    </div>
  );
}
