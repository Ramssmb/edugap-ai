import type { ReactNode } from "react";
import { BookOpen, BookOpenText, Calculator, FlaskConical } from "lucide-react";

const SUBJECT_ICON: Record<string, ReactNode> = {
  Calculator: <Calculator className="h-5 w-5" />,
  FlaskConical: <FlaskConical className="h-5 w-5" />,
  BookOpenText: <BookOpenText className="h-5 w-5" />,
};

/** Icon for a subject's stored icon name, with a generic book for custom subjects. */
export const subjectIcon = (icon: string) => SUBJECT_ICON[icon] ?? <BookOpen className="h-5 w-5" />;
