import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth, homeFor, type Role } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { PageSkeleton, Spinner } from "@/components/ui";
import Landing from "@/pages/Landing";
import { Login, Register } from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const StudentDashboard = lazy(() => import("@/pages/student/Dashboard"));
const Assessments = lazy(() => import("@/pages/student/Assessments"));
const TakeAssessment = lazy(() => import("@/pages/student/TakeAssessment"));
const ResultPage = lazy(() => import("@/pages/student/Result"));
const LearningPlan = lazy(() => import("@/pages/student/LearningPlan"));
const Lessons = lazy(() => import("@/pages/student/Lessons"));
const LessonPage = lazy(() => import("@/pages/student/Lesson"));
const Tutor = lazy(() => import("@/pages/student/Tutor"));
const ProgressPage = lazy(() => import("@/pages/student/Progress"));
const TeacherOverview = lazy(() => import("@/pages/teacher/Overview"));
const TeacherStudents = lazy(() => import("@/pages/teacher/Students"));
const TeacherStudent = lazy(() => import("@/pages/teacher/StudentDetail"));
const TeacherAssessments = lazy(() => import("@/pages/teacher/Assessments"));
const TeacherAssessmentResults = lazy(() => import("@/pages/teacher/AssessmentResults"));
const TeacherResult = lazy(() => import("@/pages/teacher/ResultView"));
const AdminOverview = lazy(() => import("@/pages/admin/Overview"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminClasses = lazy(() => import("@/pages/admin/Classes"));
const AdminContent = lazy(() => import("@/pages/admin/Content"));
const AdminActivity = lazy(() => import("@/pages/admin/Activity"));
const Settings = lazy(() => import("@/pages/Settings"));

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

const page = (node: ReactNode) => <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<RequireRole><AppShell /></RequireRole>}>
        <Route path="/settings" element={page(<Settings />)} />
      </Route>

      <Route element={<RequireRole roles={["student"]}><AppShell /></RequireRole>}>
        <Route path="/student" element={page(<StudentDashboard />)} />
        <Route path="/student/assessments" element={page(<Assessments />)} />
        <Route path="/student/attempt/:id" element={page(<TakeAssessment />)} />
        <Route path="/student/results/:id" element={page(<ResultPage />)} />
        <Route path="/student/recommendations" element={page(<LearningPlan />)} />
        <Route path="/student/lessons" element={page(<Lessons />)} />
        <Route path="/student/lessons/:id" element={page(<LessonPage />)} />
        <Route path="/student/tutor" element={page(<Tutor />)} />
        <Route path="/student/progress" element={page(<ProgressPage />)} />
      </Route>

      <Route element={<RequireRole roles={["teacher", "admin"]}><AppShell /></RequireRole>}>
        <Route path="/teacher" element={page(<TeacherOverview />)} />
        <Route path="/teacher/students" element={page(<TeacherStudents />)} />
        <Route path="/teacher/students/:id" element={page(<TeacherStudent />)} />
        <Route path="/teacher/assessments" element={page(<TeacherAssessments />)} />
        <Route path="/teacher/assessments/:id" element={page(<TeacherAssessmentResults />)} />
        <Route path="/teacher/results/:id" element={page(<TeacherResult />)} />
      </Route>

      <Route element={<RequireRole roles={["admin"]}><AppShell /></RequireRole>}>
        <Route path="/admin" element={page(<AdminOverview />)} />
        <Route path="/admin/users" element={page(<AdminUsers />)} />
        <Route path="/admin/classes" element={page(<AdminClasses />)} />
        <Route path="/admin/content" element={page(<AdminContent />)} />
        <Route path="/admin/activity" element={page(<AdminActivity />)} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
