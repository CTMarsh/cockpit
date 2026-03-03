import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold flex items-center gap-3">
        <Icon className="w-6 h-6 text-cockpit-accent" />
        {title}
      </h2>
      {children}
    </div>
  );
}
