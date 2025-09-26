import { PropsWithChildren, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageHeader = ({ title, description, actions, children }: PropsWithChildren<PageHeaderProps>) => (
  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

export default PageHeader;
