export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="pixel-heading text-lg text-white">{title}</h1>
        {description && (
          <p className="text-xs text-digi-muted mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
