export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  // Corporate dashboard: the big page title + description block is removed so the
  // content (tabs, tables, controls) sits at the top. Any action (e.g. a "New…"
  // button) is preserved as a slim top toolbar; with no action, nothing renders.
  void title;
  void description;
  if (!action) return null;
  return <div className="flex justify-end mb-4">{action}</div>;
}
