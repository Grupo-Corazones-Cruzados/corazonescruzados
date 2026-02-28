import Spinner from "@/components/ui/Spinner";

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "5rem 0",
      }}
    >
      <Spinner size="lg" />
    </div>
  );
}
