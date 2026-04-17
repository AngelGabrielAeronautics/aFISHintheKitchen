// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import SortableList from "../SortableList";

afterEach(() => {
  cleanup();
});

interface HarnessProps {
  initial: string[];
  onUpdate?: (i: number, v: string) => void;
  onReorder?: (items: string[]) => void;
  onAdd?: () => void;
  onRemove?: (i: number) => void;
  onAddSection?: () => void;
  multiline?: boolean;
}

function renderList(props: HarnessProps) {
  return render(
    <SortableList
      items={props.initial}
      onReorder={props.onReorder ?? vi.fn()}
      onUpdate={props.onUpdate ?? vi.fn()}
      onAdd={props.onAdd ?? vi.fn()}
      onRemove={props.onRemove ?? vi.fn()}
      placeholderPrefix="Step"
      addLabel="Add step"
      multiline={props.multiline}
      inputClasses="test-input"
      onAddSection={props.onAddSection}
    />
  );
}

describe("SortableList — section headers (## prefix)", () => {
  it("renders a step number for normal instruction rows", () => {
    renderList({ initial: ["Mix flour and water"], multiline: true });
    // Step marker "1." is present and the textarea shows the raw value.
    expect(screen.getByText("1.")).toBeTruthy();
    expect(screen.getByDisplayValue("Mix flour and water")).toBeTruthy();
  });

  it("omits the step number for section headers", () => {
    renderList({
      initial: ["## For the crust", "Cut butter into flour"],
      multiline: true,
    });
    // The section header row does not contribute a "1." marker; only the
    // non-header below it shows "1." (indices are by array position, not
    // by non-header rank — rows are numbered index+1, and the non-header is
    // at index 1, so it shows "2.").
    expect(screen.queryByText("1.")).toBeNull();
    expect(screen.getByText("2.")).toBeTruthy();
  });

  it("shows the section input without the `## ` prefix", () => {
    renderList({
      initial: ["## For the filling"],
      multiline: true,
    });
    // The visible section input value has the prefix stripped.
    expect(screen.getByDisplayValue("For the filling")).toBeTruthy();
    expect(screen.queryByDisplayValue("## For the filling")).toBeNull();
  });

  it("re-applies the `## ` prefix when the section input is edited", () => {
    const onUpdate = vi.fn();
    renderList({
      initial: ["## For the crust"],
      multiline: true,
      onUpdate,
    });
    const input = screen.getByDisplayValue("For the crust") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "For the topping" } });
    expect(onUpdate).toHaveBeenCalledWith(0, "## For the topping");
  });

  it("uses a different placeholder for the section input", () => {
    renderList({
      initial: ["## "],
      multiline: true,
    });
    // Blank section header shows the dedicated section placeholder.
    expect(
      screen.getByPlaceholderText("Section name (e.g. For the Crust)")
    ).toBeTruthy();
  });

  it("exposes an Add Section button only when onAddSection is provided", () => {
    const onAddSection = vi.fn();
    const { rerender } = renderList({
      initial: ["Mix"],
      multiline: true,
      onAddSection,
    });
    expect(screen.getByText("Add Section")).toBeTruthy();

    rerender(
      <SortableList
        items={["Mix"]}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        placeholderPrefix="Step"
        addLabel="Add step"
        multiline
        inputClasses="test-input"
      />
    );
    expect(screen.queryByText("Add Section")).toBeNull();
  });
});

describe("SortableList — add / remove wiring", () => {
  it("fires onAdd when the add button is clicked", () => {
    const onAdd = vi.fn();
    renderList({ initial: ["Mix"], onAdd });
    fireEvent.click(screen.getByText("Add step"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("fires onRemove with the item index when remove is clicked", () => {
    const onRemove = vi.fn();
    renderList({ initial: ["Mix", "Bake"], onRemove });
    // Two remove buttons (one per row); click the first.
    const removes = screen.getAllByLabelText("Remove item");
    fireEvent.click(removes[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("hides the remove button when only one item remains", () => {
    renderList({ initial: ["Only"] });
    expect(screen.queryByLabelText("Remove item")).toBeNull();
  });
});
