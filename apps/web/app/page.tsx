export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl text-center">
        <p className="mb-5 text-xs font-semibold tracking-[0.45em] text-emerald-400">
          TIME PRECISION
        </p>
        <h1 className="text-7xl font-black tracking-tighter sm:text-9xl">
          EXACT
        </h1>
        <p className="mx-auto mt-6 max-w-md text-balance text-base leading-7 text-zinc-400 sm:text-lg">
          Você consegue sentir o tempo passar sem olhar para o relógio?
        </p>
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-medium text-zinc-300">Fundação pronta.</p>
          <p className="mt-2 text-sm text-zinc-500">
            O modo Solo chega na próxima etapa.
          </p>
        </div>
      </section>
    </main>
  );
}
