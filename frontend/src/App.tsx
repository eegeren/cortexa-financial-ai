import { Helmet } from 'react-helmet';

function Forum() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Helmet>
        <title>Forum • Cortexa Trade</title>
      </Helmet>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-slate-100">Forum</h1>
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-6 text-slate-300">
        Coming soon. You’ll be able to discuss strategies, signals and markets here.
      </div>
    </div>
  );
}

export default Forum;
