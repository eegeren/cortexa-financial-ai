import { PropsWithChildren, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageHeader = ({ title, description, actions, children }: PropsWithChildren<PageHeaderProps>) => (
  <div className="mb-6 flex flex-col gap-4 sm:mb-7 md:flex-row md:items-end md:justify-between">
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">{title}</h1>
      {description && <p className="max-w-3xl text-sm text-slate-300">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">{actions}</div>}
  </div>
);

export default PageHeader;
