import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Renders only the first `step` items and reveals more on demand, so long lists don't freeze the page. */
export function ShowMoreList<T>({
  items,
  render,
  step = 40,
  wrap,
  wrapMore,
}: {
  items: T[];
  render: (item: T, index: number) => ReactNode;
  step?: number;
  wrap?: (children: ReactNode) => ReactNode;
  /** Wrap the "Show more" button (e.g. in a table row) when rendering inside a table. */
  wrapMore?: (button: ReactNode) => ReactNode;
}) {
  const [limit, setLimit] = useState(step);
  const shown = items.slice(0, limit).map(render);
  const rest = items.length - limit;
  return (
    <>
      {wrap ? wrap(shown) : shown}
      {rest > 0 &&
        (wrapMore ?? ((b: ReactNode) => <div className="flex justify-center p-2">{b}</div>))(
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + step * 5)}>
            Show {Math.min(rest, step * 5)} more ({rest} hidden)
          </Button>,
        )}
    </>
  );
}
