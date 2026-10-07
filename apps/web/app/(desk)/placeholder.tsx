import { copy } from "@cleat/domain";

export function DeskPlaceholder({ title }: { title: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{copy.laterTicket}</p>
      </div>
    </div>
  );
}
