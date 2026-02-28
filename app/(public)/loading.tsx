import Spinner from "@/components/ui/Spinner";

export default function PublicLoading() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
      }}
    >
      <Spinner size="lg" />
    </div>
  );
}
