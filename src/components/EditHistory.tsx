import type { EditLogEntry } from "@/lib/types";
import Avatar from "@/components/Avatar";

interface EditHistoryProps {
  entries: EditLogEntry[];
  contributedBy: string;
}

export default function EditHistory({ entries, contributedBy }: EditHistoryProps) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-6 border-t border-cream-dark/30 pt-6">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate/50">
        Edit History
      </h3>
      <div className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-start gap-2.5">
            <Avatar name={entry.editor} size="sm" />
            <div className="flex-1">
              <p className="font-sans text-xs text-slate">
                <span className="font-semibold text-charcoal">{entry.editor}</span>
                {entry.editor !== contributedBy && (
                  <span className="text-slate/50"> edited {contributedBy}&rsquo;s recipe</span>
                )}
                {entry.editor === contributedBy && (
                  <span className="text-slate/50"> updated their recipe</span>
                )}
              </p>
              <p className="font-sans text-xs text-slate/70">{entry.summary}</p>
              <p className="font-sans text-[10px] text-slate/40">
                {new Date(entry.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
