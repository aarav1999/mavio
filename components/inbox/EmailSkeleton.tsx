export function EmailSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border/50">
      <div className="w-8 h-8 rounded-full skeleton flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-3.5 w-28 rounded skeleton" />
          <div className="h-3 w-10 rounded skeleton" />
        </div>
        <div className="h-3.5 w-48 rounded skeleton" />
        <div className="h-3 w-full rounded skeleton" />
      </div>
    </div>
  );
}
