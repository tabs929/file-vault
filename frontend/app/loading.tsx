export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin" />
    </div>
  )
}
